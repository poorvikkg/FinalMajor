"""
inspect_db.py - Utility script to display detailed complaint metadata and recognition log records.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    # Connect to MongoDB database
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['surveillance_db']
    
    # Print sample complaint metadata excluding heavy binary/vector fields
    print("=== COMPLAINT DETAILS ===")
    complaints = await db.complaints.find({}).to_list(10)
    for c in complaints:
        print(f"Complaint ID: {c.get('_id')}")
        for k, v in c.items():
            if k != 'searchVector' and k != 'photoUrl':
                print(f"  {k}: {v}")

    # Print recent recognition logs
    print("\n=== RECOGNITION LOGS DETAILS ===")
    logs = await db.recognitionlogs.find({}).to_list(50)
    print(f"Total recognition logs: {len(logs)}")
    for l in logs:
        print(f"  Log ID: {l.get('_id')} | personName: {l.get('personName')} | isUnknown: {l.get('isUnknown')} | videoId: {l.get('videoId')}")

if __name__ == '__main__':
    # Execute database inspection async routine
    asyncio.run(main())
