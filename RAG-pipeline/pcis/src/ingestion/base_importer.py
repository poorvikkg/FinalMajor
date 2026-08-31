"""
Base Importer — Abstract base class for all data importers.

Every ingestion source (CSV, Excel, JSON, PDF, API) must implement
this interface to normalize data into the canonical PCIS schema.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class BaseImporter(ABC):
    """
    Abstract importer that defines the ingestion contract.

    Subclasses must implement:
    - parse(): Read source data into raw records
    - map_fields(): Transform raw records to canonical schema
    - validate(): Validate canonical records

    The `run()` method orchestrates the full pipeline:
    parse → map → validate → deduplicate → store
    """

    def __init__(self, source_name: str, collection: str):
        self.source_name = source_name
        self.collection = collection
        self.errors: List[Dict[str, Any]] = []
        self.stats = {
            "total_parsed": 0,
            "total_valid": 0,
            "total_duplicates": 0,
            "total_errors": 0,
            "total_imported": 0,
        }

    @abstractmethod
    async def parse(self, source_path: str) -> List[Dict[str, Any]]:
        """
        Parse the source file into a list of raw records.
        Each record is a dict with source-native field names.
        """
        ...

    @abstractmethod
    def map_fields(self, raw_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a single raw record into the canonical schema.
        Apply field mappings, type conversions, and default values.
        """
        ...

    @abstractmethod
    def validate(self, record: Dict[str, Any]) -> Optional[str]:
        """
        Validate a canonical record. Returns None if valid,
        or an error message string if invalid.
        """
        ...

    async def deduplicate(
        self, record: Dict[str, Any]
    ) -> bool:
        """
        Check if this record is a duplicate. Returns True if duplicate.
        Override in subclasses for collection-specific dedup logic.
        """
        return False

    async def store(self, record: Dict[str, Any]) -> str:
        """
        Store a validated record in the database.
        Override in subclasses to use the appropriate repository.
        """
        raise NotImplementedError("Subclasses must implement store()")

    async def run(self, source_path: str) -> Dict[str, Any]:
        """
        Execute the full ingestion pipeline.
        Returns import statistics.
        """
        logger.info(
            f"Starting import: source={self.source_name}, "
            f"collection={self.collection}, path={source_path}"
        )

        # 1. Parse
        raw_records = await self.parse(source_path)
        self.stats["total_parsed"] = len(raw_records)
        logger.info(f"Parsed {len(raw_records)} records")

        # 2. Map, Validate, Dedup, Store
        for i, raw in enumerate(raw_records):
            try:
                # Map fields
                canonical = self.map_fields(raw)

                # Validate
                error = self.validate(canonical)
                if error:
                    self.errors.append({"row": i, "error": error, "record": raw})
                    self.stats["total_errors"] += 1
                    continue

                self.stats["total_valid"] += 1

                # Deduplicate
                is_dup = await self.deduplicate(canonical)
                if is_dup:
                    self.stats["total_duplicates"] += 1
                    continue

                # Store
                await self.store(canonical)
                self.stats["total_imported"] += 1

            except Exception as e:
                self.errors.append({"row": i, "error": str(e), "record": raw})
                self.stats["total_errors"] += 1
                logger.error(f"Error importing row {i}: {e}")

        logger.info(f"Import complete: {self.stats}")
        return {
            "source": self.source_name,
            "collection": self.collection,
            "stats": self.stats,
            "errors": self.errors[:50],  # Cap error output
        }
