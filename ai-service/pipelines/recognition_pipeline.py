"""
recognition_pipeline.py  —  Advanced Live Stream Face Recognition

Detection Modes
───────────────
  full_db      : 1:N search across entire FAISS index (default)
  target       : 1:1 verification against one specific complaint/person
  multi_target : 1:N search but only among a given list of user IDs

Advanced Features
─────────────────
  • Multi-frame voting  — a match is "confirmed" only after being seen
    consistently across VOTE_FRAMES consecutive frames for the same track.
    Eliminates single-frame false positives.
  • Per-track confidence accumulator  — tracks the rolling average confidence
    for each track ID so results get more reliable over time.
  • Face quality gate  — blur + minimum size filter.
  • Snapshot saved to disk on confirmed match (SNAPSHOTS_DIR).
  • Per-track recognition cache (TTL-based) to skip redundant ONNX calls.
  • Correct keypoint→bbox matching via centroid IoU (not always kpss[0]).
"""

import os
import time
import uuid
import cv2
import faiss
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from services.detector import detector
from services.recognizer import recognizer
from services.tracker import Tracker
from services.faiss_manager import faiss_manager
from cache.embedding_cache import embedding_cache
from cache.recognition_cache import recognition_cache
from services.image_processing import align_face
from config.settings import settings
from services.logger import rec_logger, err_logger


# ── Constants ─────────────────────────────────────────────────────────────────

VOTE_FRAMES   = 3       # consecutive frames needed to confirm a match
MAX_VOTE_GAP  = 5       # if no vote for this many frames, reset the vote chain


# ── Helpers ───────────────────────────────────────────────────────────────────

def _laplacian_variance(img_gray: np.ndarray) -> float:
    return float(cv2.Laplacian(img_gray, cv2.CV_64F).var())


def _face_quality_score(frame: np.ndarray, bbox: np.ndarray) -> Tuple[bool, float]:
    """
    Returns (is_ok, sharpness_score).
    is_ok = passes minimum size + blur thresholds.
    """
    x1, y1, x2, y2 = bbox[:4].astype(int)
    w, h = x2 - x1, y2 - y1
    if w < settings.MIN_FACE_SIZE or h < settings.MIN_FACE_SIZE:
        return False, 0.0
    face = frame[max(0, y1):y2, max(0, x1):x2]
    if face.size == 0:
        return False, 0.0
    gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
    score = _laplacian_variance(gray)
    return score >= settings.BLUR_THRESHOLD, round(score, 2)


def _best_kps_for_bbox(bbox: np.ndarray, kpss: np.ndarray) -> Optional[np.ndarray]:
    """Pick the keypoint set whose centroid falls inside the given bbox."""
    if kpss is None or len(kpss) == 0:
        return None
    x1, y1, x2, y2 = bbox[:4]
    best_kps, best_dist = None, float("inf")
    cx_bbox, cy_bbox = (x1 + x2) / 2, (y1 + y2) / 2
    for kps in kpss:
        cx, cy = kps[:, 0].mean(), kps[:, 1].mean()
        if x1 <= cx <= x2 and y1 <= cy <= y2:
            dist = (cx - cx_bbox) ** 2 + (cy - cy_bbox) ** 2
            if dist < best_dist:
                best_dist, best_kps = dist, kps
    return best_kps


def _save_snapshot(frame: np.ndarray, bbox: np.ndarray, track_id: int, user_id: str) -> str:
    """Crop face region and save as snapshot. Returns the saved filename."""
    x1, y1, x2, y2 = bbox[:4].astype(int)
    pad = 20
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(frame.shape[1], x2 + pad)
    y2 = min(frame.shape[0], y2 + pad)
    crop = frame[y1:y2, x1:x2]
    filename = f"snap_{user_id}_{track_id}_{uuid.uuid4().hex[:6]}.jpg"
    filepath = os.path.join(settings.SNAPSHOTS_DIR, filename)
    cv2.imwrite(filepath, crop)
    return filename


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na < 1e-6 or nb < 1e-6:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ── Pipeline ──────────────────────────────────────────────────────────────────

class RecognitionPipeline:
    """
    One pipeline instance per camera stream.

    Parameters
    ----------
    camera_id       : str   — unique camera identifier
    mode            : str   — "full_db" | "target" | "multi_target"
    target_user_id  : str   — required when mode="target"
    target_user_ids : list  — required when mode="multi_target"
    """

    def __init__(
        self,
        camera_id: str,
        mode: str = "full_db",
        target_user_id: Optional[str] = None,
        target_user_ids: Optional[List[str]] = None,
    ):
        self.camera_id = camera_id
        self.mode = mode
        self.tracker_instance = Tracker(max_age=30)

        # ── Mode: target (1:1 verification) ──────────────────────────────────
        self.target_user_id = target_user_id
        self.target_embeddings: List[np.ndarray] = []
        if mode == "target" and target_user_id and target_user_id != "undefined":
            self.target_embeddings = [
                e for e in embedding_cache.get(target_user_id) if e.size == 512
            ]
            rec_logger.info(
                f"[{camera_id}] Mode=target | user={target_user_id} | "
                f"{len(self.target_embeddings)} reference embeddings loaded"
            )

        # ── Mode: multi_target (1:N among subset) ────────────────────────────
        self.multi_target_ids = set(target_user_ids or [])
        self.multi_target_embeddings: Dict[str, List[np.ndarray]] = {}
        if mode == "multi_target" and self.multi_target_ids:
            for uid in self.multi_target_ids:
                embs = [e for e in embedding_cache.get(uid) if e.size == 512]
                if embs:
                    self.multi_target_embeddings[uid] = embs
            rec_logger.info(
                f"[{camera_id}] Mode=multi_target | {len(self.multi_target_embeddings)} "
                f"persons loaded from {len(self.multi_target_ids)} requested IDs"
            )

        # ── Vote tracking (multi-frame confirmation) ──────────────────────────
        # { track_id: {"user_id": str, "votes": int, "confidences": [float], "last_frame": int} }
        self._vote_state: Dict[int, Dict] = defaultdict(
            lambda: {"user_id": None, "votes": 0, "confidences": [], "last_frame": -99}
        )
        self._frame_idx = 0

        # ── Alert deduplication  ──────────────────────────────────────────────
        # Set of (track_id, user_id) pairs that have already been confirmed+reported
        self._confirmed_alerts: set = set()

        # ── Stats ─────────────────────────────────────────────────────────────
        self.stats = {
            "frames_processed": 0,
            "faces_detected":   0,
            "matches_confirmed": 0,
            "unknowns":          0,
            "started_at":        time.time(),
        }

    # ── Match logic ───────────────────────────────────────────────────────────

    def _match_full_db(self, embedding: np.ndarray) -> Optional[Tuple[str, float]]:
        """1:N search across entire FAISS index."""
        return faiss_manager.search(embedding, threshold=settings.RECOGNITION_THRESHOLD)

    def _match_target(self, embedding: np.ndarray) -> Optional[Tuple[str, float]]:
        """1:1 cosine similarity against target person's embeddings."""
        if not self.target_embeddings:
            return None
        sims = [
            _cosine_similarity(embedding, t)
            for t in self.target_embeddings
        ]
        best = max(sims)
        if best >= settings.RECOGNITION_THRESHOLD:
            return (self.target_user_id, best)
        return None

    def _match_multi_target(self, embedding: np.ndarray) -> Optional[Tuple[str, float]]:
        """
        1:N search restricted to the multi_target subset.
        Normalizes the query embedding and computes cosine similarity against
        each person's embeddings, returning the best match above threshold.
        """
        if not self.multi_target_embeddings:
            return None

        best_uid, best_sim = None, -1.0
        for uid, embs in self.multi_target_embeddings.items():
            sims = [_cosine_similarity(embedding, e) for e in embs]
            if sims:
                s = max(sims)
                if s > best_sim:
                    best_sim, best_uid = s, uid

        if best_sim >= settings.RECOGNITION_THRESHOLD and best_uid:
            return (best_uid, best_sim)
        return None

    def _do_match(self, embedding: np.ndarray) -> Optional[Tuple[str, float]]:
        if self.mode == "target":
            return self._match_target(embedding)
        elif self.mode == "multi_target":
            return self._match_multi_target(embedding)
        else:  # full_db
            return self._match_full_db(embedding)

    # ── Vote logic ────────────────────────────────────────────────────────────

    def _update_vote(
        self, track_id: int, candidate_uid: str, confidence: float
    ) -> Optional[Dict]:
        """
        Update the vote state for a track. Returns a confirmed result dict
        if VOTE_FRAMES consecutive matching votes have accumulated, else None.
        """
        state = self._vote_state[track_id]
        frames_since_last = self._frame_idx - state["last_frame"]

        # Reset if candidate changed or gap is too large
        if state["user_id"] != candidate_uid or frames_since_last > MAX_VOTE_GAP:
            state["user_id"]     = candidate_uid
            state["votes"]       = 1
            state["confidences"] = [confidence]
        else:
            state["votes"] += 1
            state["confidences"].append(confidence)

        state["last_frame"] = self._frame_idx

        if state["votes"] >= VOTE_FRAMES:
            avg_conf = float(np.mean(state["confidences"]))
            # Reset so next confirmation needs fresh VOTE_FRAMES
            state["votes"]       = 0
            state["confidences"] = []
            return {"user_id": candidate_uid, "avg_confidence": avg_conf}

        return None

    # ── Frame entry point ─────────────────────────────────────────────────────

    def process_frame(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        t0 = time.time()
        self._frame_idx += 1
        self.stats["frames_processed"] += 1

        # 1. Detect
        bboxes, kpss = detector.detect(frame, threshold=settings.DETECTION_THRESHOLD)
        if len(bboxes) == 0:
            return []

        self.stats["faces_detected"] += len(bboxes)

        # 2. Track
        formatted = [{"bbox": b[:4].tolist()} for b in bboxes]
        tracks = self.tracker_instance.update(formatted)

        results = []

        for track in tracks:
            track_id = track["id"]
            bbox     = np.array(track["bbox"])

            # ── Recognition cache (skip ONNX for known tracks) ───────────────
            cached = recognition_cache.get(track_id)
            if cached is not None:
                results.append({
                    "track_id":    track_id,
                    "user_id":     cached["user_id"],
                    "confidence":  cached["confidence"],
                    "bbox":        bbox.tolist(),
                    "mode":        self.mode,
                    "source":      "cache",
                    "confirmed":   True,
                    "snapshot":    None,
                    "quality":     None,
                })
                continue

            # ── Face quality gate ─────────────────────────────────────────────
            quality_ok, quality_score = _face_quality_score(frame, bbox)
            if not quality_ok:
                continue

            # ── Keypoint → bbox matching ──────────────────────────────────────
            kps = _best_kps_for_bbox(bbox, kpss)
            if kps is None:
                continue

            # ── Align → embed ─────────────────────────────────────────────────
            try:
                aligned   = align_face(frame, kps)
                embedding = recognizer.get_embedding(aligned)
            except Exception as e:
                err_logger.warning(f"Embed error track {track_id}: {e}")
                continue

            # ── Match ─────────────────────────────────────────────────────────
            match = self._do_match(embedding)
            user_id = match[0] if match else "unknown"
            conf = match[1] if match else 0.0

            # Multi-frame vote confirmation
            confirmed_result = self._update_vote(track_id, user_id, conf)

            if confirmed_result:
                avg_conf = confirmed_result["avg_confidence"]
                snapshot = None
                alert_key = (track_id, user_id)

                # Save snapshot + cache only on first confirmation
                if alert_key not in self._confirmed_alerts:
                    self._confirmed_alerts.add(alert_key)
                    snapshot = _save_snapshot(frame, bbox, track_id, user_id)
                    
                    if user_id != "unknown":
                        recognition_cache.add(track_id, user_id, avg_conf)
                        self.stats["matches_confirmed"] += 1
                        rec_logger.info(
                            f"[{self.camera_id}] CONFIRMED match: user={user_id} "
                            f"track={track_id} conf={avg_conf:.3f} snap={snapshot} mode={self.mode}"
                        )
                    else:
                        self.stats["unknowns"] += 1
                        rec_logger.info(
                            f"[{self.camera_id}] CONFIRMED unknown: track={track_id} snap={snapshot} mode={self.mode}"
                        )

                results.append({
                    "track_id":   track_id,
                    "user_id":    user_id,
                    "confidence": round(avg_conf, 4),
                    "bbox":       bbox.tolist(),
                    "mode":       self.mode,
                    "source":     "confirmed",
                    "confirmed":  True,
                    "snapshot":   snapshot,
                    "quality":    quality_score,
                    "embedding":  embedding.tolist() if user_id == "unknown" else None,
                })
            else:
                # Pending votes — emit as a tentative result (no alert yet)
                vote_count = self._vote_state[track_id]["votes"]
                results.append({
                    "track_id":   track_id,
                    "user_id":    user_id,
                    "confidence": round(conf, 4),
                    "bbox":       bbox.tolist(),
                    "mode":       self.mode,
                    "source":     "voting",
                    "confirmed":  False,
                    "vote_progress": f"{vote_count}/{VOTE_FRAMES}",
                    "snapshot":   None,
                    "quality":    quality_score,
                })

        elapsed = time.time() - t0
        if results:
            rec_logger.info(
                f"[{self.camera_id}] Frame {self._frame_idx}: "
                f"{len(results)} results | {elapsed*1000:.1f}ms | mode={self.mode}"
            )

        return results
