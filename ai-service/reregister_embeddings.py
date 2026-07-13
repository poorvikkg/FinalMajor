"""
One-time script to re-register face embeddings directly using the pipeline
for complaints whose searchVector is missing or empty in MongoDB.
Run this AFTER the AI service has loaded its models (or run standalone).
"""
import asyncio
import sys
import os

# Ensure stdout handles unicode
sys.stdout.reconfigure(encoding='utf-8')

# Add ai-service root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from pipelines.registration_pipeline import register_user, RegistrationError

MONGO_URI = "mongodb://localhost:27017/surveillance_db"

async def reregister_missing_embeddings():
    db = AsyncIOMotorClient(MONGO_URI).get_default_database()
    
    # Find all complaints without a proper searchVector
    complaints = await db.complaints.find({}).to_list(1000)
    
    needs_registration = []
    for c in complaints:
        sv = c.get('searchVector', None)
        if sv is None or len(sv) != 512:
            needs_registration.append(c)
    
    print(f"Found {len(needs_registration)} complaints needing re-registration")
    
    for complaint in needs_registration:
        cid = str(complaint['_id'])
        name = complaint.get('missingPersonName', 'Unknown')
        attachments = complaint.get('attachments', [])
        
        print(f"\nComplaint {cid} ({name}): {len(attachments)} attachment(s)")
        
        registered = False
        for filepath in attachments:
            if not os.path.exists(filepath):
                print(f"  File not found: {filepath}")
                continue
            
            print(f"  Registering from: {os.path.basename(filepath)}")
            try:
                with open(filepath, 'rb') as f:
                    image_bytes = f.read()
                
                result = await register_user(image_bytes, cid)
                print(f"  OK Registered: {result}")
                registered = True
                break  # One successful registration is enough
            except RegistrationError as e:
                print(f"  Registration error: {e}")
            except Exception as e:
                print(f"  Unexpected error: {e}")
        
        if not registered:
            print(f"  WARNING: Could not register complaint {cid} - no valid images found")
    
    print("\nDone! Re-checking DB...")
    complaints_after = await db.complaints.find({}).to_list(1000)
    for c in complaints_after:
        sv = c.get('searchVector', [])
        name = c.get('missingPersonName', 'Unknown')
        status = "OK (512-dim)" if isinstance(sv, list) and len(sv) == 512 else f"MISSING (len={len(sv) if isinstance(sv, list) else 0})"
        print(f"  {c['_id']} ({name}): {status}")

asyncio.run(reregister_missing_embeddings())
