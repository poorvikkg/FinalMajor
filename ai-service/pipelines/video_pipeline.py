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

def _cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 0.0
    return float(np.dot(v1, v2) / (n1 * n2))

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
    mode = "target" if (target_user_id and target_user_id != "undefined") else "full_db"
    pipeline = RecognitionPipeline(camera_id, mode=mode, target_user_id=target_user_id)

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
            is_unknown = (uid == "unknown")

            bbox = res.get("bbox", [])
            if is_unknown:
                snap_key = f"unknown_track{res.get('track_id', 0)}"
            else:
                snap_key = uid

            # Quality-ranked snapshot: keep the sharpest frame per detection
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
                "is_unknown":    is_unknown,
                "snap_key":      snap_key,
                "snapshot_path": None,
                "embedding":     res.get("embedding") if is_unknown else None,
                "quality":       res.get("quality"),
            })

    cap.release()
    reader.join(timeout=5)

    # ── Resolve Known Tracks & Cluster Unknown Tracks ─────────────────────
    track_known_map: dict = {}
    track_embeddings: dict = {}

    # Collect embeddings per track
    for entry in timeline:
        tid = entry.get("track_id")
        if tid is not None and entry.get("embedding"):
            emb = np.array(entry["embedding"], dtype=np.float32)
            if tid not in track_embeddings:
                track_embeddings[tid] = emb
            else:
                # Accumulate average embedding for the track
                track_embeddings[tid] = 0.5 * track_embeddings[tid] + 0.5 * emb
                norm = np.linalg.norm(track_embeddings[tid])
                if norm > 1e-6:
                    track_embeddings[tid] = track_embeddings[tid] / norm

    # 1. Collect known user_id for any track that matched a known person at any frame
    for entry in timeline:
        if not entry["is_unknown"] and entry.get("user_id") and entry.get("user_id") != "unknown":
            track_known_map[entry["track_id"]] = entry["user_id"]

    # 2. Search Embedding Cache & FaissManager for all tracks
    from services.faiss_manager import faiss_manager
    from cache.embedding_cache import embedding_cache

    for tid, emb in track_embeddings.items():
        if tid in track_known_map:
            continue
        if target_user_id and target_user_id != "undefined":
            target_embs = embedding_cache.get(target_user_id)
            if target_embs:
                sims = [_cosine_similarity(emb, e) for e in target_embs if e.size == 512]
                if sims and max(sims) >= 0.20:
                    track_known_map[tid] = target_user_id
                    continue

        # Check all registered complaints directly in RAM cache
        best_known_uid = None
        best_known_sim = 0.0
        for uid, u_embs in embedding_cache.embeddings.items():
            for ue in u_embs:
                sim = _cosine_similarity(emb, ue)
                if sim > best_known_sim:
                    best_known_sim = sim
                    best_known_uid = uid

        if best_known_uid and best_known_sim >= 0.25:
            track_known_map[tid] = best_known_uid
            continue

        match = faiss_manager.search(emb, threshold=0.25)
        if match:
            known_uid, _ = match
            track_known_map[tid] = known_uid

    # 3. If target_user_id was matched for ANY track in the video, assign all tracks in this video to target_user_id
    if target_user_id and target_user_id != "undefined":
        if any(uid == target_user_id for uid in track_known_map.values()):
            for entry in timeline:
                track_known_map[entry["track_id"]] = target_user_id

    # 4. Intra-video Unknown Face Clustering: Group all unassigned unknown tracks that belong to the same person
    unknown_clusters: list = [] # list of {"id": str, "embedding": np.ndarray, "tracks": set()}
    cluster_counter = 0

    for tid, emb in track_embeddings.items():
        if tid in track_known_map:
            continue
        
        assigned_cluster = None
        best_sim = 0.0
        for cluster in unknown_clusters:
            sim = _cosine_similarity(emb, cluster["embedding"])
            if sim > best_sim and sim >= 0.35: # Intra-video same-person cosine similarity threshold
                best_sim = sim
                assigned_cluster = cluster

        if assigned_cluster:
            assigned_cluster["tracks"].add(tid)
            # Update running average embedding of the cluster
            assigned_cluster["embedding"] = 0.6 * assigned_cluster["embedding"] + 0.4 * emb
            norm = np.linalg.norm(assigned_cluster["embedding"])
            if norm > 1e-6:
                assigned_cluster["embedding"] = assigned_cluster["embedding"] / norm
            track_known_map[tid] = assigned_cluster["id"]
        else:
            cluster_counter += 1
            cid = f"unknown_person_{cluster_counter}"
            unknown_clusters.append({
                "id": cid,
                "embedding": emb,
                "tracks": {tid}
            })
            track_known_map[tid] = cid

    # 4.5 Fallback for any tracks without embeddings
    for entry in timeline:
        tid = entry.get("track_id")
        if tid is not None and tid not in track_known_map:
            if len(unknown_clusters) > 0:
                track_known_map[tid] = unknown_clusters[0]["id"]
            else:
                cluster_counter += 1
                cid = f"unknown_person_{cluster_counter}"
                track_known_map[tid] = cid

    # 5. Override timeline entries for resolved tracks
    for entry in timeline:
        tid = entry.get("track_id")
        if tid in track_known_map:
            resolved_id = track_known_map[tid]
            is_unresolved = resolved_id.startswith("unknown_person_") or resolved_id == "unknown"
            entry["is_unknown"] = is_unresolved
            entry["user_id"] = "unknown" if is_unresolved else resolved_id
            entry["cluster_key"] = resolved_id

    # 6. Remap best_crops keys by resolved cluster/person so we get only ONE best snapshot per unique person
    remapped_best_crops = {}
    for snap_key, data in best_crops.items():
        target_key = snap_key
        if snap_key.startswith("unknown_track"):
            try:
                tid = int(snap_key.replace("unknown_track", ""))
                target_key = track_known_map.get(tid, snap_key)
            except Exception:
                pass
        if target_key not in remapped_best_crops or data[2] > remapped_best_crops[target_key][2]:
            remapped_best_crops[target_key] = data

    # Ensure all resolved targets have a snapshot assigned
    for cid in set(track_known_map.values()):
        if cid not in remapped_best_crops and len(best_crops) > 0:
            remapped_best_crops[cid] = list(best_crops.values())[0]

    saved = _save_best_snapshot({k: v[:2] for k, v in remapped_best_crops.items()})

    # 7. Group timeline entries by resolved person/cluster, keeping ONE highest quality entry per person
    grouped_entries: dict = {}
    for entry in timeline:
        tid = entry.get("track_id")
        key = track_known_map.get(tid, entry.get("cluster_key", "unknown"))

        fname = saved.get(key)
        if not fname and len(saved) > 0:
            fname = list(saved.values())[0]

        entry["snapshot_path"] = f"snapshots/{fname}" if fname else None

        existing = grouped_entries.get(key)
        if existing is None or entry.get("confidence", 0) > existing.get("confidence", 0):
            grouped_entries[key] = entry

    final_timeline = list(grouped_entries.values())

    # 8. If target person is identified, filter out any residual unknown entries
    if any(not e.get("is_unknown") for e in final_timeline):
        final_timeline = [e for e in final_timeline if not e.get("is_unknown")]

    for entry in final_timeline:
        # Process unknown face through cross-video clustering manager ONLY if truly unknown
        if entry.get("is_unknown") and entry.get("embedding"):
            try:
                import asyncio
                from services.unknown_person_manager import unknown_person_manager
                video_id = os.path.basename(video_path)
                
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(
                        unknown_person_manager.process_unknown_face(
                            embedding=np.array(entry["embedding"]),
                            quality_score=entry.get("quality", 60.0) or 60.0,
                            camera_id=camera_id if camera_id != "UPLOAD" else None,
                            video_id=video_id,
                            snapshot_path=entry["snapshot_path"] or "",
                            track_id=entry.get("track_id", 0),
                            confidence=entry.get("confidence", 0),
                            timestamp=time.time(),
                        )
                    )
                except RuntimeError:
                    asyncio.run(
                        unknown_person_manager.process_unknown_face(
                            embedding=np.array(entry["embedding"]),
                            quality_score=entry.get("quality", 60.0) or 60.0,
                            camera_id=camera_id if camera_id != "UPLOAD" else None,
                            video_id=video_id,
                            snapshot_path=entry["snapshot_path"] or "",
                            track_id=entry.get("track_id", 0),
                            confidence=entry.get("confidence", 0),
                            timestamp=time.time(),
                        )
                    )
            except Exception as e:
                logger.error(f"Failed to cluster unknown video face: {e}")

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
