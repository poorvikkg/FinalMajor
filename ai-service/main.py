import asyncio
from fastapi import FastAPI
from contextlib import asynccontextmanager
import numpy as np
from motor.motor_asyncio import AsyncIOMotorClient

from config.settings import settings
from services.logger import sys_logger
from services.model_manager import model_manager
from cache.embedding_cache import embedding_cache
from services.faiss_manager import faiss_manager

# MongoDB Global Client
db_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    sys_logger.info("Starting AI Service Initialization...")
    
    # 1. Connect MongoDB
    global db_client
    sys_logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}")
    db_client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = db_client.get_database()
    collection = db[settings.MONGODB_COLLECTION_EMBEDDINGS]
    
    # 2. Fetch all embeddings into RAM Cache from complaints.searchVector
    sys_logger.info("Fetching face embeddings from complaints collection...")
    cursor = collection.find({"searchVector": {"$exists": True, "$not": {"$size": 0}}})
    count = 0
    async for document in cursor:
        user_id = str(document.get("_id"))
        emb_list = document.get("searchVector")
        if emb_list and len(emb_list) == 512:
            # searchVector is the 512-dim face embedding stored as a list of floats
            emb_np = np.array(emb_list, dtype=np.float32)
            embedding_cache.add(user_id, emb_np)
            count += 1
            
    sys_logger.info(f"Loaded {count} face embeddings into RAM cache.")
    
    # 3. Build FAISS Index from RAM Cache
    faiss_manager.build_from_cache()
    
    # 4. Load Models and Warmup
    try:
        model_manager.load_model("detector", settings.DETECTOR_MODEL_PATH)
        model_manager.load_model("recognizer", settings.RECOGNIZER_MODEL_PATH)
        model_manager.warm_up()
    except Exception as e:
        sys_logger.critical(f"Failed to load models: {e}")
        # Depending on strictness, we could raise e to crash startup
        
    sys_logger.info("AI Service Initialization Complete.")
    
    yield
    
    # --- SHUTDOWN ---
    sys_logger.info("Shutting down AI Service...")
    
    # Save FAISS
    faiss_manager.save_index()
    
    # Close MongoDB
    if db_client:
        db_client.close()
        
    sys_logger.info("Shutdown complete.")

from routes import registration, streams, videos, metrics

app = FastAPI(
    title=settings.APP_NAME,
    description="High-performance Face Recognition & Surveillance Inference Service",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(registration.router)
app.include_router(streams.router)
app.include_router(videos.router)
app.include_router(metrics.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "AI Service is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
