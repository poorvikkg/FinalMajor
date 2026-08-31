"""Attachment domain entity — physical file references."""

from datetime import datetime
from typing import Dict, Any, Optional

from pydantic import BaseModel, Field

from src.domain.enums.activity_type import StorageBackend


class Attachment(BaseModel):
    """
    Metadata about an uploaded file. The actual file lives in object
    storage (local filesystem, S3, etc.) — not in the database.
    """

    attachment_id: Optional[str] = None
    document_id: Optional[str] = Field(
        None, description="FK → case_documents (nullable for standalone)"
    )
    case_id: str = Field(..., description="FK → cases")
    file_name: str
    file_type: str = Field(..., description="MIME type (e.g., application/pdf)")
    file_extension: str = Field(..., description="Extension (e.g., pdf, jpg)")
    file_size_bytes: int = Field(..., ge=0)
    storage_backend: StorageBackend = StorageBackend.LOCAL
    storage_location: str = Field(..., description="Full path / URI in storage")
    storage_bucket: Optional[str] = None
    checksum_sha256: str
    is_encrypted: bool = False
    thumbnail_location: Optional[str] = None
    uploaded_by: Optional[str] = Field(None, description="FK → users")
    upload_timestamp: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
