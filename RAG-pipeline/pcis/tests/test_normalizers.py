"""
Unit tests for Canonical Normalizer.
"""

from src.ingestion.normalizers.canonical_normalizer import CanonicalNormalizer


def test_canonical_normalizer_column_alias_mapping():
    normalizer = CanonicalNormalizer()
    raw = {
        "Case_ID": "CASE-9999",
        "FIR No.": "FIR/2025/MUM/0001",
        "station_code": "STATION-01",
        "assigned_officer_badge": "OFFICER-01",
        "phone_number": "9876543210"
    }

    normalized = normalizer.normalize(raw, collection_name="cases")

    assert normalized["case_id"] == "CASE-9999"
    assert normalized["fir_number"] == "FIR/2025/MUM/0001"
    assert normalized["police_station_id"] == "STATION-01"
    assert normalized["assigned_officer_id"] == "OFFICER-01"


def test_canonical_normalizer_phone_and_date():
    normalizer = CanonicalNormalizer()
    raw = {
        "full_name": "  Amit Sharma  ",
        "phone": "9876543210",
        "registration_date": "2025-05-15 14:30:00"
    }

    normalized = normalizer.normalize(raw, collection_name="persons")

    assert normalized["full_name"] == "Amit Sharma"
    assert normalized["phone"] == "+91-9876543210"
    assert normalized["registration_date"] == "2025-05-15T14:30:00"
