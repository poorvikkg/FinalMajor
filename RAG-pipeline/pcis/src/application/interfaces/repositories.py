"""
Abstract repository interfaces for the application layer.

These define the contract that infrastructure implementations must fulfill.
The application/service layer depends ONLY on these interfaces — never
on concrete database implementations.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseRepository(ABC):
    """Base repository interface with common CRUD operations."""

    @abstractmethod
    async def create(self, entity: Dict[str, Any]) -> str:
        """Create a new entity. Returns the generated ID."""
        ...

    @abstractmethod
    async def get_by_id(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a single entity by its primary ID."""
        ...

    @abstractmethod
    async def update(
        self, entity_id: str, update_data: Dict[str, Any]
    ) -> bool:
        """Update an entity. Returns True if a document was modified."""
        ...

    @abstractmethod
    async def delete(self, entity_id: str) -> bool:
        """Soft-delete an entity. Returns True if successful."""
        ...

    @abstractmethod
    async def list(
        self,
        filters: Dict[str, Any] | None = None,
        skip: int = 0,
        limit: int = 50,
        sort_by: str | None = None,
        sort_order: int = -1,
    ) -> List[Dict[str, Any]]:
        """List entities with optional filtering, pagination, and sorting."""
        ...

    @abstractmethod
    async def count(self, filters: Dict[str, Any] | None = None) -> int:
        """Count entities matching the given filters."""
        ...


class CaseRepository(BaseRepository):
    """Repository interface for cases."""

    @abstractmethod
    async def get_by_fir_number(self, fir_number: str) -> Optional[Dict[str, Any]]:
        """Find a case by its FIR number."""
        ...

    @abstractmethod
    async def get_by_station(
        self, station_id: str, skip: int = 0, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Find cases registered at a specific station."""
        ...

    @abstractmethod
    async def get_by_officer(
        self, officer_id: str, skip: int = 0, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Find cases assigned to a specific officer."""
        ...

    @abstractmethod
    async def search_text(
        self, query: str, skip: int = 0, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Full-text search across case summary and description."""
        ...

    @abstractmethod
    async def get_dashboard_stats(
        self, station_id: str | None = None
    ) -> Dict[str, Any]:
        """Get aggregated statistics for dashboard display."""
        ...


class PersonRepository(BaseRepository):
    """Repository interface for persons."""

    @abstractmethod
    async def search_by_name(
        self, name: str, skip: int = 0, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search persons by name (fuzzy / text search)."""
        ...

    @abstractmethod
    async def find_duplicates(
        self, name: str, dob: str | None = None, phone: str | None = None
    ) -> List[Dict[str, Any]]:
        """Find potential duplicate person records."""
        ...


class OfficerRepository(BaseRepository):
    """Repository interface for officers."""

    @abstractmethod
    async def get_by_badge_number(
        self, badge_number: str
    ) -> Optional[Dict[str, Any]]:
        """Find an officer by badge number."""
        ...

    @abstractmethod
    async def get_by_station(
        self, station_id: str
    ) -> List[Dict[str, Any]]:
        """Find all officers at a station."""
        ...


class DocumentRepository(BaseRepository):
    """Repository interface for case documents."""

    @abstractmethod
    async def get_by_case(
        self, case_id: str, doc_type: str | None = None
    ) -> List[Dict[str, Any]]:
        """Find documents for a case, optionally filtered by type."""
        ...

    @abstractmethod
    async def search_ocr_text(
        self, query: str, skip: int = 0, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Full-text search over OCR-extracted text."""
        ...


class EvidenceRepository(BaseRepository):
    """Repository interface for evidence."""

    @abstractmethod
    async def get_by_case(
        self, case_id: str
    ) -> List[Dict[str, Any]]:
        """Find all evidence for a case."""
        ...


class ActivityRepository(BaseRepository):
    """Repository interface for activities (audit trail)."""

    @abstractmethod
    async def get_by_case(
        self, case_id: str, skip: int = 0, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get chronological activity feed for a case."""
        ...

    @abstractmethod
    async def create(self, entity: Dict[str, Any]) -> str:
        """Create an activity record. Overrides to enforce append-only."""
        ...

    async def update(self, entity_id: str, update_data: Dict[str, Any]) -> bool:
        """Activities are immutable — updates are forbidden."""
        raise NotImplementedError("Activity records are immutable (append-only).")

    async def delete(self, entity_id: str) -> bool:
        """Activities are immutable — deletes are forbidden."""
        raise NotImplementedError("Activity records are immutable (append-only).")


class CasePersonRepository(BaseRepository):
    """Repository interface for case-person junction records."""

    @abstractmethod
    async def get_persons_for_case(
        self, case_id: str, role: str | None = None
    ) -> List[Dict[str, Any]]:
        """Find all person associations for a case."""
        ...

    @abstractmethod
    async def get_cases_for_person(
        self, person_id: str
    ) -> List[Dict[str, Any]]:
        """Find all case associations for a person."""
        ...


class StationRepository(BaseRepository):
    """Repository interface for police stations."""

    @abstractmethod
    async def get_by_code(
        self, station_code: str
    ) -> Optional[Dict[str, Any]]:
        """Find a station by its code."""
        ...


class UserRepository(BaseRepository):
    """Repository interface for users."""

    @abstractmethod
    async def get_by_username(
        self, username: str
    ) -> Optional[Dict[str, Any]]:
        """Find a user by username."""
        ...


class RoleRepository(BaseRepository):
    """Repository interface for roles."""

    @abstractmethod
    async def get_by_name(
        self, role_name: str
    ) -> Optional[Dict[str, Any]]:
        """Find a role by its name."""
        ...


class AttachmentRepository(BaseRepository):
    """Repository interface for attachments."""

    @abstractmethod
    async def get_by_document(
        self, document_id: str
    ) -> List[Dict[str, Any]]:
        """Find all attachments for a document."""
        ...

    @abstractmethod
    async def get_by_case(
        self, case_id: str
    ) -> List[Dict[str, Any]]:
        """Find all attachments for a case."""
        ...


class CaseNoteRepository(BaseRepository):
    """Repository interface for case notes."""

    @abstractmethod
    async def get_by_case(
        self, case_id: str, confidentiality_level: str | None = None
    ) -> List[Dict[str, Any]]:
        """Find notes for a case, optionally filtered by confidentiality."""
        ...
