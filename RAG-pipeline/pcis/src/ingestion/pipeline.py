"""
Data Ingestion Pipeline Orchestrator.
Orchestrates Source File Parsing, Validation, Normalization, Deduplication, MongoDB Persistence, and Reporting.
"""

import logging
from pathlib import Path
from typing import Any, Dict, Optional

from src.ingestion.importers.csv_importer import CSVImporter
from src.ingestion.importers.excel_importer import ExcelImporter
from src.ingestion.importers.json_importer import JSONImporter
from src.ingestion.importers.pdf_importer import PDFImporter
from src.ingestion.validators.record_validator import RecordValidator
from src.ingestion.normalizers.canonical_normalizer import CanonicalNormalizer
from src.ingestion.duplicate_checker.deduplicator import Deduplicator
from src.ingestion.reporter import ImportReporter
from src.config.database import DatabaseManager

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """
    Unified Ingestion Pipeline Manager.
    Automatically selects the appropriate format importer and runs end-to-end ingestion.
    """

    def __init__(self, log_dir: str = "logs"):
        self.validator = RecordValidator()
        self.normalizer = CanonicalNormalizer()
        self.deduplicator = Deduplicator()
        self.reporter = ImportReporter(log_dir=log_dir)

    async def ingest_file(
        self,
        file_path: str,
        collection_name: str,
        file_type: Optional[str] = None
    ) -> Dict[str, Any]:
        path = Path(file_path)
        ext = file_type.lower() if file_type else path.suffix.lstrip(".").lower()

        self.deduplicator.reset_batch_cache()

        # Select Importer strategy
        if ext == "csv":
            importer = CSVImporter(
                collection_name, self.validator, self.normalizer, self.deduplicator
            )
        elif ext in ["xlsx", "xls", "excel"]:
            importer = ExcelImporter(
                collection_name, sheet_name=None, validator=self.validator, normalizer=self.normalizer, deduplicator=self.deduplicator
            )
        elif ext == "json":
            importer = JSONImporter(
                collection_name, self.validator, self.normalizer, self.deduplicator
            )
        elif ext == "pdf":
            importer = PDFImporter(
                collection_name, self.validator, self.normalizer, self.deduplicator
            )
        else:
            raise ValueError(f"Unsupported file format extension: '.{ext}'")

        # Get MongoDB repository if database is connected
        repo = None
        try:
            db = DatabaseManager.get_database()
            repo = DummyRepository(db[collection_name])
        except Exception:
            logger.info("MongoDB not connected. Pipeline running in dry-run mode (parsing/validation/dedup only).")

        # Run pipeline
        results = await importer.run(file_path, repository=repo)

        # Generate report
        report = self.reporter.generate_report(results)
        return report


class DummyRepository:
    def __init__(self, collection):
        self.collection = collection

    async def create(self, doc: dict) -> str:
        res = await self.collection.insert_one(doc)
        return str(res.inserted_id)
