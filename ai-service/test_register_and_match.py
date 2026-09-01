"""
test_register_and_match.py - End-to-end test script to register a face image batch and verify FAISS matching.
"""
import asyncio
import cv2
import numpy as np
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

from config.settings import settings
from services.model_manager import model_manager
from cache.embedding_cache import embedding_cache
from services.faiss_manager import faiss_manager
from pipelines.registration_pipeline import register_user_batch

async def test():
    print("1. Loading Models...")
    model_manager.load_model("detector", settings.DETECTOR_MODEL_PATH)
    model_manager.load_model("recognizer", settings.RECOGNIZER_MODEL_PATH)
    model_manager.warm_up()
    
    # Use a real face image (e.g., snap_6a50d216b337550aa334f38c_482aae.jpg)
    sample_face_path = r'C:\Users\Lenovo\OneDrive\Desktop\Major\backend\uploads\snapshots\snap_6a50d216b337550aa334f38c_482aae.jpg'
    
    with open(sample_face_path, 'rb') as f:
        img_bytes = f.read()
        
    complaint_id = "6a4d45e77a7de1e52eee766f" # poorvik
    print(f"\n2. Registering real face image for complaint {complaint_id} (poorvik)...")
    
    res = await register_user_batch([img_bytes], complaint_id)
    print("Registration Result:", res)
    
    print("\n3. Verifying FAISS Search...")
    # Load same image and test FAISS search
    img = cv2.imread(sample_face_path)
    from services.detector import detector
    from services.recognizer import recognizer
    from services.image_processing import align_face
    
    bboxes, kpss = detector.detect(img)
    aligned = align_face(img, kpss[0])
    emb = recognizer.get_embedding(aligned)
    
    match = faiss_manager.search(emb)
    print(f"FAISS Match Result: {match}")
    if match and match[0] == complaint_id:
        print("SUCCESS! Complaint person matched with high similarity score:", match[1])
    else:
        print("MATCH FAILED!", match)

asyncio.run(test())
