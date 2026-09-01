"""
Base Importer — Abstract Base Class defining the contract for all data importers.
Follows SOLID Open/Closed principle — new format importers subclass BaseImporter.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import logging
import time

logger = logging.getLogger(__name__)


class BaseImporter(ABC):
    """
    Abstract importer interface for CSV, Excel, JSON, PDF, and API ingestion.

    Subclasses implement format-specific file parsing in `parse()`.
    Common validation, field mapping/normalization, duplicate checking,
    and storage are orchestrated in `run()`.
    """

    def __init__(self, collection_name: str, validator=None, normalizer=None, deduplicator=None):
        self.collection_name = collection_name
        self.validator = validator
        self.normalizer = normalizer
        self.deduplicator = deduplicator
        
        self.errors: List[Dict[str, Any]] = []
        self.stats = {
            "total_parsed": 0,
            "total_valid": 0,
            "total_duplicates": 0,
            "total_errors": 0,
            "total_imported": 0,
            "processing_time_ms": 0.0,
        }

    @abstractmethod
    async def parse(self, source_path: str) -> List[Dict[str, Any]]:
        """
        Parse raw source file into a list of dictionaries with source-native field names.
        """
        pass

    def map_fields(self, raw_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw record to canonical PCIS schema using normalizer.
        """
        if self.normalizer:
            return self.normalizer.normalize(raw_record, self.collection_name)
        return raw_record

    def validate(self, record: Dict[str, Any]) -> Optional[List[str]]:
        """
        Validate record against schema and business rules using validator.
        Returns None if valid, or list of error messages if invalid.
        """
        if self.validator:
            return self.validator.validate(record, self.collection_name)
        return None

    async def deduplicate(self, record: Dict[str, Any]) -> bool:
        """
        Check if record is a duplicate in DB or batch using deduplicator.
        Returns True if duplicate.
        """
        if self.deduplicator:
            return await self.deduplicator.is_duplicate(record, self.collection_name)
        return False

    async def store(self, record: Dict[str, Any], repository: Any) -> str:
        """
        Persist normalized record to MongoDB via repository.
        """
        if repository:
            doc_id = await repository.create(record)
            return str(doc_id)
        return "stored"

    async def run(self, source_path: str, repository: Any = None) -> Dict[str, Any]:
        """
        Execute full ingestion pipeline:
        Parse → Map/Normalize → Validate → Deduplicate → Store
        """
        start_time = time.time()
        logger.info(f"Executing import pipeline: collection='{self.collection_name}', path='{source_path}'")

        try:
            raw_records = await self.parse(source_path)
            self.stats["total_parsed"] = len(raw_records)
        except Exception as e:
            logger.error(f"Failed to parse source file '{source_path}': {str(e)}")
            self.errors.append({"row": -1, "error": f"File parsing error: {str(e)}", "record": {}})
            self.stats["total_errors"] += 1
            self.stats["processing_time_ms"] = round((time.time() - start_time) * 1000, 2)
            return {
                "collection": self.collection_name,
                "source_path": source_path,
                "stats": self.stats,
                "errors": self.errors,
            }

        for idx, raw in enumerate(raw_records, 1):
            try:
                # 1. Normalize
                canonical = self.map_fields(raw)

                # 2. Validate
                val_errors = self.validate(canonical)
                if val_errors:
                    self.errors.append({"row": idx, "errors": val_errors, "record": raw})
                    self.stats["total_errors"] += 1
                    continue

                self.stats["total_valid"] += 1

                # 3. Deduplicate
                is_dup = await self.deduplicate(canonical)
                if is_dup:
                    self.stats["total_duplicates"] += 1
                    continue

                # 4. Store
                await self.store(canonical, repository)
                self.stats["total_imported"] += 1

            except Exception as e:
                logger.error(f"Error processing record {idx}: {str(e)}")
                self.errors.append({"row": idx, "errors": [str(e)], "record": raw})
                self.stats["total_errors"] += 1

        self.stats["processing_time_ms"] = round((time.time() - start_time) * 1000, 2)
        logger.info(f"Import complete for '{self.collection_name}': {self.stats}")

        return {
            "collection": self.collection_name,
            "source_path": source_path,
            "stats": self.stats,
            "errors": self.errors[:100],  # Cap log size
        }
