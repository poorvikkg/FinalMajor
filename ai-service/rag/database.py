"""
Database Manager for RAG pipeline in ai-service.
Connects to MongoDB using settings.MONGODB_URI.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import settings

class DatabaseManager:
    _client = None
    _db = None

    @classmethod
    def get_db(cls):
        if cls._client is None:
            cls._client = AsyncIOMotorClient(settings.MONGODB_URI)
            try:
                cls._db = cls._client.get_default_database()
            except Exception:
                cls._db = cls._client["surveillance_db"]
            if cls._db is None or cls._db.name == "test":
                cls._db = cls._client["surveillance_db"]
        return cls._db

    @classmethod
    def get_collection(cls, collection_name: str):
        db = cls.get_db()
        return db[collection_name]
