"""
FastAPI Routes for Data Ingestion Pipeline.
Supports CSV, Excel, and JSON uploads, import history, and detailed report retrieval.
"""

import os
import shutil
import tempfile
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Query, HTTPException, status, BackgroundTasks

from src.ingestion.pipeline import IngestionPipeline

router = APIRouter(prefix="", tags=["Data Ingestion"])
pipeline = IngestionPipeline()


@router.post("/import/csv", response_model=dict, summary="Import records from CSV file")
async def import_csv(
    file: UploadFile = File(...),
    collection: str = Query("cases", description="Target MongoDB collection name"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a .csv file",
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        report = await pipeline.ingest_file(tmp_path, collection_name=collection, file_type="csv")
        return report
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.post("/import/excel", response_model=dict, summary="Import records from Excel file")
async def import_excel(
    file: UploadFile = File(...),
    collection: str = Query("cases", description="Target MongoDB collection name"),
):
    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a .xlsx or .xls file",
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        report = await pipeline.ingest_file(tmp_path, collection_name=collection, file_type="xlsx")
        return report
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.post("/import/json", response_model=dict, summary="Import records from JSON file")
async def import_json(
    file: UploadFile = File(...),
    collection: str = Query("cases", description="Target MongoDB collection name"),
):
    if not file.filename.endswith(".json"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a .json file",
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        report = await pipeline.ingest_file(tmp_path, collection_name=collection, file_type="json")
        return report
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.get("/imports/history", summary="Get data import history")
async def get_import_history(limit: int = Query(50, ge=1, le=200)):
    return pipeline.reporter.list_history(limit=limit)


@router.get("/imports/report/{import_id}", summary="Get detailed import report")
async def get_import_report(import_id: str):
    try:
        return pipeline.reporter.get_report_by_id(import_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Import report with ID '{import_id}' not found.",
        )
