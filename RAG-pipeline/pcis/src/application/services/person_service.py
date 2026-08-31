"""
Person Service — manages person records and case-person associations.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.application.interfaces.repositories import (
    PersonRepository,
    CasePersonRepository,
    CaseRepository,
    ActivityRepository,
)
from src.domain.enums.activity_type import ActivityType
from src.domain.exceptions.domain_exceptions import (
    PersonNotFoundException,
    CaseNotFoundException,
    ReferentialIntegrityException,
)

logger = logging.getLogger(__name__)


class PersonService:
    """Manages person records and their associations with cases."""

    def __init__(
        self,
        person_repo: PersonRepository,
        case_person_repo: CasePersonRepository,
        case_repo: CaseRepository,
        activity_repo: ActivityRepository,
    ):
        self.person_repo = person_repo
        self.case_person_repo = case_person_repo
        self.case_repo = case_repo
        self.activity_repo = activity_repo

    async def create_person(self, person_data: Dict[str, Any]) -> str:
        """Create a new person record."""
        now = datetime.utcnow()
        person_data["created_at"] = now
        person_data["updated_at"] = now

        person_id = await self.person_repo.create(person_data)
        logger.info(f"Person created: {person_id}")
        return person_id

    async def get_person(self, person_id: str) -> Dict[str, Any]:
        """Retrieve a person by ID."""
        person = await self.person_repo.get_by_id(person_id)
        if not person:
            raise PersonNotFoundException(person_id)
        return person

    async def update_person(
        self, person_id: str, update_data: Dict[str, Any]
    ) -> bool:
        """Update person details."""
        existing = await self.person_repo.get_by_id(person_id)
        if not existing:
            raise PersonNotFoundException(person_id)

        update_data["updated_at"] = datetime.utcnow()
        return await self.person_repo.update(person_id, update_data)

    async def search_persons(
        self, name: str, skip: int = 0, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search persons by name."""
        return await self.person_repo.search_by_name(name, skip, limit)

    async def find_duplicates(
        self,
        name: str,
        dob: str | None = None,
        phone: str | None = None,
    ) -> List[Dict[str, Any]]:
        """Find potential duplicate person records."""
        return await self.person_repo.find_duplicates(name, dob, phone)

    async def add_person_to_case(
        self,
        case_id: str,
        person_id: str,
        role_in_case: str,
        added_by: str,
        **kwargs,
    ) -> str:
        """Associate a person with a case in a specific role."""
        # Validate references
        case = await self.case_repo.get_by_id(case_id)
        if not case:
            raise CaseNotFoundException(case_id)

        person = await self.person_repo.get_by_id(person_id)
        if not person:
            raise PersonNotFoundException(person_id)

        now = datetime.utcnow()
        case_person_data = {
            "case_id": case_id,
            "person_id": person_id,
            "role_in_case": role_in_case,
            "added_by": added_by,
            "created_at": now,
            "updated_at": now,
            **kwargs,
        }

        cp_id = await self.case_person_repo.create(case_person_data)

        # Log activity
        await self.activity_repo.create({
            "case_id": case_id,
            "activity_type": ActivityType.PERSON_ADDED.value,
            "performed_by": added_by,
            "timestamp": now,
            "entity_type": "person",
            "entity_id": person_id,
            "new_value": {"role_in_case": role_in_case, "person_id": person_id},
            "remarks": f"Person {person_id} added as {role_in_case}",
            "created_at": now,
        })

        return cp_id

    async def get_persons_for_case(
        self, case_id: str, role: str | None = None
    ) -> List[Dict[str, Any]]:
        """Get all persons associated with a case."""
        return await self.case_person_repo.get_persons_for_case(case_id, role)

    async def get_cases_for_person(
        self, person_id: str
    ) -> List[Dict[str, Any]]:
        """Get all cases a person is involved in."""
        return await self.case_person_repo.get_cases_for_person(person_id)

    async def list_persons(
        self,
        filters: Dict[str, Any] | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """List persons with pagination."""
        persons = await self.person_repo.list(filters, skip, limit)
        total = await self.person_repo.count(filters)
        return {"items": persons, "total": total, "skip": skip, "limit": limit}
