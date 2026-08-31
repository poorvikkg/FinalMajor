"""Case Document domain entity."""

from datetime import datetime
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field

from src.domain.enums.document_type import DocumentType, OCRStatus
from src.domain.value_objects.common import DocumentChunk


class CaseDocument(BaseModel):
    """
    Logical document associated with a case. The actual files
    are stored in the attachments collection.
    """

    document_id: Optional[str] = None
    case_id: str = Field(..., description="FK → cases")
    document_type: DocumentType
    document_title: str
    document_number: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = Field(None, description="FK → users")
    upload_date: datetime
    document_date: Optional[datetime] = None
    ocr_text: Optional[str] = None
    ocr_status: OCRStatus = OCRStatus.NOT_APPLICABLE
    ocr_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    language: str = "en"
    chunk_count: Optional[int] = None
    chunks: List[DocumentChunk] = Field(default_factory=list)
    is_confidential: bool = False
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
