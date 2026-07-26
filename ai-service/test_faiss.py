import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import numpy as np
from cache.embedding_cache import embedding_cache
from services.faiss_manager import faiss_manager

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['surveillance_db']
    
    print("Loading complaints from MongoDB...")
    complaints = await db.complaints.find({}).to_list(100)
    print(f"Total complaints: {len(complaints)}")
    
    for c in complaints:
        cid = str(c.get('_id'))
        name = c.get('name') or c.get('missingPersonName') or 'Unknown'
        sv = c.get('searchVector', [])
        print(f"  Complaint _id={cid} | name={name} | searchVector len={len(sv)}")
        if len(sv) == 512:
            emb = np.array(sv, dtype=np.float32)
            embedding_cache.add(cid, emb)

    # Rebuild FAISS index
    faiss_manager.build_from_cache()
    print(f"FAISS index size: {faiss_manager.index.ntotal}")
    print(f"FAISS id_map: {faiss_manager.id_map}")

    # Now test searching with one of the complaint embeddings!
    if faiss_manager.index.ntotal > 0:
        ids, vecs = embedding_cache.get_all()
        test_emb = vecs[0]
        res = faiss_manager.search(test_emb, threshold=0.20)
        print(f"Test self-search result: {res}")

if __name__ == '__main__':
    asyncio.run(main())
