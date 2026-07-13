from pydantic import BaseModel
from typing import List, Optional

class RegisterUserResponse(BaseModel):
    status: str
    user_id: str
    filename: str

class BatchRegisterUserResponse(BaseModel):
    status: str
    user_id: str
    images_processed: int
    images_skipped: int
    skip_reasons: List[str]
    saved_faces: List[str]

class StartStreamRequest(BaseModel):
    camera_id: str
    rtsp_url: str
    mode: str = "full_db"          # "full_db" | "target" | "multi_target"
    target_user_id: Optional[str] = None      # required when mode="target"
    target_user_ids: Optional[List[str]] = None  # required when mode="multi_target"

class StreamResponse(BaseModel):
    status: str
    message: str
    camera_id: str

class StreamStatsResponse(BaseModel):
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
    camera_id: str
    skip_frames: int = 5
    
class ProcessVideoResponse(BaseModel):
    status: str
    video: str
    processed_frames: int
    processing_time_sec: float
    timeline: List[dict]
