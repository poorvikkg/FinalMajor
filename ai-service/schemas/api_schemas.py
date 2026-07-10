from pydantic import BaseModel
from typing import List, Optional

class RegisterUserResponse(BaseModel):
    status: str
    user_id: str
    filename: str

class StartStreamRequest(BaseModel):
    camera_id: str
    rtsp_url: str

class StreamResponse(BaseModel):
    status: str
    message: str
    camera_id: str

class ProcessVideoRequest(BaseModel):
    camera_id: str
    skip_frames: int = 5
    
class ProcessVideoResponse(BaseModel):
    status: str
    video: str
    processed_frames: int
    processing_time_sec: float
    timeline: List[dict]
