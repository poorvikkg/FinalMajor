"""
Duplicate Checker Engine — cross-collection deduplication.
"""

import logging
from typing import Any, Dict, Set, Optional
from src.config.database import DatabaseManager

logger = logging.getLogger(__name__)


class Deduplicator:
    """
    Detects duplicate records in-batch and against MongoDB database.
    """

    def __init__(self):
        # In-memory batch cache to detect duplicate records within the same imported file
        self.seen_keys: Set[str] = set()

    def reset_batch_cache(self):
        self.seen_keys.clear()

    async def is_duplicate(self, record: Dict[str, Any], collection_name: str) -> bool:
        dup_key = self._extract_dedup_key(record, collection_name)
        if not dup_key:
            return False

        # 1. Check in-batch cache
        if dup_key in self.seen_keys:
            logger.info(f"Duplicate detected in batch: key='{dup_key}'")
            return True
        
        self.seen_keys.add(dup_key)

        # 2. Check Database if MongoDB is connected
        try:
            db = DatabaseManager.get_database()
            query = self._build_db_query(record, collection_name)
            if query:
                existing = await db[collection_name].find_one(query)
                if existing:
                    logger.info(f"Duplicate detected in database collection '{collection_name}': query={query}")
                    return True
        except Exception as e:
            # If DB is not connected (e.g. offline dry run), continue with batch deduplication only
            pass

        return False

    @staticmethod
    def _extract_dedup_key(record: Dict[str, Any], collection_name: str) -> Optional[str]:
        if collection_name == "cases":
            if record.get("fir_number"):
                return f"cases:fir:{record['fir_number']}"
            if record.get("case_id"):
                return f"cases:id:{record['case_id']}"
        elif collection_name == "persons":
            if record.get("person_id"):
                return f"persons:id:{record['person_id']}"
            if record.get("full_name") and record.get("phone"):
                return f"persons:name_phone:{record['full_name']}:{record['phone']}"
        elif collection_name == "officers":
            if record.get("badge_number"):
                return f"officers:badge:{record['badge_number']}"
            if record.get("officer_id"):
                return f"officers:id:{record['officer_id']}"
        elif collection_name == "police_stations":
            if record.get("station_code"):
                return f"stations:code:{record['station_code']}"
            if record.get("station_id"):
                return f"stations:id:{record['station_id']}"
        elif collection_name == "attachments":
            if record.get("checksum_sha256"):
                return f"attachments:hash:{record['checksum_sha256']}"

        # Fallback to ID if present
        for key in ["id", "_id", f"{collection_name[:-1]}_id"]:
            if record.get(key):
                return f"{collection_name}:{key}:{record[key]}"
        return None

    @staticmethod
    def _build_db_query(record: Dict[str, Any], collection_name: str) -> Optional[Dict[str, Any]]:
        if collection_name == "cases":
            if record.get("fir_number"):
                return {"fir_number": record["fir_number"]}
            if record.get("case_id"):
                return {"case_id": record["case_id"]}
        elif collection_name == "persons":
            if record.get("person_id"):
                return {"person_id": record["person_id"]}
            if record.get("full_name") and record.get("phone"):
                return {"full_name": record["full_name"], "phone": record["phone"]}
        elif collection_name == "officers":
            if record.get("badge_number"):
                return {"badge_number": record["badge_number"]}
        elif collection_name == "police_stations":
            if record.get("station_code"):
                return {"station_code": record["station_code"]}
        elif collection_name == "attachments":
            if record.get("checksum_sha256"):
                return {"checksum_sha256": record["checksum_sha256"]}
        return None
