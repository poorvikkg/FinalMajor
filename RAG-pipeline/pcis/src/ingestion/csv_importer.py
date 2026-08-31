"""
CSV Importer — ingests CSV files into the canonical PCIS schema.
"""

import csv
from datetime import datetime
from typing import Any, Dict, List, Optional
import logging

from src.ingestion.base_importer import BaseImporter

logger = logging.getLogger(__name__)


class CSVImporter(BaseImporter):
    """
    Imports data from CSV files using configurable field mappings.

    Usage:
        mapping = {
            "FIR No.": {"field": "fir_number", "transform": "trim"},
            "Crime Head": {"field": "crime_type", "transform": "upper"},
            ...
        }
        importer = CSVImporter("state_export", "cases", mapping)
        result = await importer.run("data/cases.csv")
    """

    def __init__(
        self,
        source_name: str,
        collection: str,
        field_mapping: Dict[str, Dict[str, Any]],
        defaults: Dict[str, Any] | None = None,
        encoding: str = "utf-8",
        delimiter: str = ",",
    ):
        super().__init__(source_name, collection)
        self.field_mapping = field_mapping
        self.defaults = defaults or {}
        self.encoding = encoding
        self.delimiter = delimiter

    async def parse(self, source_path: str) -> List[Dict[str, Any]]:
        """Read CSV file into list of dicts."""
        records = []
        with open(source_path, "r", encoding=self.encoding) as f:
            reader = csv.DictReader(f, delimiter=self.delimiter)
            for row in reader:
                records.append(dict(row))
        return records

    def map_fields(self, raw_record: Dict[str, Any]) -> Dict[str, Any]:
        """Apply field mappings to transform raw CSV row to canonical schema."""
        canonical = dict(self.defaults)

        for source_field, config in self.field_mapping.items():
            raw_value = raw_record.get(source_field, "")
            target_field = config["field"]
            transform = config.get("transform", "none")

            canonical[target_field] = self._apply_transform(
                raw_value, transform, config
            )

        now = datetime.utcnow()
        canonical.setdefault("created_at", now)
        canonical.setdefault("updated_at", now)

        return canonical

    def _apply_transform(
        self, value: Any, transform: str, config: Dict[str, Any]
    ) -> Any:
        """Apply a named transformation to a field value."""
        if value is None or (isinstance(value, str) and not value.strip()):
            return config.get("default", None)

        if transform == "trim":
            return str(value).strip()
        elif transform == "upper":
            return str(value).strip().upper()
        elif transform == "lower":
            return str(value).strip().lower()
        elif transform == "int":
            try:
                return int(value)
            except (ValueError, TypeError):
                return None
        elif transform == "float":
            try:
                return float(value)
            except (ValueError, TypeError):
                return None
        elif transform == "parse_date":
            fmt = config.get("format", "%Y-%m-%d")
            try:
                return datetime.strptime(str(value).strip(), fmt)
            except ValueError:
                return None
        elif transform == "enum_map":
            mapping = config.get("map", {})
            return mapping.get(str(value).strip(), str(value).strip().upper())
        elif transform == "split":
            separator = config.get("separator", ",")
            return [s.strip() for s in str(value).split(separator) if s.strip()]
        else:
            return value

    def validate(self, record: Dict[str, Any]) -> Optional[str]:
        """Basic validation — check required fields are non-empty."""
        required = ["fir_number"] if self.collection == "cases" else []
        for field in required:
            if not record.get(field):
                return f"Missing required field: {field}"
        return None
