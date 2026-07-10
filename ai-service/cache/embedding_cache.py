import numpy as np
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)

class EmbeddingCache:
    """
    RAM cache for embeddings to prevent MongoDB queries during recognition.
    Stores { user_id: [embedding1, embedding2, ...] }
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EmbeddingCache, cls).__new__(cls)
            cls._instance.embeddings: Dict[str, List[np.ndarray]] = {}
            cls._instance.total_count = 0
        return cls._instance
        
    def add(self, user_id: str, embedding: np.ndarray):
        if user_id not in self.embeddings:
            self.embeddings[user_id] = []
        self.embeddings[user_id].append(embedding.astype(np.float32))
        self.total_count += 1
        
    def get(self, user_id: str) -> List[np.ndarray]:
        return self.embeddings.get(user_id, [])
        
    def remove(self, user_id: str):
        if user_id in self.embeddings:
            count = len(self.embeddings[user_id])
            del self.embeddings[user_id]
            self.total_count -= count
            
    def clear(self):
        self.embeddings.clear()
        self.total_count = 0
        
    def get_all(self) -> Tuple[List[str], List[np.ndarray]]:
        """Returns flattened lists of ids and embeddings for FAISS initialization"""
        ids = []
        vecs = []
        for uid, emb_list in self.embeddings.items():
            for emb in emb_list:
                ids.append(uid)
                vecs.append(emb)
        return ids, vecs

embedding_cache = EmbeddingCache()
