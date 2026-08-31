"""Role domain entity with RBAC permissions."""

from datetime import datetime
from typing import Dict, Any, Optional

from pydantic import BaseModel, Field


class Role(BaseModel):
    """
    RBAC role definition with granular permissions.
    Permissions are stored as a nested dict keyed by resource and action.
    """

    role_id: Optional[str] = None
    role_name: str = Field(
        ..., description="E.g., ADMINISTRATOR, INSPECTOR, CONSTABLE"
    )
    display_name: str
    description: Optional[str] = None
    permissions: Dict[str, Dict[str, bool]] = Field(
        ...,
        description="Granular permissions: { resource: { action: bool } }",
    )
    hierarchy_level: int = Field(
        ..., description="Numeric rank (lower = more authority)"
    )
    is_system_role: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
