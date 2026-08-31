"""User domain entity."""

from datetime import datetime
from typing import Dict, Any, Optional

from pydantic import BaseModel, Field

from src.domain.enums.activity_type import AccountStatus


class User(BaseModel):
    """Application user account."""

    user_id: Optional[str] = None
    username: str
    password_hash: str
    linked_officer_id: Optional[str] = Field(
        None, description="FK → officers (null for admin/data-entry)"
    )
    role_id: str = Field(..., description="FK → roles")
    email: Optional[str] = None
    account_status: AccountStatus = AccountStatus.ACTIVE
    last_login_at: Optional[datetime] = None
    failed_login_attempts: int = 0
    password_changed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
