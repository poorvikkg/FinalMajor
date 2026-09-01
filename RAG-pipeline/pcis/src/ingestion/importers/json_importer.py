"""
JSON Data Importer Implementation.
"""

import json
import logging
from typing import Any, Dict, List
from pathlib import Path

from src.ingestion.importers.base import BaseImporter

logger = logging.getLogger(__name__)


class JSONImporter(BaseImporter):
    """
    Parses JSON files into raw dictionary records.
    Handles JSON arrays or master dictionary files with key matching `collection_name`.
    """

    async def parse(self, source_path: str) -> List[Dict[str, Any]]:
        logger.info(f"Parsing JSON file: {source_path}")
        with open(source_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            # Check if key matching collection_name exists
            if self.collection_name in data and isinstance(data[self.collection_name], list):
                return data[self.collection_name]
            # Fallback to returning the single dict as a 1-item list
            return [data]
        else:
            raise ValueError(f"Unsupported JSON root structure: {type(data)}")
