"""
api_schemas.py - Pydantic models and schemas for AI service API requests and responses.
"""
from pydantic import BaseModel
from typing import List, Optional

class RegisterUserResponse(BaseModel):
    """Response schema for single image face registration."""
    status: str
    user_id: str
    filename: str

class BatchRegisterUserResponse(BaseModel):
    """Response schema for multi-image batch face registration."""
    status: str
    user_id: str
    images_processed: int
    images_skipped: int
    skip_reasons: List[str]
    saved_faces: List[str]

class StartStreamRequest(BaseModel):
    """Request payload to initiate live RTSP stream surveillance."""
    camera_id: str
    rtsp_url: str
    mode: str = "full_db"          # "full_db" | "target" | "multi_target"
    target_user_id: Optional[str] = None      # required when mode="target"
    target_user_ids: Optional[List[str]] = None  # required when mode="multi_target"

class StreamResponse(BaseModel):
    """Standard response model for stream operations."""
    status: str
    message: str
    camera_id: str

class StreamStatsResponse(BaseModel):
    """Real-time performance and recognition statistics for an active camera stream."""
    camera_id: str
    running: bool
    mode: str
    target_user_id: Optional[str] = None
    uptime_sec: Optional[float] = None
    frames_processed: Optional[int] = None
    faces_detected: Optional[int] = None
    matches_confirmed: Optional[int] = None
    unknowns: Optional[int] = None
    fps_effective: Optional[float] = None

class ProcessVideoRequest(BaseModel):
    """Request payload for processing pre-recorded video files."""
    camera_id: str
    skip_frames: int = 5
    
class ProcessVideoResponse(BaseModel):
    """Response payload containing video detection timeline and processed metrics."""
    status: str
    video: str
    processed_frames: int
    processing_time_sec: float
    timeline: List[dict]
