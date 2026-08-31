"""Activity domain entity — immutable audit trail."""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from src.domain.enums.activity_type import ActivityType


class Activity(BaseModel):
    """
    Immutable audit trail record. Activities are APPEND-ONLY —
    never update or delete. They may be required as court evidence.
    """

    activity_id: Optional[str] = None
    case_id: str = Field(..., description="FK → cases")
    activity_type: ActivityType
    performed_by: str = Field(..., description="FK → users")
    timestamp: datetime
    entity_type: Optional[str] = Field(
        None, description="Type of entity affected (e.g., evidence, person)"
    )
    entity_id: Optional[str] = Field(None, description="ID of the affected entity")
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    remarks: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None
