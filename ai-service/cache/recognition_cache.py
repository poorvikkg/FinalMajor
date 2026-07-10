import time
from cachetools import TTLCache
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

class RecognitionCache:
    """
    Cache to prevent re-recognizing the same tracked person repeatedly.
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RecognitionCache, cls).__new__(cls)
            # Store (user_id, confidence) with a TTL
            cls._instance.cache = TTLCache(maxsize=10000, ttl=settings.RECOGNITION_CACHE_TTL)
        return cls._instance
        
    def add(self, track_id: int, user_id: str, confidence: float):
        """Add a successful recognition to the cache."""
        self.cache[track_id] = {
            "user_id": user_id,
            "confidence": confidence,
            "timestamp": time.time()
        }
        
    def get(self, track_id: int):
        """Get cached recognition if it exists and hasn't expired."""
        return self.cache.get(track_id)
        
    def remove(self, track_id: int):
        if track_id in self.cache:
            del self.cache[track_id]

recognition_cache = RecognitionCache()
