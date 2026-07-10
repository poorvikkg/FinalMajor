import cv2
import time
import asyncio
import httpx
from typing import Dict, Any
from pipelines.recognition_pipeline import RecognitionPipeline
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

class LiveStreamManager:
    def __init__(self):
        self.active_streams = {}
        
    async def start_stream(self, camera_id: str, rtsp_url: str):
        if camera_id in self.active_streams:
            logger.warning(f"Stream {camera_id} is already running.")
            return
            
        self.active_streams[camera_id] = True
        asyncio.create_task(self._process_stream(camera_id, rtsp_url))
        
    async def stop_stream(self, camera_id: str):
        if camera_id in self.active_streams:
            self.active_streams[camera_id] = False
            
    async def _process_stream(self, camera_id: str, rtsp_url: str):
        logger.info(f"Starting RTSP stream processing for camera {camera_id}")
        cap = cv2.VideoCapture(rtsp_url)
        
        # In a real system, you'd use a dedicated RTSP handler with auto-reconnect
        if not cap.isOpened():
            logger.error(f"Failed to open RTSP stream for {camera_id}")
            self.active_streams.pop(camera_id, None)
            return
            
        pipeline = RecognitionPipeline(camera_id)
        fps_cap = settings.LIVE_STREAM_FPS_CAP
        frame_time = 1.0 / fps_cap if fps_cap > 0 else 0
        
        async with httpx.AsyncClient() as client:
            while self.active_streams.get(camera_id, False):
                start_time = time.time()
                ret, frame = cap.read()
                
                if not ret:
                    logger.warning(f"Lost connection to stream {camera_id}. Reconnecting...")
                    await asyncio.sleep(5)
                    cap = cv2.VideoCapture(rtsp_url)
                    continue
                    
                # Process frame
                results = pipeline.process_frame(frame)
                
                # Push results to backend if any faces detected
                if results:
                    payload = {
                        "cameraId": camera_id,
                        "timestamp": time.time(),
                        "detections": results
                    }
                    try:
                        await client.post(f"{settings.BACKEND_API_URL}/webhooks/recognitions", json=payload)
                    except Exception as e:
                        logger.error(f"Failed to push webhook to backend: {e}")
                
                # Maintain FPS cap
                elapsed = time.time() - start_time
                if elapsed < frame_time:
                    await asyncio.sleep(frame_time - elapsed)
                else:
                    # Yield to event loop
                    await asyncio.sleep(0.001)
                    
        cap.release()
        logger.info(f"Stopped stream for camera {camera_id}")

stream_manager = LiveStreamManager()
