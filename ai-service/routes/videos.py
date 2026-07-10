import os
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from schemas.api_schemas import ProcessVideoResponse
from pipelines.video_pipeline import process_video_file
from config.settings import settings

from typing import Optional

router = APIRouter(prefix="/videos", tags=["Batch Video Processing"])

@router.post("/process", response_model=ProcessVideoResponse)
async def process_video(
    camera_id: str = Form("UPLOAD"),
    skip_frames: int = Form(5),
    target_user_id: Optional[str] = Form(None),
    video: UploadFile = File(...)
):
    """
    Upload and process a video file in batch to find faces.
    """
    try:
        if not video.content_type or not video.content_type.startswith('video/'):
            raise HTTPException(status_code=400, detail="File must be a video.")
            
        ext = os.path.splitext(video.filename)[1] if video.filename else ".mp4"
        filename = f"vid_{uuid.uuid4().hex[:8]}{ext}"
        filepath = os.path.join(settings.VIDEOS_DIR, filename)
        
        contents = await video.read()
        with open(filepath, "wb") as f:
            f.write(contents)
            
        # Process video (this blocks the event loop in this simple implementation,
        # in production this should be sent to a Celery worker or asyncio.to_thread)
        result = process_video_file(filepath, camera_id=camera_id, skip_frames=skip_frames, target_user_id=target_user_id)
        
        # Cleanup
        os.remove(filepath)
        
        result["status"] = "success"
        return result
    except HTTPException as e:
        try:
            if 'filepath' in locals() and os.path.exists(filepath):
                os.remove(filepath)
        except:
            pass
        raise e
    except Exception as e:
        import traceback
        with open('debug_error.txt', 'w') as err_file:
            err_file.write(traceback.format_exc())
        
        try:
            if 'filepath' in locals() and os.path.exists(filepath):
                os.remove(filepath)
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))
