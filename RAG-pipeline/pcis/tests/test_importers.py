"""
Unit tests for CSV, Excel, and JSON Importers & Ingestion Pipeline.
"""

import json
from pathlib import Path
import pytest

from src.ingestion.pipeline import IngestionPipeline
from src.dataset_generator.engine import DatasetGeneratorEngine


@pytest.mark.asyncio
async def test_ingestion_pipeline_with_sample_files(temp_sample_dir):
    # 1. Generate sample dataset
    engine = DatasetGeneratorEngine(
        num_stations=2,
        num_officers=2,
        num_persons=5,
        num_cases=2,
        output_dir=temp_sample_dir,
    )
    engine.generate_and_export()

    out_base = Path(temp_sample_dir)
    pipeline = IngestionPipeline(log_dir=str(out_base / "logs"))

    # 2. Test JSON Import
    json_path = str(out_base / "json" / "cases.json")
    report_json = await pipeline.ingest_file(json_path, collection_name="cases")
    assert report_json["stats"]["total_parsed"] == 2
    assert report_json["stats"]["total_valid"] == 2

    # 3. Test CSV Import
    csv_path = str(out_base / "csv" / "cases.csv")
    report_csv = await pipeline.ingest_file(csv_path, collection_name="cases")
    assert report_csv["stats"]["total_parsed"] == 2

    # 4. Test Excel Import
    excel_path = str(out_base / "excel" / "cases.xlsx")
    report_excel = await pipeline.ingest_file(excel_path, collection_name="cases")
    assert report_excel["stats"]["total_parsed"] == 2
