"""Evidence domain entity."""

from datetime import datetime
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field

from src.domain.enums.evidence_type import (
    EvidenceType,
    EvidenceSubType,
    EvidenceStatus,
    ForensicStatus,
)
from src.domain.value_objects.common import CustodyTransfer


class Evidence(BaseModel):
    """Physical or digital evidence collected during investigation."""

    evidence_id: Optional[str] = None
    case_id: str = Field(..., description="FK → cases")
    evidence_number: Optional[str] = Field(
        None, description="Sequential tag (e.g., EVD-001)"
    )
    evidence_type: EvidenceType
    evidence_sub_type: Optional[EvidenceSubType] = None
    description: str
    collection_date: datetime
    collection_location: Optional[str] = None
    collected_by: str = Field(..., description="FK → officers")
    chain_of_custody: List[CustodyTransfer] = Field(default_factory=list)
    current_status: EvidenceStatus = EvidenceStatus.COLLECTED
    storage_location: Optional[str] = None
    forensic_status: ForensicStatus = ForensicStatus.NOT_SUBMITTED
    forensic_report_document_id: Optional[str] = Field(
        None, description="FK → case_documents"
    )
    related_attachment_ids: List[str] = Field(
        default_factory=list, description="FK → attachments"
    )
    is_critical: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
