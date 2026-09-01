"""
Person API Routes — CRUD, search, case associations.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.api.middleware.auth_middleware import get_current_user, require_permission
from src.api.schemas.api_schemas import (
    PersonCreateRequest,
    AddPersonToCaseRequest,
    PaginatedResponse,
    SuccessResponse,
)
from src.application.services.person_service import PersonService
from src.domain.exceptions.domain_exceptions import (
    PersonNotFoundException,
    CaseNotFoundException,
)
from src.infrastructure.database.mongodb.repositories import (
    MongoPersonRepository,
    MongoCasePersonRepository,
    MongoCaseRepository,
    MongoActivityRepository,
)

router = APIRouter(prefix="/persons", tags=["Persons"])


def get_person_service() -> PersonService:
    return PersonService(
        person_repo=MongoPersonRepository(),
        case_person_repo=MongoCasePersonRepository(),
        case_repo=MongoCaseRepository(),
        activity_repo=MongoActivityRepository(),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_person(
    request: PersonCreateRequest,
    current_user: dict = Depends(require_permission("persons", "create")),
    service: PersonService = Depends(get_person_service),
):
    """Create a new person record."""
    person_id = await service.create_person(request.model_dump())
    return SuccessResponse(
        message="Person created successfully",
        data={"person_id": person_id},
    )


@router.get("", response_model=PaginatedResponse)
async def list_persons(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_permission("persons", "read")),
    service: PersonService = Depends(get_person_service),
):
    """List persons with pagination."""
    return await service.list_persons(skip=skip, limit=limit)


@router.get("/search")
async def search_persons(
    q: str = Query(..., min_length=2),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("persons", "read")),
    service: PersonService = Depends(get_person_service),
):
    """Search persons by name."""
    results = await service.search_persons(q, skip, limit)
    return {"items": results, "query": q}


@router.get("/{person_id}")
async def get_person(
    person_id: str,
    current_user: dict = Depends(require_permission("persons", "read")),
    service: PersonService = Depends(get_person_service),
):
    """Retrieve a person by ID."""
    try:
        return await service.get_person(person_id)
    except PersonNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.get("/{person_id}/cases")
async def get_cases_for_person(
    person_id: str,
    current_user: dict = Depends(require_permission("persons", "read")),
    service: PersonService = Depends(get_person_service),
):
    """Get all cases a person is involved in."""
    return await service.get_cases_for_person(person_id)


@router.post("/case-association", status_code=status.HTTP_201_CREATED)
async def add_person_to_case(
    request: AddPersonToCaseRequest,
    case_id: str = Query(...),
    current_user: dict = Depends(require_permission("cases", "update")),
    service: PersonService = Depends(get_person_service),
):
    """Associate a person with a case."""
    try:
        cp_id = await service.add_person_to_case(
            case_id=case_id,
            person_id=request.person_id,
            role_in_case=request.role_in_case,
            added_by=current_user["sub"],
            role_description=request.role_description,
            involvement_date=request.involvement_date,
            is_primary=request.is_primary,
            notes=request.notes,
        )
        return SuccessResponse(
            message="Person associated with case",
            data={"case_person_id": cp_id},
        )
    except (CaseNotFoundException, PersonNotFoundException) as e:
        raise HTTPException(status_code=404, detail=e.message)
