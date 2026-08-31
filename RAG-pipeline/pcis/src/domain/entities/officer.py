"""Officer domain entity."""

from datetime import date, datetime
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field

from src.domain.enums.officer_rank import (
    OfficerRank,
    EmploymentStatus,
    Specialization,
)
from src.domain.value_objects.common import FullName, PreviousPosting


class Officer(BaseModel):
    """Represents a police officer."""

    officer_id: Optional[str] = None
    badge_number: str = Field(..., description="Official badge / service number")
    full_name: FullName
    display_name: str
    designation: str
    rank: OfficerRank
    station_id: str = Field(..., description="FK → police_stations")
    specialization: List[Specialization] = Field(default_factory=list)
    years_of_service: Optional[int] = None
    date_of_joining: Optional[date] = None
    phone: str
    email: Optional[str] = None
    employment_status: EmploymentStatus = EmploymentStatus.ACTIVE
    previous_postings: List[PreviousPosting] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
