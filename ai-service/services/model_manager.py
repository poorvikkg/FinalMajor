"""
model_manager.py
Singleton for managing ONNX models with optimized CPU session options.
Uses all available CPU threads, memory arena, and graph optimisations.
"""
import os
import onnxruntime as ort
import numpy as np
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

def _build_session_options() -> ort.SessionOptions:
    """Build optimised ONNX session options for CPU inference."""
    opts = ort.SessionOptions()
    # Use all physical CPU threads
    opts.intra_op_num_threads = os.cpu_count() or 4
    opts.inter_op_num_threads = max(1, (os.cpu_count() or 4) // 2)
    # Maximum graph-level optimisation
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    # Memory pattern re-use across inference calls
    opts.enable_mem_pattern = True
    opts.enable_mem_reuse = True
    # Disable excessive logging
    opts.log_severity_level = 3
    return opts


class ModelManager:
    """Singleton managing ONNX inference sessions."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.sessions = {}
            # Try CUDA first, fall back to CPU
            cls._instance.providers = [
                'CUDAExecutionProvider',
                'CPUExecutionProvider',
            ]
        return cls._instance

    def load_model(self, name: str, path: str) -> ort.InferenceSession:
        if name in self.sessions:
            return self.sessions[name]['session']

        if not os.path.exists(path):
            logger.error(f"Model file not found: {path}")
            raise FileNotFoundError(f"Model file not found: {path}")

        try:
            opts = _build_session_options()
            session = ort.InferenceSession(path, sess_options=opts, providers=self.providers)
            active = session.get_providers()[0]
            logger.info(f"Loaded '{name}' model — provider: {active}")
            self.sessions[name] = {'session': session, 'provider': active, 'status': 'loaded'}
            return session
        except Exception as e:
            logger.error(f"Failed to load '{name}' from {path}: {e}")
            raise

    def get_session(self, name: str) -> ort.InferenceSession:
        if name not in self.sessions:
            raise ValueError(f"Model '{name}' not loaded.")
        return self.sessions[name]['session']

    def get_status(self):
        return {n: info['provider'] for n, info in self.sessions.items()}

    def warm_up(self):
        """Run a dummy inference on each model to pre-compile kernels."""
        logger.info("Warming up models...")
        try:
            if 'detector' in self.sessions:
                s = self.sessions['detector']['session']
                s.run(None, {s.get_inputs()[0].name: np.zeros((1, 3, 640, 640), dtype=np.float32)})
            if 'recognizer' in self.sessions:
                s = self.sessions['recognizer']['session']
                s.run(None, {s.get_inputs()[0].name: np.zeros((1, 3, 112, 112), dtype=np.float32)})
            logger.info("Model warmup complete.")
        except Exception as e:
            logger.warning(f"Warmup failed (non-fatal): {e}")


model_manager = ModelManager()
