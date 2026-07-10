"""
recognition_pipeline.py
Advanced face recognition pipeline with:
  - Correct track-to-keypoint matching via IoU (not always kpss[0])
  - Face quality gating (blur score + minimum face size)
  - Per-track recognition caching to avoid repeated ONNX calls
"""
import time
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import cv2

from services.detector import detector
from services.recognizer import recognizer
from services.tracker import Tracker           # per-pipeline instance, not global
from services.faiss_manager import faiss_manager
from services.image_processing import align_face
from cache.recognition_cache import recognition_cache
from config.settings import settings
from services.logger import rec_logger, err_logger


# ── Face quality helpers ──────────────────────────────────────────────────────

def _laplacian_variance(img_gray: np.ndarray) -> float:
    """Measure sharpness via Laplacian variance. Higher = sharper."""
    return float(cv2.Laplacian(img_gray, cv2.CV_64F).var())


def _face_quality_ok(frame: np.ndarray, bbox: np.ndarray, min_size: int = 40, blur_thresh: float = 50.0) -> bool:
    """Return True if the face crop is big enough and not blurry."""
    x1, y1, x2, y2 = bbox[:4].astype(int)
    w, h = x2 - x1, y2 - y1
    if w < min_size or h < min_size:
        return False
    face = frame[max(0, y1):y2, max(0, x1):x2]
    if face.size == 0:
        return False
    gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
    return _laplacian_variance(gray) >= blur_thresh


def _best_kps_for_bbox(bbox: np.ndarray, kpss: np.ndarray) -> Optional[np.ndarray]:
    """
    Pick the keypoint set (5 landmarks) that corresponds to the given bbox.
    We find the kps whose centroid falls inside the bbox.
    Returns None if nothing matches (face too small / cropped).
    """
    if kpss is None or len(kpss) == 0:
        return None
    x1, y1, x2, y2 = bbox[:4]
    best_kps = None
    best_dist = float('inf')
    cx_bbox = (x1 + x2) / 2
    cy_bbox = (y1 + y2) / 2
    for kps in kpss:
        cx = kps[:, 0].mean()
        cy = kps[:, 1].mean()
        # Check centroid is roughly inside bbox
        if x1 <= cx <= x2 and y1 <= cy <= y2:
            dist = (cx - cx_bbox) ** 2 + (cy - cy_bbox) ** 2
            if dist < best_dist:
                best_dist = dist
                best_kps = kps
    return best_kps


# ── Pipeline ──────────────────────────────────────────────────────────────────

class RecognitionPipeline:
    def __init__(self, camera_id: str, target_user_id: str = None):
        self.camera_id = camera_id
        # Each pipeline gets its own tracker so state doesn't bleed between cameras
        self.tracker_instance = Tracker(max_age=30)
        self.target_user_id = target_user_id

        if self.target_user_id and self.target_user_id != "undefined":
            from cache.embedding_cache import embedding_cache
            self.target_embeddings: List[np.ndarray] = [
                e for e in embedding_cache.get(self.target_user_id)
                if e.size == 512
            ]
        else:
            self.target_embeddings = []

    # ── frame entry point ────────────────────────────────────────────────────
    def process_frame(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        t0 = time.time()

        # 1. Detect
        bboxes, kpss = detector.detect(frame, threshold=settings.DETECTION_THRESHOLD)
        if len(bboxes) == 0:
            return []

        # 2. Track
        formatted = [{'bbox': b[:4].tolist()} for b in bboxes]
        tracks = self.tracker_instance.update(formatted)

        results = []

        for track in tracks:
            track_id  = track['id']
            bbox      = np.array(track['bbox'])

            # 2a. Check recognition cache (avoid ONNX on every frame)
            cached = recognition_cache.get(track_id)
            if cached is not None:
                results.append({
                    "track_id":  track_id,
                    "user_id":   cached["user_id"],
                    "confidence": cached["confidence"],
                    "bbox":      bbox.tolist(),
                    "cached":    True,
                })
                continue

            # 2b. Quality gate — skip blurry / tiny faces
            if not _face_quality_ok(frame, bbox,
                                    min_size=settings.MIN_FACE_SIZE,
                                    blur_thresh=settings.BLUR_THRESHOLD):
                continue

            # 2c. Match keypoints to THIS face's bbox (not always kpss[0]!)
            kps = _best_kps_for_bbox(bbox, kpss)
            if kps is None:
                continue

            # 3. Align → embed
            try:
                aligned = align_face(frame, kps)
                embedding = recognizer.get_embedding(aligned)
            except Exception as e:
                err_logger.warning(f"Embed error track {track_id}: {e}")
                continue

            # 4. Match
            match: Optional[Tuple[str, float]] = None

            if self.target_embeddings:
                # 1:1 verification against target person
                emb_norm = np.linalg.norm(embedding)
                if emb_norm < 1e-6:
                    continue
                sims = [
                    float(np.dot(embedding, t) / (emb_norm * np.linalg.norm(t)))
                    for t in self.target_embeddings
                    if t.size == 512 and np.linalg.norm(t) > 1e-6
                ]
                if sims:
                    max_sim = max(sims)
                    if max_sim >= settings.RECOGNITION_THRESHOLD:
                        match = (self.target_user_id, max_sim)
            else:
                # 1:N search via FAISS
                match = faiss_manager.search(embedding, threshold=settings.RECOGNITION_THRESHOLD)

            # 5. Build result
            if match:
                user_id, conf = match
                recognition_cache.add(track_id, user_id, conf)
                results.append({
                    "track_id":   track_id,
                    "user_id":    user_id,
                    "confidence": conf,
                    "bbox":       bbox.tolist(),
                    "cached":     False,
                })
            else:
                results.append({
                    "track_id":   track_id,
                    "user_id":    "unknown",
                    "confidence": 0.0,
                    "bbox":       bbox.tolist(),
                    "cached":     False,
                })

        elapsed = time.time() - t0
        if results:
            rec_logger.info(
                f"Camera {self.camera_id}: {len(results)} results in {elapsed:.3f}s"
            )

        return results
