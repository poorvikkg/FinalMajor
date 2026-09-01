"""
main.py - Entry point for the Surveillance AI Inference Service.

Initializes the FastAPI application, manages startup/shutdown lifecycle events,
synchronizes MongoDB face embeddings into in-memory FAISS indices, loads ONNX models,
and mounts API routers for registration, streams, video processing, and metrics.
"""
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
from services.unknown_person_manager import unknown_person_manager

# MongoDB Global Client instance
db_client = None

# Trigger reload: sync embeddings & unknown clustering v2.0.0
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP LIFECYCLE ---
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
    
    # 3. Build FAISS Index from RAM Cache (Known persons)
    faiss_manager.build_from_cache()
    
    # 4. Load Models and Warmup
    try:
        model_manager.load_model("detector", settings.DETECTOR_MODEL_PATH)
        model_manager.load_model("recognizer", settings.RECOGNIZER_MODEL_PATH)
        model_manager.warm_up()
    except Exception as e:
        sys_logger.critical(f"Failed to load models: {e}")

    # 5. Initialize Unknown Person FAISS Index from MongoDB
    try:
        sys_logger.info("Initializing Unknown Person FAISS index...")
        await unknown_person_manager.initialize(db)
        stats = unknown_person_manager.get_stats()
        sys_logger.info(
            f"Unknown Person index ready: {stats['unknown_identity_count']} identities, "
            f"{stats['recurring_count']} recurring, {stats['review_required_count']} review-required"
        )
    except Exception as e:
        sys_logger.error(f"Unknown Person index init failed (non-fatal): {e}")
        
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

# Import API sub-routers
from routes import registration, streams, videos, metrics
from rag.routers import rag_routes

# Initialize FastAPI application with metadata and lifecycle management
app = FastAPI(
    title=settings.APP_NAME,
    description="High-performance Face Recognition & Surveillance Inference Service",
    version="1.0.0",
    lifespan=lifespan
)

# Register route modules with the application
app.include_router(registration.router)
app.include_router(streams.router)
app.include_router(videos.router)
app.include_router(metrics.router)
app.include_router(rag_routes.router, prefix="/api/v1")
app.include_router(rag_routes.router) # also mount directly at /ai/*

@app.get("/health")
async def health_check():
    """Health check endpoint to verify AI service status."""
    return {"status": "ok", "message": "AI Service is running"}

if __name__ == "__main__":
    # Run uvicorn server directly when executing script
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=settings.DEBUG)

