"""
Base MongoDB Repository Implementation.

Provides concrete implementations of common CRUD operations
that all collection-specific repositories inherit from.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import ASCENDING, DESCENDING

from src.config.database import get_db


class MongoBaseRepository:
    """
    Base repository with MongoDB CRUD operations.
    Subclasses set `collection_name` and `id_field` to specialize.
    """

    collection_name: str = ""
    id_field: str = ""

    def _get_collection(self) -> AsyncIOMotorCollection:
        """Get the MongoDB collection for this repository."""
        return get_db()[self.collection_name]

    @staticmethod
    def _generate_id() -> str:
        """Generate a UUID string for use as a primary key."""
        return str(uuid.uuid4())

    def _serialize(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convert MongoDB document to dict, mapping _id to the entity's id field."""
        if doc is None:
            return None
        # Convert ObjectId _id to string if present, but prefer our custom ID field
        if "_id" in doc:
            doc.pop("_id", None)
        return doc

    async def create(self, entity: Dict[str, Any]) -> str:
        """Insert a new document. Returns the generated entity ID."""
        collection = self._get_collection()
        entity_id = self._generate_id()
        entity[self.id_field] = entity_id
        entity["_id"] = entity_id  # Use our UUID as _id for efficient lookups
        await collection.insert_one(entity)
        return entity_id

    async def get_by_id(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Find a document by its primary ID."""
        collection = self._get_collection()
        doc = await collection.find_one({"_id": entity_id})
        return self._serialize(doc) if doc else None

    async def update(self, entity_id: str, update_data: Dict[str, Any]) -> bool:
        """Update a document. Returns True if modified."""
        collection = self._get_collection()
        # Don't overwrite the _id or the entity ID field
        update_data.pop("_id", None)
        update_data.pop(self.id_field, None)
        update_data["updated_at"] = datetime.utcnow()

        result = await collection.update_one(
            {"_id": entity_id}, {"$set": update_data}
        )
        return result.modified_count > 0

    async def delete(self, entity_id: str) -> bool:
        """Soft-delete by setting is_active = False."""
        return await self.update(entity_id, {
            "is_active": False,
            "updated_at": datetime.utcnow(),
        })

    async def list(
        self,
        filters: Dict[str, Any] | None = None,
        skip: int = 0,
        limit: int = 50,
        sort_by: str | None = None,
        sort_order: int = -1,
    ) -> List[Dict[str, Any]]:
        """List documents with optional filtering, pagination, and sorting."""
        collection = self._get_collection()
        query = filters or {}
        cursor = collection.find(query).skip(skip).limit(limit)

        if sort_by:
            direction = DESCENDING if sort_order == -1 else ASCENDING
            cursor = cursor.sort(sort_by, direction)

        results = []
        async for doc in cursor:
            results.append(self._serialize(doc))
        return results

    async def count(self, filters: Dict[str, Any] | None = None) -> int:
        """Count documents matching the filters."""
        collection = self._get_collection()
        return await collection.count_documents(filters or {})

    async def text_search(
        self, query: str, skip: int = 0, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Perform full-text search using MongoDB text index."""
        collection = self._get_collection()
        cursor = (
            collection.find(
                {"$text": {"$search": query}},
                {"score": {"$meta": "textScore"}},
            )
            .sort([("score", {"$meta": "textScore"})])
            .skip(skip)
            .limit(limit)
        )
        results = []
        async for doc in cursor:
            doc.pop("score", None)
            results.append(self._serialize(doc))
        return results
