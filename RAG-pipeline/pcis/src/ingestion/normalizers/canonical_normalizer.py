"""
Canonical Normalizer — maps column aliases and normalizes field types/formats.
"""

import logging
import re
from datetime import datetime
from typing import Any, Dict

logger = logging.getLogger(__name__)


FIELD_MAPPINGS = {
    "cases": {
        "Case_ID": "case_id",
        "caseNumber": "case_id",
        "FIR No.": "fir_number",
        "FIR_No": "fir_number",
        "firNo": "fir_number",
        "Complaint ID": "case_id",
        "station_code": "police_station_id",
        "assigned_officer_badge": "assigned_officer_id",
        "crimeType": "crime_type",
        "incidentDate": "incident_date",
        "registrationDate": "registration_date",
        "shortSummary": "short_summary",
        "detailedDescription": "detailed_description",
    },
    "persons": {
        "personId": "person_id",
        "Person_ID": "person_id",
        "fullName": "full_name",
        "Name": "full_name",
        "DOB": "date_of_birth",
        "dob": "date_of_birth",
        "phone_number": "phone",
        "mobile": "phone",
        "identificationMarks": "identification_marks",
    },
    "officers": {
        "officerId": "officer_id",
        "badgeNo": "badge_number",
        "badge": "badge_number",
        "name": "full_name",
        "stationId": "police_station_id",
    },
    "police_stations": {
        "stationId": "station_id",
        "stationCode": "station_code",
        "stationName": "station_name",
    }
}


class CanonicalNormalizer:
    """
    Normalizes incoming record field keys and values to match the canonical PCIS schema.
    """

    def normalize(self, record: Dict[str, Any], collection_name: str) -> Dict[str, Any]:
        normalized = {}
        mappings = FIELD_MAPPINGS.get(collection_name, {})

        for raw_key, value in record.items():
            canonical_key = mappings.get(raw_key, raw_key)
            normalized[canonical_key] = self._normalize_value(canonical_key, value)

        return normalized

    def _normalize_value(self, key: str, value: Any) -> Any:
        if value is None:
            return None

        # Clean string whitespace
        if isinstance(value, str):
            value = value.strip()

        # Date normalization
        if "date" in key or key in ["created_at", "updated_at", "timestamp"]:
            return self._normalize_date(value)

        # Phone number normalization
        if "phone" in key:
            return self._normalize_phone(value)

        return value

    @staticmethod
    def _normalize_date(val: Any) -> str:
        if isinstance(val, (datetime, datetime)):
            return val.isoformat()
        if not isinstance(val, str):
            return str(val)

        # Try parsing common date formats
        formats = [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%Y/%m/%d"
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(val[:19], fmt)
                return dt.isoformat()
            except ValueError:
                pass
        return val

    @staticmethod
    def _normalize_phone(val: Any) -> str:
        if not val:
            return val
        s = str(val).strip()
        # Remove spaces, dashes
        cleaned = re.sub(r"[^\d+]", "", s)
        if len(cleaned) == 10 and not cleaned.startswith("+"):
            return f"+91-{cleaned}"
        return cleaned
