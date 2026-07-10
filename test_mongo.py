import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import numpy as np

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["sentinel"]
    collection = db["users"]
    cursor = collection.find({"embedding": {"$exists": True}})
    async for doc in cursor:
        print("user_id:", doc.get("_id"))
        emb = doc.get("embedding")
        print("type:", type(emb))
        if isinstance(emb, list):
            print("len:", len(emb))
            print("shape if np array:", np.array(emb).shape)

if __name__ == "__main__":
    asyncio.run(check())
