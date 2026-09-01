"""
FastAPI Routes for Dataset Generation & Operations.
"""

import os
import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from src.dataset_generator.engine import DatasetGeneratorEngine, generate_synthetic_dataset
from src.config.database import DatabaseManager

router = APIRouter(prefix="/dataset", tags=["Dataset Generator"])


class GenerateDatasetRequest(BaseModel):
    num_stations: int = Field(20, ge=1, le=100)
    num_officers: int = Field(200, ge=1, le=1000)
    num_persons: int = Field(5000, ge=1, le=50000)
    num_cases: int = Field(1000, ge=1, le=20000)
    seed_db: bool = Field(False, description="Seed generated records into MongoDB")


@router.post("/generate", summary="Trigger Synthetic Dataset Generation")
async def generate_dataset_endpoint(req: Optional[GenerateDatasetRequest] = None):
    if req is None:
        req = GenerateDatasetRequest()

    engine = DatasetGeneratorEngine(
        num_stations=req.num_stations,
        num_officers=req.num_officers,
        num_persons=req.num_persons,
        num_cases=req.num_cases,
    )
    dataset = engine.generate_all()
    summary = engine.exporter.export_all(dataset)

    inserted_counts = {}
    if req.seed_db:
        inserted_counts = await engine.seed_mongodb(dataset)

    return {
        "status": "success",
        "message": "Dataset generated and exported successfully.",
        "counts": {k: len(v) for k, v in dataset.items()},
        "seeded_mongodb": req.seed_db,
        "seeded_counts": inserted_counts,
        "files": summary,
    }


@router.get("/download", summary="Download generated dataset file")
async def download_dataset(
    format: str = Query("json", description="Format: json, csv, or excel"),
    collection: str = Query("cases", description="Collection name, or 'all_collections' / 'police_master_dataset'"),
):
    fmt = format.lower()
    if fmt == "json":
        file_path = Path("sample_data/json") / f"{collection}.json"
        media_type = "application/json"
    elif fmt == "csv":
        file_path = Path("sample_data/csv") / f"{collection}.csv"
        media_type = "text/csv"
    elif fmt in ["excel", "xlsx"]:
        file_path = Path("sample_data/excel") / f"{collection}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{format}'. Use json, csv, or excel.",
        )

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset file '{file_path}' not found. Run dataset generation first.",
        )

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type=media_type,
    )


@router.post("/reset", summary="Reset MongoDB database and clear sample_data files")
async def reset_dataset():
    # Clear sample_data
    sample_dir = Path("sample_data")
    if sample_dir.exists():
        shutil.rmtree(sample_dir)
    sample_dir.mkdir(exist_ok=True)

    # Clear MongoDB collections
    cleared_collections = []
    try:
        db = DatabaseManager.get_database()
        collections = await db.list_collection_names()
        for coll in collections:
            await db[coll].delete_many({})
            cleared_collections.append(coll)
    except Exception as e:
        pass

    return {
        "status": "success",
        "message": "Database and sample data reset complete.",
        "cleared_collections": cleared_collections,
    }
