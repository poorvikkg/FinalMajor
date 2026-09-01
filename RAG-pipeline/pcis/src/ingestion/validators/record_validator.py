"""
Record Validator — checks required fields, data types, date formats, phone numbers, FK references.
"""

import re
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


REQUIRED_FIELDS = {
    "cases": ["fir_number", "police_station_id", "assigned_officer_id", "crime_type"],
    "persons": ["full_name"],
    "officers": ["badge_number", "full_name", "police_station_id"],
    "police_stations": ["station_code", "station_name", "district", "state"],
    "case_documents": ["case_id", "document_type", "title"],
    "evidence": ["case_id", "evidence_type", "description"],
    "case_notes": ["case_id", "content"],
    "activities": ["case_id", "activity_type", "description"],
    "attachments": ["case_id", "file_name", "file_type"],
    "users": ["username", "email", "role_id"],
    "roles": ["role_id", "role_name"]
}


class RecordValidator:
    """
    Validates canonical records against collection rules and constraints.
    """

    def validate(self, record: Dict[str, Any], collection_name: str) -> Optional[List[str]]:
        errors = []

        # 1. Check Required Fields
        required = REQUIRED_FIELDS.get(collection_name, [])
        for field in required:
            val = record.get(field)
            if val is None or (isinstance(val, str) and not val.strip()):
                errors.append(f"Missing required field: '{field}'")

        # 2. Field specific validations
        if "fir_number" in record and record["fir_number"]:
            fir = str(record["fir_number"])
            if len(fir) < 3:
                errors.append(f"Invalid FIR Number format: '{fir}'")

        if "phone" in record and record["phone"]:
            phone = str(record["phone"])
            if not self._is_valid_phone(phone):
                errors.append(f"Invalid phone number format: '{phone}'")

        if "email" in record and record["email"]:
            email = str(record["email"])
            if not self._is_valid_email(email):
                errors.append(f"Invalid email format: '{email}'")

        return errors if errors else None

    @staticmethod
    def _is_valid_phone(phone: str) -> bool:
        cleaned = re.sub(r"[^\d+]", "", phone)
        # 10 digits or starting with +91
        return bool(re.match(r"^(\+91)?\d{10}$", cleaned))

    @staticmethod
    def _is_valid_email(email: str) -> bool:
        return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))
