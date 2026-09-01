"""
Case Service — orchestrates all case-related business logic.

This is the primary service of the system, coordinating case CRUD,
status transitions, officer assignment, and activity logging.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.application.interfaces.repositories import (
    CaseRepository,
    ActivityRepository,
    StationRepository,
    OfficerRepository,
)
from src.domain.enums.case_status import CaseStatus
from src.domain.enums.activity_type import ActivityType
from src.domain.exceptions.domain_exceptions import (
    CaseNotFoundException,
    DuplicateFIRException,
    InvalidCaseStatusTransition,
    ReferentialIntegrityException,
)

logger = logging.getLogger(__name__)

# Valid status transitions
VALID_TRANSITIONS: Dict[CaseStatus, List[CaseStatus]] = {
    CaseStatus.REGISTERED: [CaseStatus.UNDER_INVESTIGATION, CaseStatus.TRANSFERRED, CaseStatus.CLOSED_UNSOLVED],
    CaseStatus.UNDER_INVESTIGATION: [CaseStatus.CHARGE_SHEET_FILED, CaseStatus.CLOSED_SOLVED, CaseStatus.CLOSED_UNSOLVED, CaseStatus.TRANSFERRED],
    CaseStatus.CHARGE_SHEET_FILED: [CaseStatus.COURT_PROCEEDINGS, CaseStatus.UNDER_INVESTIGATION],
    CaseStatus.COURT_PROCEEDINGS: [CaseStatus.CLOSED_SOLVED, CaseStatus.CLOSED_UNSOLVED, CaseStatus.UNDER_INVESTIGATION],
    CaseStatus.CLOSED_SOLVED: [CaseStatus.REOPENED],
    CaseStatus.CLOSED_UNSOLVED: [CaseStatus.REOPENED],
    CaseStatus.REOPENED: [CaseStatus.UNDER_INVESTIGATION],
    CaseStatus.TRANSFERRED: [CaseStatus.REGISTERED],
}


class CaseService:
    """Orchestrates case-related business operations."""

    def __init__(
        self,
        case_repo: CaseRepository,
        activity_repo: ActivityRepository,
        station_repo: StationRepository,
        officer_repo: OfficerRepository,
    ):
        self.case_repo = case_repo
        self.activity_repo = activity_repo
        self.station_repo = station_repo
        self.officer_repo = officer_repo

    async def create_case(
        self, case_data: Dict[str, Any], created_by: str
    ) -> str:
        """Register a new case with FK validation and activity logging."""
        # Check for duplicate FIR
        existing = await self.case_repo.get_by_fir_number(case_data["fir_number"])
        if existing:
            raise DuplicateFIRException(case_data["fir_number"])

        # Validate FK references
        station = await self.station_repo.get_by_id(case_data["police_station_id"])
        if not station:
            raise ReferentialIntegrityException(
                f"Police station not found: {case_data['police_station_id']}"
            )

        officer = await self.officer_repo.get_by_id(case_data["assigned_officer_id"])
        if not officer:
            raise ReferentialIntegrityException(
                f"Officer not found: {case_data['assigned_officer_id']}"
            )

        # Set defaults
        now = datetime.utcnow()
        case_data["created_by"] = created_by
        case_data["updated_by"] = created_by
        case_data["created_at"] = now
        case_data["updated_at"] = now
        case_data.setdefault("current_status", CaseStatus.REGISTERED.value)

        case_id = await self.case_repo.create(case_data)

        # Log activity
        await self.activity_repo.create({
            "case_id": case_id,
            "activity_type": ActivityType.CASE_REGISTERED.value,
            "performed_by": created_by,
            "timestamp": now,
            "remarks": f"Case registered with FIR {case_data['fir_number']}",
            "created_at": now,
        })

        logger.info(f"Case created: {case_id} (FIR: {case_data['fir_number']})")
        return case_id

    async def get_case(self, case_id: str) -> Dict[str, Any]:
        """Retrieve a case by ID."""
        case = await self.case_repo.get_by_id(case_id)
        if not case:
            raise CaseNotFoundException(case_id)
        return case

    async def get_case_by_fir(self, fir_number: str) -> Dict[str, Any]:
        """Retrieve a case by FIR number."""
        case = await self.case_repo.get_by_fir_number(fir_number)
        if not case:
            raise CaseNotFoundException(fir_number)
        return case

    async def update_case(
        self, case_id: str, update_data: Dict[str, Any], updated_by: str
    ) -> bool:
        """Update case fields with activity logging."""
        existing = await self.case_repo.get_by_id(case_id)
        if not existing:
            raise CaseNotFoundException(case_id)

        now = datetime.utcnow()
        update_data["updated_by"] = updated_by
        update_data["updated_at"] = now

        result = await self.case_repo.update(case_id, update_data)

        await self.activity_repo.create({
            "case_id": case_id,
            "activity_type": ActivityType.CASE_UPDATED.value,
            "performed_by": updated_by,
            "timestamp": now,
            "old_value": {k: existing.get(k) for k in update_data if k in existing},
            "new_value": {k: v for k, v in update_data.items() if k not in ("updated_by", "updated_at")},
            "remarks": "Case details updated",
            "created_at": now,
        })

        return result

    async def change_status(
        self,
        case_id: str,
        new_status: CaseStatus,
        updated_by: str,
        reason: Optional[str] = None,
    ) -> bool:
        """Transition case status with validation."""
        existing = await self.case_repo.get_by_id(case_id)
        if not existing:
            raise CaseNotFoundException(case_id)

        current = CaseStatus(existing["current_status"])
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise InvalidCaseStatusTransition(current.value, new_status.value)

        now = datetime.utcnow()
        update = {
            "current_status": new_status.value,
            "updated_by": updated_by,
            "updated_at": now,
        }

        # Set closure fields if closing
        if new_status in (CaseStatus.CLOSED_SOLVED, CaseStatus.CLOSED_UNSOLVED):
            update["closure_date"] = now
            update["closure_reason"] = reason

        result = await self.case_repo.update(case_id, update)

        await self.activity_repo.create({
            "case_id": case_id,
            "activity_type": ActivityType.STATUS_CHANGED.value,
            "performed_by": updated_by,
            "timestamp": now,
            "old_value": {"current_status": current.value},
            "new_value": {"current_status": new_status.value},
            "remarks": reason or f"Status changed: {current.value} → {new_status.value}",
            "created_at": now,
        })

        logger.info(f"Case {case_id} status: {current.value} → {new_status.value}")
        return result

    async def assign_officer(
        self, case_id: str, officer_id: str, assigned_by: str
    ) -> bool:
        """Assign or reassign the primary investigating officer."""
        existing = await self.case_repo.get_by_id(case_id)
        if not existing:
            raise CaseNotFoundException(case_id)

        officer = await self.officer_repo.get_by_id(officer_id)
        if not officer:
            raise ReferentialIntegrityException(f"Officer not found: {officer_id}")

        now = datetime.utcnow()
        old_officer_id = existing.get("assigned_officer_id")

        result = await self.case_repo.update(case_id, {
            "assigned_officer_id": officer_id,
            "updated_by": assigned_by,
            "updated_at": now,
        })

        await self.activity_repo.create({
            "case_id": case_id,
            "activity_type": ActivityType.OFFICER_ASSIGNED.value,
            "performed_by": assigned_by,
            "timestamp": now,
            "old_value": {"assigned_officer_id": old_officer_id},
            "new_value": {"assigned_officer_id": officer_id},
            "remarks": f"Officer {officer_id} assigned to case",
            "created_at": now,
        })

        return result

    async def list_cases(
        self,
        filters: Dict[str, Any] | None = None,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "created_at",
        sort_order: int = -1,
    ) -> Dict[str, Any]:
        """List cases with pagination and total count."""
        cases = await self.case_repo.list(filters, skip, limit, sort_by, sort_order)
        total = await self.case_repo.count(filters)
        return {"items": cases, "total": total, "skip": skip, "limit": limit}

    async def search_cases(
        self, query: str, skip: int = 0, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Full-text search across case summaries and descriptions."""
        return await self.case_repo.search_text(query, skip, limit)

    async def get_dashboard_stats(
        self, station_id: str | None = None
    ) -> Dict[str, Any]:
        """Get aggregated case statistics for dashboard."""
        return await self.case_repo.get_dashboard_stats(station_id)
