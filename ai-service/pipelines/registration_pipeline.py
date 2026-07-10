import cv2
import numpy as np
from services.detector import detector
from services.recognizer import recognizer
from services.faiss_manager import faiss_manager
from cache.embedding_cache import embedding_cache
from services.image_processing import align_face
from config.settings import settings
import os
import uuid
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

logger = logging.getLogger(__name__)

class RegistrationError(Exception):
    pass

async def register_user(image_bytes: bytes, user_id: str) -> dict:
    # 1. Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise RegistrationError("Invalid image file.")
        
    # 2. Detect face
    bboxes, kpss = detector.detect(img)
    
    # 3. Validate exactly one face
    if len(bboxes) == 0:
        raise RegistrationError("No face detected in the image.")
    if len(bboxes) > 1:
        raise RegistrationError("Multiple faces detected. Please provide an image with only one face.")
        
    # 4. Align face
    aligned_face = align_face(img, kpss[0])
    
    # 5. Generate embedding
    embedding = recognizer.get_embedding(aligned_face)
    
    # 6. Save aligned face image to disk (backup)
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = os.path.join(settings.FACES_DIR, filename)
    cv2.imwrite(filepath, aligned_face)
    
    # 7. Persist embedding to MongoDB complaints.searchVector (survives restarts)
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        db = client.get_database()
        collection = db[settings.MONGODB_COLLECTION_EMBEDDINGS]
        result = await collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"searchVector": embedding.tolist()}}
        )
        client.close()
        if result.modified_count == 1:
            logger.info(f"Saved embedding for user {user_id} to MongoDB ({settings.MONGODB_COLLECTION_EMBEDDINGS})")
        else:
            logger.warning(f"MongoDB update for {user_id}: matched={result.matched_count}, modified={result.modified_count}")
    except Exception as e:
        logger.error(f"Failed to persist embedding to MongoDB for {user_id}: {e}")
        # Registration still succeeds in RAM — don't fail the request
    
    # 8. Update RAM Cache
    embedding_cache.add(user_id, embedding)
    
    # 9. Update FAISS index and persist to disk
    faiss_manager.add_user(user_id, embedding)
    faiss_manager.save_index()
    
    logger.info(f"Successfully registered user {user_id}")
    
    return {
        "status": "success",
        "user_id": user_id,
        "filename": filename
    }
