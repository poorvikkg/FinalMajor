"""
PCIS Database Connection Manager

Async MongoDB connection using Motor with lifecycle management.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from src.config.settings import settings
import logging

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages the MongoDB connection lifecycle."""

    _client: AsyncIOMotorClient | None = None
    _database: AsyncIOMotorDatabase | None = None

    @classmethod
    async def connect(cls) -> None:
        """Establish MongoDB connection."""
        logger.info(f"Connecting to MongoDB at {settings.db_host}:{settings.db_port}")
        cls._client = AsyncIOMotorClient(
            settings.mongodb_uri,
            maxPoolSize=50,
            minPoolSize=10,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
        )
        cls._database = cls._client[settings.db_name]

        # Verify connection
        await cls._client.admin.command("ping")
        logger.info(f"Connected to MongoDB database: {settings.db_name}")

    @classmethod
    async def disconnect(cls) -> None:
        """Close MongoDB connection."""
        if cls._client:
            cls._client.close()
            cls._client = None
            cls._database = None
            logger.info("Disconnected from MongoDB")

    @classmethod
    def get_database(cls) -> AsyncIOMotorDatabase:
        """Get the database instance. Raises if not connected."""
        if cls._database is None:
            raise RuntimeError(
                "Database not initialized. Call DatabaseManager.connect() first."
            )
        return cls._database

    @classmethod
    def get_collection(cls, name: str):
        """Get a collection by name."""
        db = cls.get_database()
        return db[name]


# Convenience accessor
def get_db() -> AsyncIOMotorDatabase:
    """Shorthand to get the current database instance."""
    return DatabaseManager.get_database()
