"""
Concrete MongoDB repository implementations for all collections.

Each repository extends MongoBaseRepository and implements
the abstract methods defined in the application interfaces.
"""

from typing import Any, Dict, List, Optional

from src.infrastructure.database.mongodb.base_repository import MongoBaseRepository


# ─── Police Stations ─────────────────────────────────────────────────────


class MongoStationRepository(MongoBaseRepository):
    collection_name = "police_stations"
    id_field = "station_id"

    async def get_by_code(self, station_code: str) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()
        doc = await collection.find_one({"station_code": station_code})
        return self._serialize(doc) if doc else None


# ─── Officers ────────────────────────────────────────────────────────────


class MongoOfficerRepository(MongoBaseRepository):
    collection_name = "officers"
    id_field = "officer_id"

    async def get_by_badge_number(self, badge_number: str) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()
        doc = await collection.find_one({"badge_number": badge_number})
        return self._serialize(doc) if doc else None

    async def get_by_station(self, station_id: str) -> List[Dict[str, Any]]:
        return await self.list(
            filters={"station_id": station_id, "employment_status": "ACTIVE"}
        )


# ─── Cases ───────────────────────────────────────────────────────────────


class MongoCaseRepository(MongoBaseRepository):
    collection_name = "cases"
    id_field = "case_id"

    async def get_by_fir_number(self, fir_number: str) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()
        doc = await collection.find_one({"fir_number": fir_number})
        return self._serialize(doc) if doc else None

    async def get_by_station(
        self, station_id: str, skip: int = 0, limit: int = 50
    ) -> List[Dict[str, Any]]:
        return await self.list(
            filters={"police_station_id": station_id},
            skip=skip,
            limit=limit,
            sort_by="created_at",
        )

    async def get_by_officer(
        self, officer_id: str, skip: int = 0, limit: int = 50
    ) -> List[Dict[str, Any]]:
        return await self.list(
            filters={"assigned_officer_id": officer_id},
            skip=skip,
            limit=limit,
            sort_by="created_at",
        )

    async def search_text(
        self, query: str, skip: int = 0, limit: int = 20
    ) -> List[Dict[str, Any]]:
        return await self.text_search(query, skip, limit)

    async def get_dashboard_stats(
        self, station_id: str | None = None
    ) -> Dict[str, Any]:
        collection = self._get_collection()
        match_stage = {}
        if station_id:
            match_stage = {"police_station_id": station_id}

        pipeline = [
            {"$match": match_stage} if match_stage else {"$match": {}},
            {
                "$facet": {
                    "by_status": [
                        {"$group": {"_id": "$current_status", "count": {"$sum": 1}}}
                    ],
                    "by_crime_type": [
                        {"$group": {"_id": "$crime_type", "count": {"$sum": 1}}}
                    ],
                    "by_priority": [
                        {"$group": {"_id": "$priority", "count": {"$sum": 1}}}
                    ],
                    "total": [{"$count": "count"}],
                }
            },
        ]

        results = await collection.aggregate(pipeline).to_list(1)
        if not results:
            return {"by_status": {}, "by_crime_type": {}, "by_priority": {}, "total": 0}

        data = results[0]
        return {
            "by_status": {r["_id"]: r["count"] for r in data.get("by_status", [])},
            "by_crime_type": {r["_id"]: r["count"] for r in data.get("by_crime_type", [])},
            "by_priority": {r["_id"]: r["count"] for r in data.get("by_priority", [])},
            "total": data["total"][0]["count"] if data.get("total") else 0,
        }


# ─── Persons ─────────────────────────────────────────────────────────────


class MongoPersonRepository(MongoBaseRepository):
    collection_name = "persons"
    id_field = "person_id"

    async def search_by_name(
        self, name: str, skip: int = 0, limit: int = 20
    ) -> List[Dict[str, Any]]:
        collection = self._get_collection()
        # Use regex for partial name matching
        cursor = (
            collection.find({"display_name": {"$regex": name, "$options": "i"}})
            .skip(skip)
            .limit(limit)
        )
        results = []
        async for doc in cursor:
            results.append(self._serialize(doc))
        return results

    async def find_duplicates(
        self, name: str, dob: str | None = None, phone: str | None = None
    ) -> List[Dict[str, Any]]:
        collection = self._get_collection()
        query: Dict[str, Any] = {
            "display_name": {"$regex": name, "$options": "i"}
        }
        if dob:
            query["date_of_birth"] = dob
        if phone:
            query["phone"] = phone

        cursor = collection.find(query).limit(10)
        results = []
        async for doc in cursor:
            results.append(self._serialize(doc))
        return results


# ─── Case Persons (Junction) ────────────────────────────────────────────


class MongoCasePersonRepository(MongoBaseRepository):
    collection_name = "case_persons"
    id_field = "case_person_id"

    async def get_persons_for_case(
        self, case_id: str, role: str | None = None
    ) -> List[Dict[str, Any]]:
        filters: Dict[str, Any] = {"case_id": case_id}
        if role:
            filters["role_in_case"] = role
        return await self.list(filters=filters, limit=200)

    async def get_cases_for_person(
        self, person_id: str
    ) -> List[Dict[str, Any]]:
        return await self.list(filters={"person_id": person_id}, limit=200)


# ─── Case Documents ─────────────────────────────────────────────────────


class MongoDocumentRepository(MongoBaseRepository):
    collection_name = "case_documents"
    id_field = "document_id"

    async def get_by_case(
        self, case_id: str, doc_type: str | None = None
    ) -> List[Dict[str, Any]]:
        filters: Dict[str, Any] = {"case_id": case_id}
        if doc_type:
            filters["document_type"] = doc_type
        return await self.list(filters=filters, sort_by="upload_date")

    async def search_ocr_text(
        self, query: str, skip: int = 0, limit: int = 20
    ) -> List[Dict[str, Any]]:
        return await self.text_search(query, skip, limit)


# ─── Attachments ─────────────────────────────────────────────────────────


class MongoAttachmentRepository(MongoBaseRepository):
    collection_name = "attachments"
    id_field = "attachment_id"

    async def get_by_document(self, document_id: str) -> List[Dict[str, Any]]:
        return await self.list(filters={"document_id": document_id})

    async def get_by_case(self, case_id: str) -> List[Dict[str, Any]]:
        return await self.list(filters={"case_id": case_id})


# ─── Evidence ────────────────────────────────────────────────────────────


class MongoEvidenceRepository(MongoBaseRepository):
    collection_name = "evidence"
    id_field = "evidence_id"

    async def get_by_case(self, case_id: str) -> List[Dict[str, Any]]:
        return await self.list(filters={"case_id": case_id}, sort_by="collection_date")


# ─── Case Notes ──────────────────────────────────────────────────────────


class MongoCaseNoteRepository(MongoBaseRepository):
    collection_name = "case_notes"
    id_field = "note_id"

    async def get_by_case(
        self, case_id: str, confidentiality_level: str | None = None
    ) -> List[Dict[str, Any]]:
        filters: Dict[str, Any] = {"case_id": case_id}
        if confidentiality_level:
            filters["confidentiality_level"] = confidentiality_level
        return await self.list(filters=filters, sort_by="created_at")


# ─── Activities ──────────────────────────────────────────────────────────


class MongoActivityRepository(MongoBaseRepository):
    collection_name = "activities"
    id_field = "activity_id"

    async def get_by_case(
        self, case_id: str, skip: int = 0, limit: int = 100
    ) -> List[Dict[str, Any]]:
        return await self.list(
            filters={"case_id": case_id},
            skip=skip,
            limit=limit,
            sort_by="timestamp",
            sort_order=-1,
        )

    async def update(self, entity_id: str, update_data: Dict[str, Any]) -> bool:
        raise NotImplementedError("Activity records are immutable (append-only).")

    async def delete(self, entity_id: str) -> bool:
        raise NotImplementedError("Activity records are immutable (append-only).")


# ─── Users ───────────────────────────────────────────────────────────────


class MongoUserRepository(MongoBaseRepository):
    collection_name = "users"
    id_field = "user_id"

    async def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()
        doc = await collection.find_one({"username": username})
        return self._serialize(doc) if doc else None


# ─── Roles ───────────────────────────────────────────────────────────────


class MongoRoleRepository(MongoBaseRepository):
    collection_name = "roles"
    id_field = "role_id"

    async def get_by_name(self, role_name: str) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()
        doc = await collection.find_one({"role_name": role_name})
        return self._serialize(doc) if doc else None
