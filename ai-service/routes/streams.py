"""
streams.py  —  Live Stream API Routes

Endpoints
─────────
  POST /streams/start          — Start a stream (mode-aware)
  POST /streams/stop/{id}      — Stop a stream
  GET  /streams/               — List all active streams
  GET  /streams/{id}/stats     — Get per-stream recognition stats
"""

from fastapi import APIRouter, HTTPException
from schemas.api_schemas import StartStreamRequest, StreamResponse, StreamStatsResponse
from pipelines.live_pipeline import stream_manager

router = APIRouter(prefix="/streams", tags=["Live Streams"])


@router.post("/start", response_model=StreamResponse)
async def start_stream(req: StartStreamRequest):
    """
    Start processing an RTSP stream in the background.

    mode options:
      - full_db       : compare every detected face against ALL registered persons in the DB
      - target        : 1:1 — only look for one specific person (fastest, most focused)
      - multi_target  : look for a specific list of persons (subset of DB)
    """
    # Validate mode
    valid_modes = {"full_db", "target", "multi_target"}
    if req.mode not in valid_modes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{req.mode}'. Must be one of: {sorted(valid_modes)}"
        )
    if req.mode == "target" and not req.target_user_id:
        raise HTTPException(status_code=400, detail="target_user_id is required when mode='target'")
    if req.mode == "multi_target" and not req.target_user_ids:
        raise HTTPException(status_code=400, detail="target_user_ids list is required when mode='multi_target'")

    if req.camera_id in stream_manager.streams and stream_manager.streams[req.camera_id].running:
        return {"status": "ignored", "message": "Stream already running", "camera_id": req.camera_id}

    await stream_manager.start_stream(
        camera_id=req.camera_id,
        rtsp_url=req.rtsp_url,
        mode=req.mode,
        target_user_id=req.target_user_id,
        target_user_ids=req.target_user_ids,
    )
    return {
        "status": "success",
        "message": f"Stream started in mode='{req.mode}'",
        "camera_id": req.camera_id,
    }


@router.post("/stop/{camera_id}", response_model=StreamResponse)
async def stop_stream(camera_id: str):
    """Stop processing a live stream."""
    state = stream_manager.streams.get(camera_id)
    if not state or not state.running:
        return {"status": "ignored", "message": "Stream not running", "camera_id": camera_id}

    await stream_manager.stop_stream(camera_id)
    return {"status": "success", "message": "Stream stop requested", "camera_id": camera_id}


@router.get("/", summary="List active streams")
async def list_streams():
    """List all currently active camera streams."""
    active = [
        {"camera_id": cid, "mode": s.mode, "running": s.running}
        for cid, s in stream_manager.streams.items()
        if s.running
    ]
    return {"active_streams": active, "count": len(active)}


@router.get("/{camera_id}/stats", response_model=StreamStatsResponse)
async def get_stream_stats(camera_id: str):
    """
    Get real-time recognition statistics for a running stream:
    frames processed, faces detected, confirmed matches, unknown count, effective FPS.
    """
    stats = stream_manager.get_stream_stats(camera_id)
    if stats is None:
        raise HTTPException(status_code=404, detail=f"No stream found for camera '{camera_id}'")
    return stats
