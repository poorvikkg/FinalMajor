import os
import faiss
import numpy as np
from typing import Tuple, List, Optional
from config.settings import settings
from cache.embedding_cache import embedding_cache
from services.logger import sys_logger, err_logger

class FaissManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaissManager, cls).__new__(cls)
            cls._instance.index = None
            cls._instance.id_map = {} # Internal mapping from faiss index ID to user ID string
            cls._instance.dim = 512
            cls._instance.index_path = os.path.join(settings.FAISS_DIR, "index.bin")
        return cls._instance

    def build_from_cache(self):
        """Build the FAISS index entirely from the RAM embedding cache."""
        sys_logger.info("Building FAISS index from RAM cache...")
        self.index = faiss.IndexFlatIP(self.dim)
        self.id_map.clear()
        
        ids, vecs = embedding_cache.get_all()
        if len(vecs) > 0:
            embeddings_np = np.vstack(vecs).astype('float32')
            # Normalize just in case
            faiss.normalize_L2(embeddings_np)
            self.index.add(embeddings_np)
            
            for i, uid in enumerate(ids):
                self.id_map[i] = uid
                
        sys_logger.info(f"FAISS index built with {self.index.ntotal} embeddings.")

    def add_user(self, user_id: str, embedding: np.ndarray):
        if self.index is None:
            self.build_from_cache()
            
        embedding_np = np.array([embedding], dtype=np.float32)
        faiss.normalize_L2(embedding_np)
        
        faiss_id = self.index.ntotal
        self.index.add(embedding_np)
        self.id_map[faiss_id] = user_id
        
    def search(self, embedding: np.ndarray, threshold: float = settings.RECOGNITION_THRESHOLD) -> Optional[Tuple[str, float]]:
        if self.index is None or self.index.ntotal == 0:
            return None
            
        embedding_np = np.array([embedding], dtype=np.float32)
        faiss.normalize_L2(embedding_np)
        
        distances, indices = self.index.search(embedding_np, 1)
        
        distance = float(distances[0][0])
        idx = int(indices[0][0])
        
        if distance >= threshold and idx in self.id_map:
            return self.id_map[idx], distance
            
        return None

    def save_index(self):
        if self.index is not None:
            faiss.write_index(self.index, self.index_path)

faiss_manager = FaissManager()
