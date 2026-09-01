"""
CSV Data Importer Implementation.
"""

import json
import logging
from typing import Any, Dict, List
import pandas as pd

from src.ingestion.importers.base import BaseImporter

logger = logging.getLogger(__name__)


class CSVImporter(BaseImporter):
    """
    Parses CSV files into raw dictionary records.
    Handles JSON string column decoding for nested fields.
    """

    async def parse(self, source_path: str) -> List[Dict[str, Any]]:
        logger.info(f"Parsing CSV file: {source_path}")
        df = pd.read_csv(source_path, dtype=str)
        # Fill NaN values with empty string or None
        df = df.where(pd.notnull(df), None)

        records = df.to_dict(orient="records")
        parsed_records = []

        for row in records:
            cleaned_row = {}
            for col, val in row.items():
                if val is None or val == "":
                    cleaned_row[col] = None
                    continue

                # Attempt to decode JSON strings (lists/dicts exported in CSV)
                if isinstance(val, str) and (val.startswith("{") or val.startswith("[")):
                    try:
                        cleaned_row[col] = json.loads(val)
                        continue
                    except json.JSONDecodeError:
                        pass
                
                cleaned_row[col] = val
            parsed_records.append(cleaned_row)

        return parsed_records
