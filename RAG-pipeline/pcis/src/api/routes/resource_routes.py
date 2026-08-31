"""
Generic CRUD routes for officers, stations, evidence, notes, and documents.
Consolidates straightforward endpoints that follow the same pattern.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.api.middleware.auth_middleware import get_current_user, require_permission
from src.api.schemas.api_schemas import (
    StationCreateRequest,
    OfficerCreateRequest,
    EvidenceCreateRequest,
    CaseNoteCreateRequest,
    DocumentCreateRequest,
    PaginatedResponse,
    SuccessResponse,
)
from src.infrastructure.database.mongodb.repositories import (
    MongoStationRepository,
    MongoOfficerRepository,
    MongoEvidenceRepository,
    MongoCaseNoteRepository,
    MongoDocumentRepository,
    MongoActivityRepository,
)
from src.domain.enums.activity_type import ActivityType


# ═══════════════════════════════════════════════════════════════════════════
# POLICE STATIONS
# ═══════════════════════════════════════════════════════════════════════════

station_router = APIRouter(prefix="/stations", tags=["Police Stations"])


@station_router.post("", status_code=status.HTTP_201_CREATED)
async def create_station(
    request: StationCreateRequest,
    current_user: dict = Depends(require_permission("stations", "create")),
):
    repo = MongoStationRepository()
    data = request.model_dump()
    now = datetime.utcnow()
    data["created_at"] = now
    data["updated_at"] = now
    data["is_active"] = True
    station_id = await repo.create(data)
    return SuccessResponse(message="Station created", data={"station_id": station_id})


@station_router.get("", response_model=PaginatedResponse)
async def list_stations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_permission("stations", "read")),
):
    repo = MongoStationRepository()
    items = await repo.list(skip=skip, limit=limit, sort_by="station_name", sort_order=1)
    total = await repo.count()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@station_router.get("/{station_id}")
async def get_station(
    station_id: str,
    current_user: dict = Depends(require_permission("stations", "read")),
):
    repo = MongoStationRepository()
    doc = await repo.get_by_id(station_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Station not found")
    return doc


# ═══════════════════════════════════════════════════════════════════════════
# OFFICERS
# ═══════════════════════════════════════════════════════════════════════════

officer_router = APIRouter(prefix="/officers", tags=["Officers"])


@officer_router.post("", status_code=status.HTTP_201_CREATED)
async def create_officer(
    request: OfficerCreateRequest,
    current_user: dict = Depends(require_permission("officers", "create")),
):
    repo = MongoOfficerRepository()
    data = request.model_dump()
    now = datetime.utcnow()
    data["created_at"] = now
    data["updated_at"] = now
    data["employment_status"] = "ACTIVE"
    officer_id = await repo.create(data)
    return SuccessResponse(message="Officer created", data={"officer_id": officer_id})


@officer_router.get("", response_model=PaginatedResponse)
async def list_officers(
    station_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_permission("officers", "read")),
):
    repo = MongoOfficerRepository()
    filters = {}
    if station_id:
        filters["station_id"] = station_id
    items = await repo.list(filters=filters, skip=skip, limit=limit, sort_by="display_name", sort_order=1)
    total = await repo.count(filters)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@officer_router.get("/{officer_id}")
async def get_officer(
    officer_id: str,
    current_user: dict = Depends(require_permission("officers", "read")),
):
    repo = MongoOfficerRepository()
    doc = await repo.get_by_id(officer_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Officer not found")
    return doc


# ═══════════════════════════════════════════════════════════════════════════
# EVIDENCE
# ═══════════════════════════════════════════════════════════════════════════

evidence_router = APIRouter(prefix="/evidence", tags=["Evidence"])


@evidence_router.post("", status_code=status.HTTP_201_CREATED)
async def create_evidence(
    request: EvidenceCreateRequest,
    current_user: dict = Depends(require_permission("evidence", "create")),
):
    repo = MongoEvidenceRepository()
    activity_repo = MongoActivityRepository()
    data = request.model_dump()
    now = datetime.utcnow()
    data["created_at"] = now
    data["updated_at"] = now
    data["current_status"] = "COLLECTED"
    data["forensic_status"] = "NOT_SUBMITTED"
    evidence_id = await repo.create(data)

    await activity_repo.create({
        "case_id": data["case_id"],
        "activity_type": ActivityType.EVIDENCE_COLLECTED.value,
        "performed_by": current_user["sub"],
        "timestamp": now,
        "entity_type": "evidence",
        "entity_id": evidence_id,
        "remarks": f"Evidence collected: {data['evidence_type']}",
        "created_at": now,
    })

    return SuccessResponse(message="Evidence recorded", data={"evidence_id": evidence_id})


@evidence_router.get("/case/{case_id}")
async def get_evidence_for_case(
    case_id: str,
    current_user: dict = Depends(require_permission("evidence", "read")),
):
    repo = MongoEvidenceRepository()
    return await repo.get_by_case(case_id)


# ═══════════════════════════════════════════════════════════════════════════
# CASE NOTES
# ═══════════════════════════════════════════════════════════════════════════

note_router = APIRouter(prefix="/notes", tags=["Case Notes"])


@note_router.post("", status_code=status.HTTP_201_CREATED)
async def create_note(
    request: CaseNoteCreateRequest,
    current_user: dict = Depends(require_permission("case_notes", "create")),
):
    repo = MongoCaseNoteRepository()
    activity_repo = MongoActivityRepository()
    data = request.model_dump()
    now = datetime.utcnow()
    data["officer_id"] = current_user.get("officer_id", current_user["sub"])
    data["created_at"] = now
    data["updated_at"] = now
    note_id = await repo.create(data)

    await activity_repo.create({
        "case_id": data["case_id"],
        "activity_type": ActivityType.NOTE_ADDED.value,
        "performed_by": current_user["sub"],
        "timestamp": now,
        "entity_type": "case_note",
        "entity_id": note_id,
        "remarks": f"Note added: {data['title']}",
        "created_at": now,
    })

    return SuccessResponse(message="Note added", data={"note_id": note_id})


@note_router.get("/case/{case_id}")
async def get_notes_for_case(
    case_id: str,
    confidentiality_level: str | None = None,
    current_user: dict = Depends(require_permission("case_notes", "read")),
):
    repo = MongoCaseNoteRepository()
    return await repo.get_by_case(case_id, confidentiality_level)


# ═══════════════════════════════════════════════════════════════════════════
# CASE DOCUMENTS
# ═══════════════════════════════════════════════════════════════════════════

document_router = APIRouter(prefix="/documents", tags=["Case Documents"])


@document_router.post("", status_code=status.HTTP_201_CREATED)
async def create_document(
    request: DocumentCreateRequest,
    current_user: dict = Depends(require_permission("documents", "create")),
):
    repo = MongoDocumentRepository()
    activity_repo = MongoActivityRepository()
    data = request.model_dump()
    now = datetime.utcnow()
    data["uploaded_by"] = current_user["sub"]
    data["upload_date"] = now
    data["ocr_status"] = "NOT_APPLICABLE"
    data["created_at"] = now
    data["updated_at"] = now
    doc_id = await repo.create(data)

    await activity_repo.create({
        "case_id": data["case_id"],
        "activity_type": ActivityType.DOCUMENT_UPLOADED.value,
        "performed_by": current_user["sub"],
        "timestamp": now,
        "entity_type": "case_document",
        "entity_id": doc_id,
        "remarks": f"Document uploaded: {data['document_title']}",
        "created_at": now,
    })

    return SuccessResponse(message="Document created", data={"document_id": doc_id})


@document_router.get("/case/{case_id}")
async def get_documents_for_case(
    case_id: str,
    document_type: str | None = None,
    current_user: dict = Depends(require_permission("documents", "read")),
):
    repo = MongoDocumentRepository()
    return await repo.get_by_case(case_id, document_type)


@document_router.get("/search")
async def search_documents(
    q: str = Query(..., min_length=2),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("documents", "read")),
):
    repo = MongoDocumentRepository()
    results = await repo.search_ocr_text(q, skip, limit)
    return {"items": results, "query": q}


# ═══════════════════════════════════════════════════════════════════════════
# ACTIVITIES (Read-only audit trail)
# ═══════════════════════════════════════════════════════════════════════════

activity_router = APIRouter(prefix="/activities", tags=["Activities"])


@activity_router.get("/case/{case_id}")
async def get_activities_for_case(
    case_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(require_permission("cases", "read")),
):
    repo = MongoActivityRepository()
    return await repo.get_by_case(case_id, skip, limit)
