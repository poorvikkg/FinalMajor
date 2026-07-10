"""
video_pipeline.py
Advanced video processing pipeline with:
  - Threaded reader/processor producer-consumer pattern (2x–3x speedup)
  - Motion-adaptive frame skipping (skip static scenes, process dynamic ones)
  - Best-quality snapshot selection (sharpest crop per person)
  - Blur + size quality gate (via recognition_pipeline)
  - Proper snapshot saved to backend/uploads/snapshots/
"""
import cv2
import os
import time
import uuid
import queue
import threading
from typing import Optional
from pipelines.recognition_pipeline import RecognitionPipeline
from config.settings import settings
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ── Snapshot helper ───────────────────────────────────────────────────────────

def _laplacian_variance(img: np.ndarray) -> float:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _save_best_snapshot(best_frames: dict) -> dict:
    """
    Save the full frame (with a bounding box drawn around the face) for each person.
    Returns {snap_key: filename}.
    """
    result = {}
    os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)

    for snap_key, (frame, bbox) in best_frames.items():
        try:
            out = frame.copy()
            x1, y1, x2, y2 = [int(v) for v in bbox[:4]]

            # Draw a prominent green rectangle around the detected face
            cv2.rectangle(out, (x1, y1), (x2, y2), (0, 230, 80), 3)

            # Label above the box
            label = "IDENTIFIED" if not snap_key.startswith("unknown") else "UNKNOWN"
            label_color = (0, 200, 60) if not snap_key.startswith("unknown") else (0, 140, 230)
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            lx, ly = x1, max(y1 - 10, th + 6)
            cv2.rectangle(out, (lx, ly - th - 6), (lx + tw + 8, ly + 2), label_color, -1)
            cv2.putText(out, label, (lx + 4, ly - 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

            fname = f"snap_{snap_key}_{uuid.uuid4().hex[:6]}.jpg"
            cv2.imwrite(
                os.path.join(settings.SNAPSHOTS_DIR, fname),
                out,
                [cv2.IMWRITE_JPEG_QUALITY, 92],
            )
            result[snap_key] = fname
        except Exception as e:
            logger.warning(f"Snapshot save failed for {snap_key}: {e}")
    return result


# ── Frame reader thread ───────────────────────────────────────────────────────

def _frame_reader(cap: cv2.VideoCapture,
                  frame_q: "queue.Queue[Optional[tuple]]",
                  skip: int):
    """Producer: read frames, put (frame_no, frame) into queue. None signals done."""
    frame_no = 0
    prev_gray = None
    MOTION_THRESH = 1.5   # mean abs diff threshold for scene-change detection

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_no += 1

        # Always skip non-target frames
        if frame_no % skip != 0:
            continue

        # Motion-adaptive skip: if scene is totally static, skip
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray_small = cv2.resize(gray, (160, 90))
        if prev_gray is not None:
            diff = float(np.mean(np.abs(gray_small.astype(np.float32) - prev_gray.astype(np.float32))))
            if diff < MOTION_THRESH:
                prev_gray = gray_small
                continue
        prev_gray = gray_small

        frame_q.put((frame_no, frame))

    frame_q.put(None)  # sentinel


# ── Main processing function ──────────────────────────────────────────────────

def process_video_file(
    video_path: str,
    camera_id: str = "UPLOAD",
    skip_frames: int = settings.FRAME_SKIP,
    target_user_id: str = None,
) -> dict:
    """
    Process a video file and return a timeline of face detections.
    Uses a producer-consumer pattern: one thread reads frames, main thread processes.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    pipeline = RecognitionPipeline(camera_id, target_user_id=target_user_id)

    # ── Producer thread ──────────────────────────────────────────────────────
    frame_q: "queue.Queue[Optional[tuple]]" = queue.Queue(maxsize=16)
    reader = threading.Thread(
        target=_frame_reader,
        args=(cap, frame_q, skip_frames),
        daemon=True,
    )
    reader.start()

    # ── Consumer (main thread) ───────────────────────────────────────────────
    timeline = []
    # best_crops[snap_key] = (frame, bbox, sharpness)
    best_crops: dict = {}

    start_time = time.time()
    frames_processed = 0

    while True:
        item = frame_q.get()
        if item is None:
            break

        frame_no, frame = item
        timestamp_sec = frame_no / fps
        frames_processed += 1

        results = pipeline.process_frame(frame)

        for res in results:
            uid = res["user_id"]

            # ── Only store matched faces ─────────────────────────────────
            if uid == "unknown":
                continue

            bbox = res.get("bbox", [])
            snap_key = uid  # always a real user_id now

            # Quality-ranked snapshot: keep the sharpest frame per matched person
            if bbox:
                x1, y1, x2, y2 = [int(v) for v in bbox[:4]]
                crop = frame[max(0, y1):y2, max(0, x1):x2]
                if crop.size > 0:
                    sharpness = _laplacian_variance(crop)
                    prev = best_crops.get(snap_key)
                    if prev is None or sharpness > prev[2]:
                        best_crops[snap_key] = (frame.copy(), bbox, sharpness)

            timeline.append({
                "frame":         frame_no,
                "timestamp":     round(timestamp_sec, 2),
                "track_id":      res.get("track_id"),
                "user_id":       uid,
                "confidence":    round(res["confidence"], 4),
                "is_unknown":    False,
                "snap_key":      snap_key,
                "snapshot_path": None,
            })

    cap.release()
    reader.join(timeout=5)

    # ── Save best snapshots ──────────────────────────────────────────────────
    saved = _save_best_snapshot({k: v[:2] for k, v in best_crops.items()})

    # Resolve snapshot filenames in timeline, deduplicate per snap_key
    seen_keys: set = set()
    final_timeline = []
    for entry in timeline:
        key = entry.pop("snap_key")
        fname = saved.get(key)
        entry["snapshot_path"] = f"snapshots/{fname}" if fname else None
        # Only include first occurrence per unique detection in final output
        if key not in seen_keys:
            seen_keys.add(key)
            final_timeline.append(entry)

    elapsed = time.time() - start_time
    logger.info(
        f"Processed '{os.path.basename(video_path)}' | "
        f"{frames_processed} frames | {len(final_timeline)} detections | {elapsed:.1f}s"
    )

    return {
        "video":               video_path,
        "processed_frames":    frames_processed,
        "processing_time_sec": round(elapsed, 2),
        "timeline":            final_timeline,
    }
