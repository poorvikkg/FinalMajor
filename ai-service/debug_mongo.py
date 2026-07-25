import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['surveillance_db']
    
    complaints = await db.complaints.find({}).to_list(100)
    print(f"Total Complaints in DB: {len(complaints)}")
    
    for c in complaints:
        cid = str(c['_id'])
        name = c.get('missingPersonName') or c.get('name') or 'Unnamed'
        attachments = c.get('attachments', [])
        sv = c.get('searchVector')
        sv_status = f"VALID 512-dim list" if isinstance(sv, list) and len(sv) == 512 else f"INVALID/MISSING ({type(sv)})"
        print(f"\nID: {cid} | Name: {name}")
        print(f"  Attachments ({len(attachments)}): {attachments}")
        print(f"  SearchVector Status: {sv_status}")

asyncio.run(main())
