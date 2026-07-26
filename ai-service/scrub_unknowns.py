import asyncio
import numpy as np
import faiss
from motor.motor_asyncio import AsyncIOMotorClient

def _cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 0.0
    return float(np.dot(v1, v2) / (n1 * n2))

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['surveillance_db']
    
    print("Fetching registered target persons...")
    complaints = await db.complaints.find({}).to_list(200)
    target_embeddings = []
    target_names = []

    for c in complaints:
        name = c.get('missingPersonName', 'Target Subject')
        sv = c.get('searchVector', [])
        if len(sv) == 512:
            emb = np.array(sv, dtype=np.float32)
            target_embeddings.append(emb)
            target_names.append(name)

    print(f"Loaded {len(target_embeddings)} registered target embeddings ({set(target_names)}).")

    if not target_embeddings:
        print("No target embeddings found in complaints.")
        return

    # Check unknownpersons collection
    unknowns = await db.unknownpersons.find({}).to_list(500)
    print(f"Scanning {len(unknowns)} unknown person records in MongoDB...")

    deleted_count = 0

    for u in unknowns:
        u_id = u.get('_id')
        unknown_id_str = u.get('unknownId', 'N/A')
        
        # Check representative embedding
        rep_emb = u.get('representativeEmbedding', [])
        is_target_match = False
        matched_name = ""

        if len(rep_emb) == 512:
            u_vec = np.array(rep_emb, dtype=np.float32)
            for idx, t_emb in enumerate(target_embeddings):
                sim = _cosine_similarity(u_vec, t_emb)
                if sim >= 0.35:
                    is_target_match = True
                    matched_name = target_names[idx]
                    print(f"  [MATCH] Unknown Person {unknown_id_str} matches target person '{matched_name}' (similarity={sim:.3f}).")
                    break

        if is_target_match:
            await db.unknownpersons.delete_one({'_id': u_id})
            deleted_count += 1
            print(f"  [DELETED] Spurious unknown person record {unknown_id_str} ({u_id}).")

    # Also clean recognition logs marked as unknown for matching timestamps/snapshots
    deleted_logs = await db.recognitionlogs.delete_many({'isUnknown': True, 'personName': {'$regex': 'poorvik', '$options': 'i'}})
    print(f"Cleaned spurious unknown recognition logs: {deleted_logs.deleted_count}")

    # Also clean unknown sightings matching deleted unknown IDs
    print(f"\nScrub complete. Deleted {deleted_count} unknown person records matching target persons.")

if __name__ == '__main__':
    asyncio.run(main())
