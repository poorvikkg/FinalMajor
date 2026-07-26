import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['surveillance_db']
    
    print("=== COMPLAINT DETAILS ===")
    complaints = await db.complaints.find({}).to_list(10)
    for c in complaints:
        print(f"Complaint ID: {c.get('_id')}")
        for k, v in c.items():
            if k != 'searchVector' and k != 'photoUrl':
                print(f"  {k}: {v}")

    print("\n=== RECOGNITION LOGS DETAILS ===")
    logs = await db.recognitionlogs.find({}).to_list(50)
    print(f"Total recognition logs: {len(logs)}")
    for l in logs:
        print(f"  Log ID: {l.get('_id')} | personName: {l.get('personName')} | isUnknown: {l.get('isUnknown')} | videoId: {l.get('videoId')}")

if __name__ == '__main__':
    asyncio.run(main())
