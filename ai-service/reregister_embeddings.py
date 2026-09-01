"""
One-time script to re-register face embeddings directly using the pipeline
for complaints whose searchVector is missing or empty in MongoDB.
"""
import asyncio
import sys
import os

# Ensure stdout handles unicode
sys.stdout.reconfigure(encoding='utf-8')

# Add ai-service root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import settings
from services.model_manager import model_manager
from cache.embedding_cache import embedding_cache
from services.faiss_manager import faiss_manager
from pipelines.registration_pipeline import register_user_batch, RegistrationError

MONGO_URI = settings.MONGODB_URI

async def reregister_missing_embeddings():
    # 1. Load and warm up face detection and recognition ONNX models
    print("Loading AI Models...")
    model_manager.load_model("detector", settings.DETECTOR_MODEL_PATH)
    model_manager.load_model("recognizer", settings.RECOGNIZER_MODEL_PATH)
    model_manager.warm_up()

    # 2. Connect to MongoDB and find complaints with missing embeddings
    db = AsyncIOMotorClient(MONGO_URI).get_default_database()
    
    # Find all complaints without a proper searchVector
    complaints = await db.complaints.find({}).to_list(1000)
    
    needs_registration = []
    for c in complaints:
        sv = c.get('searchVector', None)
        if sv is None or not isinstance(sv, list) or len(sv) != 512:
            needs_registration.append(c)
    
    print(f"Found {len(needs_registration)} complaints needing re-registration")
    
    for complaint in needs_registration:
        cid = str(complaint['_id'])
        name = complaint.get('missingPersonName') or complaint.get('name') or 'Unknown'
        attachments = complaint.get('attachments', [])
        
        print(f"\nProcessing Complaint {cid} ({name}): {len(attachments)} attachment(s)")
        
        image_bytes_list = []
        for filepath in attachments:
            # Handle potential relative/MinIO paths or backslashes
            actual_path = filepath
            if not os.path.isabs(filepath):
                actual_path = os.path.join(settings.BASE_DIR, "..", "backend", filepath)
            
            if not os.path.exists(actual_path):
                print(f"  File not found on disk: {actual_path}")
                continue
            
            print(f"  Reading attachment: {os.path.basename(actual_path)}")
            try:
                with open(actual_path, 'rb') as f:
                    image_bytes_list.append(f.read())
            except Exception as e:
                print(f"  Error reading file {actual_path}: {e}")
        
        if not image_bytes_list:
            print(f"  WARNING: No unreadable/valid files found for complaint {cid}")
            continue

        try:
            result = await register_user_batch(image_bytes_list, cid)
            print(f"  SUCCESS Registered {cid}: {result}")
        except RegistrationError as e:
            print(f"  Registration error: {e}")
        except Exception as e:
            print(f"  Unexpected error: {e}")
    
    print("\nRe-checking DB & FAISS...")
    complaints_after = await db.complaints.find({}).to_list(1000)
    for c in complaints_after:
        sv = c.get('searchVector', [])
        name = c.get('missingPersonName') or c.get('name') or 'Unknown'
        status = "OK (512-dim)" if isinstance(sv, list) and len(sv) == 512 else f"MISSING (len={len(sv) if isinstance(sv, list) else 0})"
        print(f"  {c['_id']} ({name}): {status}")

asyncio.run(reregister_missing_embeddings())
