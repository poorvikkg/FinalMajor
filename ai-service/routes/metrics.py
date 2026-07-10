import psutil
from fastapi import APIRouter
from config.settings import settings
from services.model_manager import model_manager
from services.faiss_manager import faiss_manager
from cache.embedding_cache import embedding_cache

router = APIRouter(tags=["Metrics"])

@router.get("/metrics")
async def get_metrics():
    """Return system metrics like RAM, CPU, GPU, and FPS stats."""
    return {
        "cpu_percent": psutil.cpu_percent(),
        "ram_percent": psutil.virtual_memory().percent,
        "ram_used_mb": psutil.virtual_memory().used / (1024 * 1024),
        "total_embeddings_in_ram": embedding_cache.total_count
    }

@router.get("/models/status")
async def get_models_status():
    """Return which models are loaded and their execution providers."""
    return {
        "status": "ok",
        "models": model_manager.get_status()
    }

@router.get("/faiss/status")
async def get_faiss_status():
    """Return status of the FAISS index."""
    ntotal = 0
    if faiss_manager.index is not None:
        ntotal = faiss_manager.index.ntotal
        
    return {
        "status": "ok",
        "is_loaded": faiss_manager.index is not None,
        "dimension": faiss_manager.dim,
        "total_embeddings_indexed": ntotal
    }
