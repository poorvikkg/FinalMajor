import cv2
import time
import os
import uuid
import logging
import httpx
import asyncio
from config.settings import settings

logger = logging.getLogger(__name__)

class UnknownFaceManager:
    def __init__(self):
        # Cache to prevent spamming the backend for the same unknown face
        # In a real system, you'd use a small temporal FAISS index or Tracker IDs
        self.recent_unknowns = {}
        self.cooldown_seconds = 60 # Prevent duplicate alerts within 60s
        
    async def report_unknown(self, camera_id: str, frame, bbox):
        """
        Handle a detected unknown face.
        """
        # Clean up old cache
        current_time = time.time()
        self.recent_unknowns = {k: v for k, v in self.recent_unknowns.items() if current_time - v < self.cooldown_seconds}
        
        # Simple spatial deduplication (if a box is similar to a recent unknown, ignore it)
        # For this boilerplate, we'll just throttle globally per camera
        if camera_id in self.recent_unknowns:
            return
            
        self.recent_unknowns[camera_id] = current_time
        
        # Save crop
        x1, y1, x2, y2 = map(int, bbox)
        crop = frame[max(0, y1):min(frame.shape[0], y2), max(0, x1):min(frame.shape[1], x2)]
        
        filename = f"unknown_{camera_id}_{uuid.uuid4().hex[:8]}.jpg"
        filepath = os.path.join(settings.UNKNOWN_DIR, filename)
        
        if crop.size > 0:
            cv2.imwrite(filepath, crop)
            
        # Send alert to backend
        payload = {
            "cameraId": camera_id,
            "timestamp": current_time,
            "imagePath": filepath
        }
        
        async with httpx.AsyncClient() as client:
            try:
                await client.post(f"{settings.BACKEND_API_URL}/webhooks/unknown-faces", json=payload)
                logger.info(f"Reported unknown face on camera {camera_id}")
            except Exception as e:
                logger.error(f"Failed to push unknown face alert: {e}")

unknown_manager = UnknownFaceManager()
