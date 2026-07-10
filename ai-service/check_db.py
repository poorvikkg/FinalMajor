import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['surveillance_db']
    
    # Check complaints with embeddings
    complaints = await db.complaints.find({}).to_list(100)
    print(f'Total complaints: {len(complaints)}')
    for c in complaints:
        cid = str(c.get('_id'))
        name = c.get('missingPersonName', 'N/A')
        ctype = c.get('type', 'N/A')
        sv = c.get('searchVector', [])
        complaintId = c.get('complaintId', 'N/A')
        print(f'  ID={cid} | complaintId={complaintId} | type={ctype} | name={name} | searchVector_len={len(sv)}')

    # Check recognition logs
    logs = await db.recognitionlogs.find({}).to_list(10)
    print(f'\nTotal recognition logs: {len(logs)}')
    for l in logs[:5]:
        print(f'  personName={l.get("personName")} | isUnknown={l.get("isUnknown")} | confidence={l.get("confidence")}')

asyncio.run(main())
