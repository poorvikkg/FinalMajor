"""
Multi-format dataset exporters (JSON, CSV, Excel).
Stores exported datasets under sample_data/ ensuring 100% data equivalence.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any
import pandas as pd


class DatasetExporter:
    """
    Exports synthetic dataset dictionaries to JSON, CSV, and Excel (.xlsx).
    Guarantees cross-format data consistency.
    """

    def __init__(self, output_base_dir: str = "sample_data"):
        self.output_base_dir = Path(output_base_dir)
        self.json_dir = self.output_base_dir / "json"
        self.csv_dir = self.output_base_dir / "csv"
        self.excel_dir = self.output_base_dir / "excel"

        self._ensure_directories()

    def _ensure_directories(self):
        self.json_dir.mkdir(parents=True, exist_ok=True)
        self.csv_dir.mkdir(parents=True, exist_ok=True)
        self.excel_dir.mkdir(parents=True, exist_ok=True)

    def export_all(self, dataset: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[str]]:
        """
        Export all collections across JSON, CSV, and Excel.
        Returns dictionary of created file paths per format.
        """
        created_files = {"json": [], "csv": [], "excel": []}

        # 1. Export JSON
        for collection_name, records in dataset.items():
            json_file = self.json_dir / f"{collection_name}.json"
            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2, default=str)
            created_files["json"].append(str(json_file))

        # Combined JSON
        combined_json = self.json_dir / "all_collections.json"
        with open(combined_json, "w", encoding="utf-8") as f:
            json.dump(dataset, f, indent=2, default=str)
        created_files["json"].append(str(combined_json))

        # 2. Export CSV & Excel
        # Master Excel writer for multi-sheet workbook
        master_excel_path = self.excel_dir / "police_master_dataset.xlsx"

        with pd.ExcelWriter(master_excel_path, engine="openpyxl") as master_writer:
            for collection_name, records in dataset.items():
                if not records:
                    continue

                # Prepare flattened records for CSV/Excel compatibility
                flattened_records = [self._flatten_record(r) for r in records]
                df = pd.DataFrame(flattened_records)

                # Export individual CSV
                csv_file = self.csv_dir / f"{collection_name}.csv"
                df.to_csv(csv_file, index=False, encoding="utf-8")
                created_files["csv"].append(str(csv_file))

                # Export individual Excel file
                excel_file = self.excel_dir / f"{collection_name}.xlsx"
                df.to_excel(excel_file, index=False, engine="openpyxl")
                created_files["excel"].append(str(excel_file))

                # Write sheet to Master Excel workbook (cap sheet name to 31 chars for Excel limit)
                sheet_name = collection_name[:31]
                df.to_excel(master_writer, sheet_name=sheet_name, index=False)

        created_files["excel"].append(str(master_excel_path))
        return created_files

    @staticmethod
    def _flatten_record(record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Flatten complex nested dicts/lists into JSON strings for tabular exports (CSV/Excel).
        """
        flat = {}
        for key, value in record.items():
            if isinstance(value, (dict, list)):
                flat[key] = json.dumps(value, default=str)
            else:
                flat[key] = value
        return flat
