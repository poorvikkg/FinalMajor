from fastapi import APIRouter, HTTPException
from schemas.api_schemas import StartStreamRequest, StreamResponse
from pipelines.live_pipeline import stream_manager

router = APIRouter(prefix="/streams", tags=["Live Streams"])

@router.post("/start", response_model=StreamResponse)
async def start_stream(req: StartStreamRequest):
    """Start processing an RTSP stream in the background."""
    if req.camera_id in stream_manager.active_streams and stream_manager.active_streams[req.camera_id]:
        return {"status": "ignored", "message": "Stream already running", "camera_id": req.camera_id}
        
    await stream_manager.start_stream(req.camera_id, req.rtsp_url)
    return {"status": "success", "message": "Stream processing started", "camera_id": req.camera_id}

@router.post("/stop/{camera_id}", response_model=StreamResponse)
async def stop_stream(camera_id: str):
    """Stop processing an RTSP stream."""
    if camera_id not in stream_manager.active_streams or not stream_manager.active_streams[camera_id]:
        return {"status": "ignored", "message": "Stream not running", "camera_id": camera_id}
        
    await stream_manager.stop_stream(camera_id)
    return {"status": "success", "message": "Stream processing stopped", "camera_id": camera_id}

@router.get("/")
async def list_streams():
    """List all currently active streams."""
    return {"active_streams": [k for k, v in stream_manager.active_streams.items() if v]}
