"""Evidence type and status enumerations."""

from enum import Enum


class EvidenceType(str, Enum):
    """Classification of evidence."""

    PHYSICAL = "PHYSICAL"
    DIGITAL = "DIGITAL"
    DOCUMENTARY = "DOCUMENTARY"
    BIOLOGICAL = "BIOLOGICAL"
    FORENSIC = "FORENSIC"
    TESTIMONIAL = "TESTIMONIAL"
    CIRCUMSTANTIAL = "CIRCUMSTANTIAL"


class EvidenceSubType(str, Enum):
    """Specific evidence sub-classifications."""

    FINGERPRINT = "FINGERPRINT"
    DNA = "DNA"
    CCTV_FOOTAGE = "CCTV_FOOTAGE"
    WEAPON = "WEAPON"
    MOBILE_DEVICE = "MOBILE_DEVICE"
    COMPUTER = "COMPUTER"
    CLOTHING = "CLOTHING"
    VEHICLE = "VEHICLE"
    FINANCIAL_RECORDS = "FINANCIAL_RECORDS"
    PHOTOGRAPHS = "PHOTOGRAPHS"
    OTHER = "OTHER"


class EvidenceStatus(str, Enum):
    """Current status of evidence in custody chain."""

    COLLECTED = "COLLECTED"
    IN_CUSTODY = "IN_CUSTODY"
    SENT_TO_LAB = "SENT_TO_LAB"
    ANALYZED = "ANALYZED"
    RETURNED = "RETURNED"
    DISPOSED = "DISPOSED"
    IN_COURT = "IN_COURT"


class ForensicStatus(str, Enum):
    """Forensic analysis status."""

    NOT_SUBMITTED = "NOT_SUBMITTED"
    SUBMITTED = "SUBMITTED"
    ANALYSIS_IN_PROGRESS = "ANALYSIS_IN_PROGRESS"
    ANALYSIS_COMPLETE = "ANALYSIS_COMPLETE"
    INCONCLUSIVE = "INCONCLUSIVE"
