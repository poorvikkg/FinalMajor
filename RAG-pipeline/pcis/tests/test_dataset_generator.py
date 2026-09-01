"""
Unit tests for Synthetic Dataset Generator Engine and Exporters.
"""

import json
from pathlib import Path
import pytest
import pandas as pd

from src.dataset_generator.engine import DatasetGeneratorEngine


def test_dataset_generator_entity_generation():
    engine = DatasetGeneratorEngine(
        num_stations=5,
        num_officers=10,
        num_persons=20,
        num_cases=10,
        num_case_persons=20,
        num_notes=15,
        num_activities=20,
        num_evidence=10,
        num_documents=12,
        num_attachments=10,
    )
    dataset = engine.generate_all()

    assert len(dataset["police_stations"]) == 5
    assert len(dataset["officers"]) == 10
    assert len(dataset["persons"]) == 20
    assert len(dataset["cases"]) == 10
    assert len(dataset["case_persons"]) == 20
    assert len(dataset["case_notes"]) == 15
    assert len(dataset["activities"]) == 20
    assert len(dataset["evidence"]) == 10
    assert len(dataset["case_documents"]) == 12
    assert len(dataset["attachments"]) == 10


def test_dataset_generator_export_equivalence(temp_sample_dir):
    engine = DatasetGeneratorEngine(
        num_stations=2,
        num_officers=4,
        num_persons=5,
        num_cases=3,
        num_case_persons=5,
        num_notes=5,
        num_activities=5,
        num_evidence=5,
        num_documents=5,
        num_attachments=5,
        output_dir=temp_sample_dir,
    )
    summary = engine.generate_and_export()

    out_base = Path(temp_sample_dir)
    assert (out_base / "json" / "cases.json").exists()
    assert (out_base / "csv" / "cases.csv").exists()
    assert (out_base / "excel" / "cases.xlsx").exists()
    assert (out_base / "excel" / "police_master_dataset.xlsx").exists()

    # Verify JSON count matches CSV count
    with open(out_base / "json" / "cases.json", "r") as f:
        json_data = json.load(f)

    csv_df = pd.read_csv(out_base / "csv" / "cases.csv")
    excel_df = pd.read_excel(out_base / "excel" / "cases.xlsx", engine="openpyxl")

    assert len(json_data) == 3
    assert len(csv_df) == 3
    assert len(excel_df) == 3
