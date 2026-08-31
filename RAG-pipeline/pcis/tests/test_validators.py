"""
Unit tests for Record Validator.
"""

from src.ingestion.validators.record_validator import RecordValidator


def test_validator_required_fields():
    validator = RecordValidator()
    invalid_record = {"fir_number": "FIR/2025/001"}  # Missing station_id, assigned_officer_id, crime_type

    errors = validator.validate(invalid_record, collection_name="cases")
    assert errors is not None
    assert any("police_station_id" in err for err in errors)

    valid_record = {
        "fir_number": "FIR/2025/001",
        "police_station_id": "STATION-01",
        "assigned_officer_id": "OFFICER-01",
        "crime_type": "THEFT"
    }
    assert validator.validate(valid_record, collection_name="cases") is None


def test_validator_phone_and_email():
    validator = RecordValidator()
    bad_phone = {"full_name": "Test User", "phone": "123"}
    errors = validator.validate(bad_phone, collection_name="persons")
    assert errors is not None
    assert any("phone number format" in err for err in errors)

    good_phone = {"full_name": "Test User", "phone": "+91-9876543210"}
    assert validator.validate(good_phone, collection_name="persons") is None
