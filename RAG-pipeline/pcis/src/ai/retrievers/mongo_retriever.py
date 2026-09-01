"""MongoDB Retriever for PCIS RAG."""

from typing import Dict, Any, List
from src.config.database import DatabaseManager

class MongoRetriever:
    """Retrieves structured documents from MongoDB collections."""

    @staticmethod
    async def retrieve_cases(filters: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
        collection = DatabaseManager.get_collection("cases")
        cursor = collection.find(filters).limit(limit)
        return await cursor.to_list(length=limit)
        
    @staticmethod
    async def retrieve_persons(filters: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
        collection = DatabaseManager.get_collection("persons")
        cursor = collection.find(filters).limit(limit)
        return await cursor.to_list(length=limit)
        
    @staticmethod
    async def retrieve_officers(filters: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
        collection = DatabaseManager.get_collection("officers")
        cursor = collection.find(filters).limit(limit)
        return await cursor.to_list(length=limit)

    @staticmethod
    async def dynamic_retrieve(collection_name: str, filters: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
        """Generic retriever for any specified collection."""
        collection = DatabaseManager.get_collection(collection_name)
        cursor = collection.find(filters).limit(limit)
        return await cursor.to_list(length=limit)
