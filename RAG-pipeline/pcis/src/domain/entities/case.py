"""Case domain entity — the central object of the system."""

from datetime import datetime
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field

from src.domain.enums.crime_type import CrimeType, CrimeCategory
from src.domain.enums.case_status import CaseStatus
from src.domain.enums.priority import Priority
from src.domain.enums.activity_type import CaseSource
from src.domain.value_objects.common import IncidentLocation, LegalSection


class Case(BaseModel):
    """
    The central entity of the PCIS. Every other entity references back to a Case.
    Contains only core case metadata — investigation details live in separate collections.
    """

    case_id: Optional[str] = None
    fir_number: str = Field(
        ..., description="FIR registration number (e.g., FIR/2025/MUM/00451)"
    )
    police_station_id: str = Field(..., description="FK → police_stations")
    assigned_officer_id: str = Field(
        ..., description="FK → officers (primary IO)"
    )
    supporting_officer_ids: List[str] = Field(
        default_factory=list, description="FK → officers (additional)"
    )
    crime_type: CrimeType
    crime_sub_type: Optional[str] = None
    crime_category: Optional[CrimeCategory] = None
    priority: Priority = Priority.MEDIUM
    current_status: CaseStatus = CaseStatus.REGISTERED
    registration_date: datetime
    incident_date: datetime
    incident_end_date: Optional[datetime] = None
    incident_location: IncidentLocation
    short_summary: str = Field(..., max_length=500)
    detailed_description: str
    applicable_sections: List[LegalSection] = Field(default_factory=list)
    source: CaseSource = CaseSource.WALK_IN
    related_case_ids: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    is_sensitive: bool = False
    closure_reason: Optional[str] = None
    closure_date: Optional[datetime] = None
    created_by: Optional[str] = Field(None, description="FK → users")
    updated_by: Optional[str] = Field(None, description="FK → users")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # AI-ready fields
    embedding_vector: Optional[List[float]] = None
    embedding_model: Optional[str] = None
    embedding_updated_at: Optional[datetime] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
