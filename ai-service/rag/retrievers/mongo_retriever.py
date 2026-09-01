"""MongoDB Multi-Collection Retriever for Surveillance & Police Intelligence RAG."""

import re
from typing import Dict, Any, List, Optional
from bson import ObjectId
from rag.database import DatabaseManager


def _sanitize_doc(doc: Dict[str, Any], collection_name: str) -> Dict[str, Any]:
    """Convert BSON ObjectIds, Datetimes, and attach collection info."""
    clean = dict(doc)
    clean["_collection"] = collection_name
    if "_id" in clean:
        clean["_id"] = str(clean["_id"])
    # Convert any nested ObjectId fields
    for k, v in clean.items():
        if isinstance(v, ObjectId):
            clean[k] = str(v)
        elif isinstance(v, list):
            clean[k] = [str(item) if isinstance(item, ObjectId) else item for item in v]
    return clean


class MongoRetriever:
    """Retrieves structured documents from MongoDB collections with full-text & multi-field search."""

    @staticmethod
    async def search_complaints(query_text: str = "", filters: Dict[str, Any] = None, limit: int = 5) -> List[Dict[str, Any]]:
        """Search complaints by text, person name, location, IDs, or filters."""
        collection = DatabaseManager.get_collection("complaints")
        filters = filters or {}
        mongo_conditions: List[Dict[str, Any]] = []

        # 1. Check if query or filter contains a MongoDB ObjectId
        id_str = filters.get("complaint_id")
        if not id_str:
            id_match = re.search(r'\b[0-9a-fA-F]{24}\b', query_text)
            if id_match:
                id_str = id_match.group(0)

        if id_str:
            try:
                mongo_conditions.append({"_id": ObjectId(id_str)})
            except Exception:
                pass
            mongo_conditions.append({"complaintId": {"$regex": id_str, "$options": "i"}})
            mongo_conditions.append({"firNumber": {"$regex": id_str, "$options": "i"}})

        # 2. Check for Person Name
        person_name = filters.get("person_name")
        if person_name:
            mongo_conditions.append({"missingPersonName": {"$regex": person_name, "$options": "i"}})
            mongo_conditions.append({"name": {"$regex": person_name, "$options": "i"}})
            mongo_conditions.append({"reporterName": {"$regex": person_name, "$options": "i"}})
            mongo_conditions.append({"description": {"$regex": person_name, "$options": "i"}})

        # 3. Check for Location
        location = filters.get("location")
        if location:
            mongo_conditions.append({"lastSeenLocation": {"$regex": location, "$options": "i"}})
            mongo_conditions.append({"policeStation": {"$regex": location, "$options": "i"}})
            mongo_conditions.append({"description": {"$regex": location, "$options": "i"}})

        # 4. Check for Incident Type
        incident_type = filters.get("incident_type")
        if incident_type:
            mongo_conditions.append({"type": {"$regex": incident_type, "$options": "i"}})
            mongo_conditions.append({"description": {"$regex": incident_type, "$options": "i"}})

        # 5. Check for Status
        status_val = filters.get("status")
        if status_val:
            status_clean = str(status_val).lower().replace(" ", "_")
            if "open" in status_clean or "active" in status_clean or "registered" in status_clean or "progress" in status_clean:
                mongo_conditions.append({"status": {"$in": ["complaint_registered", "under_investigation", "in_progress", "searching_cctv"]}})
            elif "closed" in status_clean or "solved" in status_clean or "found" in status_clean:
                mongo_conditions.append({"status": {"$in": ["person_found", "case_closed", "match_confirmed"]}})
            else:
                mongo_conditions.append({"status": {"$regex": status_clean, "$options": "i"}})

        # 6. Check for Priority
        priority_val = filters.get("priority")
        if priority_val:
            mongo_conditions.append({"priority": {"$regex": str(priority_val), "$options": "i"}})

        # 7. Check for raw search terms / words from query
        search_terms = filters.get("search_terms") or []
        for term in search_terms:
            if len(term) >= 3:
                mongo_conditions.append({"missingPersonName": {"$regex": term, "$options": "i"}})
                mongo_conditions.append({"name": {"$regex": term, "$options": "i"}})
                mongo_conditions.append({"description": {"$regex": term, "$options": "i"}})
                mongo_conditions.append({"lastSeenLocation": {"$regex": term, "$options": "i"}})
                mongo_conditions.append({"type": {"$regex": term, "$options": "i"}})
                mongo_conditions.append({"reporterName": {"$regex": term, "$options": "i"}})

        # Build final query
        final_query = {}
        if mongo_conditions:
            final_query = {"$or": mongo_conditions}

        try:
            cursor = collection.find(final_query).sort("createdAt", -1).limit(limit)
            results = await cursor.to_list(length=limit)
            # If specific query produced no results and query was non-empty, fetch recent as fallback
            if not results and final_query:
                fallback_cursor = collection.find({}).sort("createdAt", -1).limit(limit)
                results = await fallback_cursor.to_list(length=limit)
        except Exception as e:
            print(f"Error querying complaints: {e}")
            results = []

        return [_sanitize_doc(doc, "complaints") for doc in results]

    @staticmethod
    async def search_suspect_alerts(query_text: str = "", filters: Dict[str, Any] = None, limit: int = 5) -> List[Dict[str, Any]]:
        """Search suspect alerts by alert ID, suspect name, status, or camera."""
        collection = DatabaseManager.get_collection("suspectalerts")
        filters = filters or {}
        conditions: List[Dict[str, Any]] = []

        # Name or term search
        name = filters.get("person_name")
        if name:
            conditions.append({"suspectLabel": {"$regex": name, "$options": "i"}})

        status_val = filters.get("status")
        if status_val:
            conditions.append({"status": {"$regex": str(status_val), "$options": "i"}})

        for term in (filters.get("search_terms") or []):
            if len(term) >= 3:
                conditions.append({"alertId": {"$regex": term, "$options": "i"}})
                conditions.append({"suspectLabel": {"$regex": term, "$options": "i"}})
                conditions.append({"relayChain.locationName": {"$regex": term, "$options": "i"}})
                conditions.append({"relayChain.cameraName": {"$regex": term, "$options": "i"}})

        final_query = {"$or": conditions} if conditions else {}
        try:
            cursor = collection.find(final_query).sort("createdAt", -1).limit(limit)
            results = await cursor.to_list(length=limit)
        except Exception:
            results = []
        return [_sanitize_doc(doc, "suspectalerts") for doc in results]

    @staticmethod
    async def search_sightings(query_text: str = "", filters: Dict[str, Any] = None, limit: int = 5) -> List[Dict[str, Any]]:
        """Search sightings/recognition logs."""
        collection = DatabaseManager.get_collection("sightings")
        filters = filters or {}
        conditions: List[Dict[str, Any]] = []

        name = filters.get("person_name")
        if name:
            conditions.append({"personName": {"$regex": name, "$options": "i"}})

        location = filters.get("location")
        if location:
            conditions.append({"locationName": {"$regex": location, "$options": "i"}})

        for term in (filters.get("search_terms") or []):
            if len(term) >= 3:
                conditions.append({"personName": {"$regex": term, "$options": "i"}})
                conditions.append({"cameraName": {"$regex": term, "$options": "i"}})
                conditions.append({"locationName": {"$regex": term, "$options": "i"}})

        final_query = {"$or": conditions} if conditions else {}
        try:
            cursor = collection.find(final_query).sort("timestamp", -1).limit(limit)
            results = await cursor.to_list(length=limit)
            if not results:
                # Also try recognitionlogs collection if sightings is empty
                rec_coll = DatabaseManager.get_collection("recognitionlogs")
                rec_cursor = rec_coll.find(final_query).sort("createdAt", -1).limit(limit)
                results = await rec_cursor.to_list(length=limit)
        except Exception:
            results = []
        return [_sanitize_doc(doc, "sightings") for doc in results]

    @staticmethod
    async def search_cameras(query_text: str = "", filters: Dict[str, Any] = None, limit: int = 5) -> List[Dict[str, Any]]:
        """Search surveillance camera network."""
        collection = DatabaseManager.get_collection("cameras")
        filters = filters or {}
        conditions: List[Dict[str, Any]] = []

        location = filters.get("location")
        if location:
            conditions.append({"locationName": {"$regex": location, "$options": "i"}})
            conditions.append({"name": {"$regex": location, "$options": "i"}})
            conditions.append({"zone": {"$regex": location, "$options": "i"}})

        for term in (filters.get("search_terms") or []):
            if len(term) >= 3:
                conditions.append({"name": {"$regex": term, "$options": "i"}})
                conditions.append({"locationName": {"$regex": term, "$options": "i"}})
                conditions.append({"zone": {"$regex": term, "$options": "i"}})

        final_query = {"$or": conditions} if conditions else {}
        try:
            cursor = collection.find(final_query).limit(limit)
            results = await cursor.to_list(length=limit)
        except Exception:
            results = []
        return [_sanitize_doc(doc, "cameras") for doc in results]

    @staticmethod
    async def search_unknown_persons(query_text: str = "", filters: Dict[str, Any] = None, limit: int = 5) -> List[Dict[str, Any]]:
        """Search unknown person identities and clusters."""
        collection = DatabaseManager.get_collection("unknownpersons")
        filters = filters or {}
        conditions: List[Dict[str, Any]] = []

        for term in (filters.get("search_terms") or []):
            if len(term) >= 3:
                conditions.append({"unknownId": {"$regex": term, "$options": "i"}})
                conditions.append({"status": {"$regex": term, "$options": "i"}})
                conditions.append({"tags": {"$regex": term, "$options": "i"}})

        final_query = {"$or": conditions} if conditions else {}
        try:
            cursor = collection.find(final_query).sort("lastSeen", -1).limit(limit)
            results = await cursor.to_list(length=limit)
        except Exception:
            results = []
        return [_sanitize_doc(doc, "unknownpersons") for doc in results]

    @classmethod
    async def multi_retrieve(
        cls, 
        query: str, 
        filters: Dict[str, Any] = None, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Intelligently search across all relevant database collections."""
        filters = filters or {}
        entity_type = (filters.get("entity_type") or "all").lower()
        all_records: List[Dict[str, Any]] = []

        query_lower = query.lower()

        # Decide which collections to query
        want_complaints = entity_type in ["complaint", "all"] or any(k in query_lower for k in ["case", "complaint", "fir", "missing", "victim", "filer", "incident", "theft", "unauthorized"])
        want_alerts = entity_type in ["alert", "all"] or any(k in query_lower for k in ["alert", "chase", "relay", "suspect", "track"])
        want_sightings = entity_type in ["sighting", "all"] or any(k in query_lower for k in ["sight", "seen", "detected", "detection", "face", "camera"])
        want_cameras = entity_type in ["camera", "all"] or any(k in query_lower for k in ["camera", "stream", "cctv", "zone"])
        want_unknowns = entity_type in ["unknown_person", "all"] or any(k in query_lower for k in ["unknown", "cluster", "recurring"])

        # Always default to querying complaints first as primary store
        if want_complaints or not (want_alerts or want_sightings or want_cameras or want_unknowns):
            complaints = await cls.search_complaints(query, filters, limit=limit)
            all_records.extend(complaints)

        if want_alerts:
            alerts = await cls.search_suspect_alerts(query, filters, limit=limit)
            all_records.extend(alerts)

        if want_sightings:
            sightings = await cls.search_sightings(query, filters, limit=limit)
            all_records.extend(sightings)

        if want_cameras:
            cameras = await cls.search_cameras(query, filters, limit=limit)
            all_records.extend(cameras)

        if want_unknowns:
            unknowns = await cls.search_unknown_persons(query, filters, limit=limit)
            all_records.extend(unknowns)

        # Fallback: if nothing found at all, query complaints general
        if not all_records:
            all_records = await cls.search_complaints(query, filters={}, limit=limit)

        return all_records[:limit * 2]
