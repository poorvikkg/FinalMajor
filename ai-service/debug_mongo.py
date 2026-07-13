import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['surveillance_db']
    
    # Try manually updating to verify update works
    result = await db.complaints.update_one(
        {'_id': ObjectId('6a4d45e77a7de1e52eee766f')},
        {'$set': {'testField': 'hello'}}
    )
    print(f'Update test: matched={result.matched_count}, modified={result.modified_count}')
    
    # Check the raw document structure
    doc = await db.complaints.find_one({'_id': ObjectId('6a4d45e77a7de1e52eee766f')})
    if doc:
        print('Document keys:', list(doc.keys()))
        sv = doc.get('searchVector', 'NOT PRESENT')
        print(f'searchVector value: {type(sv)} len={len(sv) if isinstance(sv, list) else "N/A"}')
    else:
        print('Document NOT FOUND')

asyncio.run(main())
