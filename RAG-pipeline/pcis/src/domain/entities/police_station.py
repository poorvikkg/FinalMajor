"""Police Station domain entity."""

from datetime import datetime
from typing import Dict, Any, Optional

from pydantic import BaseModel, Field

from src.domain.enums.activity_type import StationType
from src.domain.value_objects.common import Address, Coordinates, ContactInfo


class PoliceStation(BaseModel):
    """Represents a police station / jurisdictional unit."""

    station_id: Optional[str] = None
    station_code: str = Field(
        ..., description="Human-readable code (e.g., MH-MUM-ANH-01)"
    )
    station_name: str
    district: str
    state: str
    address: Address
    contact: ContactInfo
    jurisdiction_area: Optional[str] = None
    jurisdiction_polygon: Optional[Dict[str, Any]] = Field(
        None, description="GeoJSON polygon for spatial queries"
    )
    coordinates: Optional[Coordinates] = None
    station_type: StationType = StationType.REGULAR
    is_active: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
