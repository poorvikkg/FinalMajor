"""
Pydantic request/response schemas for the API layer.

These schemas handle serialization/validation at the API boundary
and are separate from domain entities to decouple API concerns.
"""

from datetime import datetime, date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ─── Common ──────────────────────────────────────────────────────────────


class PaginatedResponse(BaseModel):
    """Standard paginated list response."""

    items: List[Dict[str, Any]]
    total: int
    skip: int
    limit: int


class ErrorResponse(BaseModel):
    """Standard error response envelope."""

    error: Dict[str, Any] = Field(
        ..., example={"code": "NOT_FOUND", "message": "Resource not found"}
    )


class SuccessResponse(BaseModel):
    """Simple success response."""

    success: bool = True
    message: str = ""
    data: Optional[Dict[str, Any]] = None


# ─── Auth ────────────────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str = Field(..., min_length=8)
    role_id: str
    linked_officer_id: Optional[str] = None
    email: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# ─── Case ────────────────────────────────────────────────────────────────


class CaseCreateRequest(BaseModel):
    fir_number: str
    police_station_id: str
    assigned_officer_id: str
    crime_type: str
    crime_sub_type: Optional[str] = None
    crime_category: Optional[str] = None
    priority: str = "MEDIUM"
    registration_date: datetime
    incident_date: datetime
    incident_end_date: Optional[datetime] = None
    incident_location: Dict[str, Any]
    short_summary: str = Field(..., max_length=500)
    detailed_description: str
    applicable_sections: List[Dict[str, Any]] = Field(default_factory=list)
    source: str = "WALK_IN"
    tags: List[str] = Field(default_factory=list)
    is_sensitive: bool = False


class CaseUpdateRequest(BaseModel):
    crime_type: Optional[str] = None
    crime_sub_type: Optional[str] = None
    crime_category: Optional[str] = None
    priority: Optional[str] = None
    incident_location: Optional[Dict[str, Any]] = None
    short_summary: Optional[str] = None
    detailed_description: Optional[str] = None
    applicable_sections: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None
    is_sensitive: Optional[bool] = None


class CaseStatusChangeRequest(BaseModel):
    new_status: str
    reason: Optional[str] = None


class CaseAssignOfficerRequest(BaseModel):
    officer_id: str


# ─── Person ──────────────────────────────────────────────────────────────


class PersonCreateRequest(BaseModel):
    full_name: Dict[str, Any] = Field(
        ..., example={"first_name": "Rajesh", "last_name": "Kumar"}
    )
    display_name: str
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    approximate_age: Optional[int] = None
    address: Optional[Dict[str, Any]] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    occupation: Optional[str] = None
    identification_marks: List[str] = Field(default_factory=list)
    government_ids: List[Dict[str, Any]] = Field(default_factory=list)
    nationality: str = "Indian"


class AddPersonToCaseRequest(BaseModel):
    person_id: str
    role_in_case: str
    role_description: Optional[str] = None
    involvement_date: Optional[datetime] = None
    is_primary: bool = False
    notes: Optional[str] = None


# ─── Station ─────────────────────────────────────────────────────────────


class StationCreateRequest(BaseModel):
    station_code: str
    station_name: str
    district: str
    state: str
    address: Dict[str, Any]
    contact: Dict[str, Any]
    jurisdiction_area: Optional[str] = None
    coordinates: Optional[Dict[str, float]] = None
    station_type: str = "REGULAR"


# ─── Officer ─────────────────────────────────────────────────────────────


class OfficerCreateRequest(BaseModel):
    badge_number: str
    full_name: Dict[str, Any]
    display_name: str
    designation: str
    rank: str
    station_id: str
    specialization: List[str] = Field(default_factory=list)
    phone: str
    email: Optional[str] = None


# ─── Evidence ────────────────────────────────────────────────────────────


class EvidenceCreateRequest(BaseModel):
    case_id: str
    evidence_type: str
    evidence_sub_type: Optional[str] = None
    description: str
    collection_date: datetime
    collection_location: Optional[str] = None
    collected_by: str
    storage_location: Optional[str] = None
    is_critical: bool = False


# ─── Case Note ───────────────────────────────────────────────────────────


class CaseNoteCreateRequest(BaseModel):
    case_id: str
    title: str
    content: str
    note_type: str = "OBSERVATION"
    confidentiality_level: str = "INTERNAL"
    related_person_ids: List[str] = Field(default_factory=list)
    related_evidence_ids: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


# ─── Document ────────────────────────────────────────────────────────────


class DocumentCreateRequest(BaseModel):
    case_id: str
    document_type: str
    document_title: str
    document_number: Optional[str] = None
    description: Optional[str] = None
    document_date: Optional[datetime] = None
    is_confidential: bool = False
    tags: List[str] = Field(default_factory=list)
