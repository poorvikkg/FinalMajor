"""
scrub_sightings.py - Cleanup script to remove spurious unknown sightings and duplicate recognition logs
when a track is confirmed as a known person.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    # Connect to MongoDB database
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['surveillance_db']
    
    # 1. Clean sightings where identityType is UNKNOWN but personId is set or track is shared with KNOWN
    sightings = await db.sightings.find({}).to_list(500)
    print(f"Total sightings: {len(sightings)}")
    
    known_tracks = set()
    for s in sightings:
        if s.get('identityType') == 'KNOWN' and s.get('trackId'):
            known_tracks.add(s.get('trackId'))

    deleted_sightings = 0
    for s in sightings:
        if s.get('identityType') == 'UNKNOWN':
            # If unknown sighting has same trackId as a known sighting, delete it!
            if s.get('trackId') in known_tracks:
                await db.sightings.delete_one({'_id': s.get('_id')})
                deleted_sightings += 1

    print(f"Deleted {deleted_sightings} duplicate unknown sightings matching known tracks.")

    # 2. Clean recognitionlogs marked as unknown where personName is defined or track is known
    logs = await db.recognitionlogs.find({'isUnknown': True}).to_list(500)
    deleted_logs = 0
    for l in logs:
        pname = l.get('personName')
        if pname and pname != 'Unknown Person':
            await db.recognitionlogs.delete_one({'_id': l.get('_id')})
            deleted_logs += 1

    print(f"Deleted {deleted_logs} spurious unknown recognition logs.")

if __name__ == '__main__':
    asyncio.run(main())
