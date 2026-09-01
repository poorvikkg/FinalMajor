"""
settings.py - Centralized configuration and environment settings for the AI service.
Defines model paths, processing thresholds, FAISS index directories, and database parameters.
"""
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Surveillance AI Service"
    DEBUG: bool = True
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    MODEL_DIR: str = os.path.join(BASE_DIR, "models", "weights")
    FAISS_DIR: str = os.path.join(BASE_DIR, "faiss", "index")
    UPLOADS_DIR: str = os.path.join(BASE_DIR, "uploads")
    FACES_DIR: str = os.path.join(BASE_DIR, "faces")
    UNKNOWN_DIR: str = os.path.join(BASE_DIR, "unknown")
    VIDEOS_DIR: str = os.path.join(BASE_DIR, "videos")
    # Snapshots are saved here so the backend can serve them as /uploads/<filename>
    SNAPSHOTS_DIR: str = os.path.join(BASE_DIR, "..", "backend", "uploads", "snapshots")
    
    # MongoDB Integration (For Startup Sync Only)
    MONGODB_URI: str = "mongodb://localhost:27017/surveillance_db"
    MONGODB_COLLECTION_EMBEDDINGS: str = "complaints" # complaints store the searchVector (face embedding)
    
    # Model Configurations
    DETECTOR_MODEL_PATH: str = os.path.join(MODEL_DIR, "detector", "scrfd_2.5g_bnkps.onnx")
    RECOGNIZER_MODEL_PATH: str = os.path.join(MODEL_DIR, "recognizer", "w600k_r50.onnx")
    
    # Thresholds & Limits
    DETECTION_THRESHOLD: float = 0.5
    RECOGNITION_THRESHOLD: float = 0.30
    UNKNOWN_FACE_THRESHOLD: float = 0.40
    MIN_FACE_SIZE: int = 40          # minimum face bounding-box side in pixels
    BLUR_THRESHOLD: float = 50.0    # Laplacian variance threshold (higher = stricter)
    BATCH_SIZE: int = 4
    FRAME_SKIP: int = 3             # process every Nth frame (was 5)
    CAMERA_TIMEOUT: int = 15
    WORKER_COUNT: int = 4
    
    # Tracking Cache TTL (seconds)
    RECOGNITION_CACHE_TTL: int = 5
    
    # Backend Integration
    BACKEND_API_URL: str = "http://localhost:5000/api"
    
    # Frame Processing
    LIVE_STREAM_FPS_CAP: int = 15

    # ── Unknown Person Clustering ─────────────────────────
    UNKNOWN_MATCH_THRESHOLD: float = 0.50       # cosine sim for unknown-to-unknown FAISS match
    UNKNOWN_CONFIRMATION_FRAMES: int = 3        # multi-frame confirmation before creating identity
    UNKNOWN_RECURRING_VIDEO_THRESHOLD: int = 4  # distinct videos → RECURRING
    UNKNOWN_REVIEW_VIDEO_THRESHOLD: int = 11    # distinct videos → REVIEW_REQUIRED
    UNKNOWN_MIN_QUALITY_SCORE: float = 50.0     # min Laplacian variance for unknown face quality
    UNKNOWN_SNAPSHOTS_DIR: str = os.path.join(BASE_DIR, "..", "backend", "uploads", "unknown_snapshots")
    UNKNOWN_MONGODB_COLLECTION: str = "unknownpersons"
    
    # ── AI RAG Pipeline ──────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"
    RAG_DATA_DIR: str = os.path.join(BASE_DIR, "rag", "data", "crime_statistics")
    RAG_FAISS_DIR: str = os.path.join(BASE_DIR, "rag", "vectorstore", "storage")
    TOP_K: int = 5
    LLM_TIMEOUT_SECONDS: int = 60

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure directories exist
for directory in [
    settings.FAISS_DIR, 
    settings.UPLOADS_DIR, 
    settings.FACES_DIR, 
    settings.UNKNOWN_DIR, 
    settings.VIDEOS_DIR,
    settings.SNAPSHOTS_DIR,
    settings.UNKNOWN_SNAPSHOTS_DIR,
    os.path.join(settings.BASE_DIR, "logs")
]:
    os.makedirs(directory, exist_ok=True)
