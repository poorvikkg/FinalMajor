"""
Case API Routes — CRUD, status transitions, officer assignment, search.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.api.middleware.auth_middleware import get_current_user, require_permission
from src.api.schemas.api_schemas import (
    CaseCreateRequest,
    CaseUpdateRequest,
    CaseStatusChangeRequest,
    CaseAssignOfficerRequest,
    PaginatedResponse,
    SuccessResponse,
)
from src.application.services.case_service import CaseService
from src.domain.enums.case_status import CaseStatus
from src.domain.exceptions.domain_exceptions import (
    CaseNotFoundException,
    DuplicateFIRException,
    InvalidCaseStatusTransition,
    ReferentialIntegrityException,
)
from src.infrastructure.database.mongodb.repositories import (
    MongoCaseRepository,
    MongoActivityRepository,
    MongoStationRepository,
    MongoOfficerRepository,
)

router = APIRouter(prefix="/cases", tags=["Cases"])


def get_case_service() -> CaseService:
    return CaseService(
        case_repo=MongoCaseRepository(),
        activity_repo=MongoActivityRepository(),
        station_repo=MongoStationRepository(),
        officer_repo=MongoOfficerRepository(),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case(
    request: CaseCreateRequest,
    current_user: dict = Depends(require_permission("cases", "create")),
    service: CaseService = Depends(get_case_service),
):
    """Register a new case."""
    try:
        case_id = await service.create_case(
            request.model_dump(), created_by=current_user["sub"]
        )
        return SuccessResponse(
            message="Case registered successfully",
            data={"case_id": case_id},
        )
    except DuplicateFIRException as e:
        raise HTTPException(status_code=409, detail=e.message)
    except ReferentialIntegrityException as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("", response_model=PaginatedResponse)
async def list_cases(
    crime_type: str | None = None,
    current_status: str | None = None,
    priority: str | None = None,
    police_station_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sort_by: str = "created_at",
    current_user: dict = Depends(require_permission("cases", "read")),
    service: CaseService = Depends(get_case_service),
):
    """List cases with optional filters and pagination."""
    filters = {}
    if crime_type:
        filters["crime_type"] = crime_type
    if current_status:
        filters["current_status"] = current_status
    if priority:
        filters["priority"] = priority
    if police_station_id:
        filters["police_station_id"] = police_station_id

    return await service.list_cases(
        filters=filters, skip=skip, limit=limit, sort_by=sort_by
    )


@router.get("/search")
async def search_cases(
    q: str = Query(..., min_length=2),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("cases", "read")),
    service: CaseService = Depends(get_case_service),
):
    """Full-text search across case summaries and descriptions."""
    results = await service.search_cases(q, skip, limit)
    return {"items": results, "query": q}


@router.get("/dashboard")
async def get_dashboard(
    station_id: str | None = None,
    current_user: dict = Depends(require_permission("cases", "read")),
    service: CaseService = Depends(get_case_service),
):
    """Get aggregated case statistics for dashboard."""
    return await service.get_dashboard_stats(station_id)


@router.get("/{case_id}")
async def get_case(
    case_id: str,
    current_user: dict = Depends(require_permission("cases", "read")),
    service: CaseService = Depends(get_case_service),
):
    """Retrieve a case by ID."""
    try:
        return await service.get_case(case_id)
    except CaseNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.get("/fir/{fir_number}")
async def get_case_by_fir(
    fir_number: str,
    current_user: dict = Depends(require_permission("cases", "read")),
    service: CaseService = Depends(get_case_service),
):
    """Retrieve a case by FIR number."""
    try:
        return await service.get_case_by_fir(fir_number)
    except CaseNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.patch("/{case_id}")
async def update_case(
    case_id: str,
    request: CaseUpdateRequest,
    current_user: dict = Depends(require_permission("cases", "update")),
    service: CaseService = Depends(get_case_service),
):
    """Update case details."""
    try:
        update_data = request.model_dump(exclude_none=True)
        await service.update_case(case_id, update_data, current_user["sub"])
        return SuccessResponse(message="Case updated successfully")
    except CaseNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.post("/{case_id}/status")
async def change_case_status(
    case_id: str,
    request: CaseStatusChangeRequest,
    current_user: dict = Depends(require_permission("cases", "update")),
    service: CaseService = Depends(get_case_service),
):
    """Transition case status with validation."""
    try:
        new_status = CaseStatus(request.new_status)
        await service.change_status(
            case_id, new_status, current_user["sub"], request.reason
        )
        return SuccessResponse(
            message=f"Case status changed to {new_status.value}"
        )
    except CaseNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)
    except InvalidCaseStatusTransition as e:
        raise HTTPException(status_code=400, detail=e.message)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status value")


@router.post("/{case_id}/assign")
async def assign_officer(
    case_id: str,
    request: CaseAssignOfficerRequest,
    current_user: dict = Depends(require_permission("cases", "assign")),
    service: CaseService = Depends(get_case_service),
):
    """Assign or reassign the primary investigating officer."""
    try:
        await service.assign_officer(
            case_id, request.officer_id, current_user["sub"]
        )
        return SuccessResponse(message="Officer assigned successfully")
    except (CaseNotFoundException, ReferentialIntegrityException) as e:
        raise HTTPException(status_code=400, detail=e.message)
