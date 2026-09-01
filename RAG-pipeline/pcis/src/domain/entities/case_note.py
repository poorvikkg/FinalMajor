"""Case Note domain entity."""

from datetime import datetime
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field

from src.domain.enums.activity_type import ConfidentialityLevel, NoteType


class CaseNote(BaseModel):
    """Investigation note, observation, or internal memo."""

    note_id: Optional[str] = None
    case_id: str = Field(..., description="FK → cases")
    officer_id: str = Field(..., description="FK → officers")
    title: str
    content: str = Field(..., description="Full note content (supports markdown)")
    note_type: NoteType = NoteType.OBSERVATION
    confidentiality_level: ConfidentialityLevel = ConfidentialityLevel.INTERNAL
    related_person_ids: List[str] = Field(
        default_factory=list, description="FK → persons"
    )
    related_evidence_ids: List[str] = Field(
        default_factory=list, description="FK → evidence"
    )
    tags: List[str] = Field(default_factory=list)

    # AI-ready fields
    embedding_vector: Optional[List[float]] = None
    embedding_model: Optional[str] = None
    embedding_updated_at: Optional[datetime] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
