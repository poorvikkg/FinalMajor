"""
Reusable value objects used across multiple domain entities.

Value objects are immutable, equality-by-value data structures
that have no identity of their own.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class Address(BaseModel):
    """Structured address value object."""

    street: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    landmark: Optional[str] = None


class Coordinates(BaseModel):
    """Geographic coordinates (WGS84)."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class ContactInfo(BaseModel):
    """Contact information value object."""

    phone_primary: Optional[str] = None
    phone_secondary: Optional[str] = None
    email: Optional[str] = None
    fax: Optional[str] = None


class FullName(BaseModel):
    """Structured person name."""

    first_name: str
    middle_name: Optional[str] = None
    last_name: Optional[str] = None

    @property
    def display(self) -> str:
        """Generate display name from components."""
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        if self.last_name:
            parts.append(self.last_name)
        return " ".join(parts)


class LegalSection(BaseModel):
    """A legal section / act reference (e.g., IPC Section 302)."""

    act: str = Field(..., description="Name of the act (e.g., IPC, CrPC, IT Act)")
    section: str = Field(..., description="Section number (e.g., 302, 420)")
    description: Optional[str] = Field(
        None, description="Human-readable description of the section"
    )


class IncidentLocation(BaseModel):
    """Location where an incident occurred."""

    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    landmark: Optional[str] = None
    coordinates: Optional[Coordinates] = None


class GovernmentID(BaseModel):
    """Government-issued identification."""

    id_type: str = Field(
        ..., description="Type of ID (e.g., AADHAAR, PAN, PASSPORT, VOTER_ID)"
    )
    id_number: str = Field(..., description="ID number (may be partially masked)")


class PreviousPosting(BaseModel):
    """An officer's previous station posting record."""

    station_id: str
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None


class CustodyTransfer(BaseModel):
    """A single transfer event in the chain of custody for evidence."""

    from_officer_id: str
    to_officer_id: str
    transfer_date: datetime
    remarks: Optional[str] = None


class DocumentChunk(BaseModel):
    """A text chunk from a document, ready for RAG retrieval."""

    chunk_id: str
    chunk_index: int = Field(..., ge=0)
    text: str
    token_count: Optional[int] = None
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    embedding_vector: Optional[List[float]] = None
    embedding_model: Optional[str] = None
