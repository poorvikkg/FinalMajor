"""
Excel Data Importer Implementation (.xlsx, .xls).
"""

import json
import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from src.ingestion.importers.base import BaseImporter

logger = logging.getLogger(__name__)


class ExcelImporter(BaseImporter):
    """
    Parses Excel workbooks into raw dictionary records using OpenPyXL / Pandas.
    Supports single sheet or auto-matching sheet name with collection_name.
    """

    def __init__(
        self,
        collection_name: str,
        sheet_name: Optional[str] = None,
        validator=None,
        normalizer=None,
        deduplicator=None,
    ):
        super().__init__(collection_name, validator, normalizer, deduplicator)
        self.sheet_name = sheet_name

    async def parse(self, source_path: str) -> List[Dict[str, Any]]:
        logger.info(f"Parsing Excel file: {source_path}")
        excel_file = pd.ExcelFile(source_path, engine="openpyxl")
        sheet_to_use = self.sheet_name

        if not sheet_to_use:
            # Try matching collection name or capped sheet name
            matching = [s for s in excel_file.sheet_names if s.lower() == self.collection_name[:31].lower()]
            if matching:
                sheet_to_use = matching[0]
            else:
                sheet_to_use = excel_file.sheet_names[0]  # Fallback to first sheet

        logger.info(f"Reading Excel sheet: '{sheet_to_use}'")
        df = pd.read_excel(excel_file, sheet_name=sheet_to_use, dtype=str)
        df = df.where(pd.notnull(df), None)

        records = df.to_dict(orient="records")
        parsed_records = []

        for row in records:
            cleaned_row = {}
            for col, val in row.items():
                if val is None or val == "":
                    cleaned_row[col] = None
                    continue

                if isinstance(val, str) and (val.startswith("{") or val.startswith("[")):
                    try:
                        cleaned_row[col] = json.loads(val)
                        continue
                    except json.JSONDecodeError:
                        pass

                cleaned_row[col] = val
            parsed_records.append(cleaned_row)

        return parsed_records
