"""Activity type enumeration for the audit trail."""

from enum import Enum


class ActivityType(str, Enum):
    """Types of activities tracked in the case audit trail."""

    CASE_REGISTERED = "CASE_REGISTERED"
    CASE_UPDATED = "CASE_UPDATED"
    OFFICER_ASSIGNED = "OFFICER_ASSIGNED"
    OFFICER_UNASSIGNED = "OFFICER_UNASSIGNED"
    PERSON_ADDED = "PERSON_ADDED"
    PERSON_UPDATED = "PERSON_UPDATED"
    PERSON_REMOVED = "PERSON_REMOVED"
    EVIDENCE_COLLECTED = "EVIDENCE_COLLECTED"
    EVIDENCE_STATUS_CHANGED = "EVIDENCE_STATUS_CHANGED"
    DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED"
    DOCUMENT_UPDATED = "DOCUMENT_UPDATED"
    ATTACHMENT_ADDED = "ATTACHMENT_ADDED"
    NOTE_ADDED = "NOTE_ADDED"
    NOTE_UPDATED = "NOTE_UPDATED"
    STATUS_CHANGED = "STATUS_CHANGED"
    PRIORITY_CHANGED = "PRIORITY_CHANGED"
    CASE_TRANSFERRED = "CASE_TRANSFERRED"
    CASE_REOPENED = "CASE_REOPENED"
    CASE_CLOSED = "CASE_CLOSED"
    SECTION_UPDATED = "SECTION_UPDATED"
    OTHER = "OTHER"


class CaseSource(str, Enum):
    """Source of case registration."""

    WALK_IN = "WALK_IN"
    PHONE = "PHONE"
    ONLINE = "ONLINE"
    TRANSFER = "TRANSFER"
    SUO_MOTO = "SUO_MOTO"
    REFERRAL = "REFERRAL"
    GOVERNMENT_EXPORT = "GOVERNMENT_EXPORT"


class Gender(str, Enum):
    """Gender classification."""

    MALE = "MALE"
    FEMALE = "FEMALE"
    TRANSGENDER = "TRANSGENDER"
    OTHER = "OTHER"
    UNKNOWN = "UNKNOWN"


class PersonRole(str, Enum):
    """Role of a person in a case."""

    VICTIM = "VICTIM"
    SUSPECT = "SUSPECT"
    WITNESS = "WITNESS"
    COMPLAINANT = "COMPLAINANT"
    MISSING_PERSON = "MISSING_PERSON"
    ACCUSED = "ACCUSED"
    GUARDIAN = "GUARDIAN"
    INFORMANT = "INFORMANT"
    OTHER = "OTHER"


class PersonStatus(str, Enum):
    """Status of a person's involvement in a case."""

    ACTIVE = "ACTIVE"
    CLEARED = "CLEARED"
    DECEASED = "DECEASED"
    ABSCONDING = "ABSCONDING"
    ARRESTED = "ARRESTED"
    RELEASED = "RELEASED"


class ConfidentialityLevel(str, Enum):
    """Confidentiality levels for case notes and documents."""

    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    RESTRICTED = "RESTRICTED"
    TOP_SECRET = "TOP_SECRET"


class NoteType(str, Enum):
    """Types of investigation notes."""

    OBSERVATION = "OBSERVATION"
    LEAD = "LEAD"
    INTERVIEW_SUMMARY = "INTERVIEW_SUMMARY"
    FOLLOW_UP = "FOLLOW_UP"
    INTERNAL_MEMO = "INTERNAL_MEMO"
    PROGRESS_UPDATE = "PROGRESS_UPDATE"
    OTHER = "OTHER"


class AccountStatus(str, Enum):
    """User account status."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    LOCKED = "LOCKED"
    SUSPENDED = "SUSPENDED"


class StationType(str, Enum):
    """Types of police stations."""

    REGULAR = "REGULAR"
    CYBER_CELL = "CYBER_CELL"
    WOMEN_CELL = "WOMEN_CELL"
    TRAFFIC = "TRAFFIC"
    SPECIAL = "SPECIAL"


class StorageBackend(str, Enum):
    """File storage backend types."""

    LOCAL = "LOCAL"
    S3 = "S3"
    GCS = "GCS"
    AZURE_BLOB = "AZURE_BLOB"
