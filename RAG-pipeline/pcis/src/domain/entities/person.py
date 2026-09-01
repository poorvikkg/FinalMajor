"""Person domain entity — reusable across multiple cases."""

from datetime import date, datetime
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field

from src.domain.enums.activity_type import Gender
from src.domain.value_objects.common import Address, FullName, GovernmentID


class Person(BaseModel):
    """
    Reusable person record. A single person can appear across multiple cases
    in different roles via the case_persons junction collection.
    """

    person_id: Optional[str] = None
    full_name: FullName
    display_name: str
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    approximate_age: Optional[int] = Field(None, ge=0, le=150)
    address: Optional[Address] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    occupation: Optional[str] = None
    identification_marks: List[str] = Field(default_factory=list)
    government_ids: List[GovernmentID] = Field(default_factory=list)
    nationality: str = "Indian"
    photograph_attachment_id: Optional[str] = Field(
        None, description="FK → attachments"
    )
    is_deceased: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CasePerson(BaseModel):
    """
    Junction entity mapping a person to a case with their role.
    Many-to-many bridge between cases and persons.
    """

    case_person_id: Optional[str] = None
    case_id: str = Field(..., description="FK → cases")
    person_id: str = Field(..., description="FK → persons")
    role_in_case: str = Field(
        ..., description="VICTIM, SUSPECT, WITNESS, COMPLAINANT, etc."
    )
    role_description: Optional[str] = None
    involvement_date: Optional[datetime] = None
    is_primary: bool = False
    status: str = "ACTIVE"
    notes: Optional[str] = None
    added_by: Optional[str] = Field(None, description="FK → users")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
