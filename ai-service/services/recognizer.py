"""
recognizer.py - ArcFace (w600k_r50) Feature Embedding Extraction Service.
Extracts 512-dimensional L2-normalized feature vectors from aligned 112x112 facial images.
"""
import cv2
import numpy as np
from services.model_manager import model_manager
from services.logger import sys_logger, err_logger

class FaceRecognizer:
    """Singleton wrapper around the ArcFace feature extractor ONNX session."""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceRecognizer, cls).__new__(cls)
        return cls._instance

    @property
    def session(self):
        """Get active ONNX runtime session for recognizer."""
        try:
            return model_manager.get_session("recognizer")
        except ValueError:
            return None

    def get_embedding(self, aligned_face: np.ndarray) -> np.ndarray:
        """
        Generate 512-dimensional normalized embedding for aligned face image.
        Args:
            aligned_face: 112x112 BGR facial crop
        Returns:
            512-dim float32 L2-normalized numpy array
        """
        sess = self.session
        if sess is None:
            err_logger.error("Recognizer session is None. Cannot generate embedding.")
            raise ValueError("Recognizer ONNX model not loaded.")
            
        img = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2RGB)
        img = np.transpose(img, (2, 0, 1))
        img = (img / 127.5) - 1.0
        img = img.astype(np.float32)
        blob = np.expand_dims(img, axis=0)
        
        input_name = sess.get_inputs()[0].name
        net_outs = sess.run(None, {input_name: blob})
        embedding = net_outs[0][0]
        
        embedding = embedding / np.linalg.norm(embedding)
        return embedding

recognizer = FaceRecognizer()


