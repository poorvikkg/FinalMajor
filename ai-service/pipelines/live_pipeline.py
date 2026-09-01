"""
live_pipeline.py  —  Advanced Live Stream Manager

Features
────────
  • Mode-aware stream start: full_db | target | multi_target
  • Exponential-backoff auto-reconnect on stream failure
  • Alert deduplication  — one webhook per confirmed person per stream per cooldown window
  • Per-stream stats exposed via get_stream_stats()
  • Graceful shutdown with cleanup
"""

import cv2
import time
import asyncio
import httpx
from typing import Dict, Any, Optional, List
from pipelines.recognition_pipeline import RecognitionPipeline
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

# How long (seconds) before re-alerting the same person on the same camera
ALERT_COOLDOWN_SEC = 60


class StreamState:
    """Holds runtime state for one active camera stream."""

    def __init__(
        self,
        camera_id: str,
        rtsp_url: str,
        mode: str = "full_db",
        target_user_id: Optional[str] = None,
        target_user_ids: Optional[List[str]] = None,
    ):
        self.camera_id       = camera_id
        self.rtsp_url        = rtsp_url
        self.mode            = mode
        self.target_user_id  = target_user_id
        self.target_user_ids = target_user_ids or []
        self.running         = True

        # { "user_id": last_alert_timestamp }
        self._alerted_at: Dict[str, float] = {}

    def should_alert(self, user_id: str) -> bool:
        """True if we haven't alerted for this user within the cooldown window."""
        if user_id == "unknown":
            return False
        last = self._alerted_at.get(user_id, 0.0)
        return (time.time() - last) >= ALERT_COOLDOWN_SEC

    def record_alert(self, user_id: str):
        self._alerted_at[user_id] = time.time()


class LiveStreamManager:
    """Manages concurrent live video streams, background recognition tasks, and health reporting."""
    def __init__(self):
        # { camera_id: StreamState }
        self.streams: Dict[str, StreamState] = {}

    # ── Public control API ────────────────────────────────────────────────────

    async def start_stream(
        self,
        camera_id: str,
        rtsp_url: str,
        mode: str = "full_db",
        target_user_id: Optional[str] = None,
        target_user_ids: Optional[List[str]] = None,
    ):
        if camera_id in self.streams and self.streams[camera_id].running:
            logger.warning(f"Stream {camera_id} is already running.")
            return

        state = StreamState(
            camera_id=camera_id,
            rtsp_url=rtsp_url,
            mode=mode,
            target_user_id=target_user_id,
            target_user_ids=target_user_ids,
        )
        self.streams[camera_id] = state
        asyncio.create_task(self._run_stream(state))
        logger.info(f"Stream {camera_id} started | mode={mode}")

    async def stop_stream(self, camera_id: str):
        if camera_id in self.streams:
            self.streams[camera_id].running = False
            logger.info(f"Stream {camera_id} stop requested.")

    def get_stream_stats(self, camera_id: str) -> Optional[Dict[str, Any]]:
        state = self.streams.get(camera_id)
        if not state:
            return None
        pipeline = getattr(state, "_pipeline", None)
        if pipeline is None:
            return {"camera_id": camera_id, "running": state.running, "mode": state.mode}
        s = pipeline.stats
        uptime = time.time() - s["started_at"]
        return {
            "camera_id":        camera_id,
            "running":          state.running,
            "mode":             state.mode,
            "target_user_id":   state.target_user_id,
            "uptime_sec":       round(uptime, 1),
            "frames_processed": s["frames_processed"],
            "faces_detected":   s["faces_detected"],
            "matches_confirmed": s["matches_confirmed"],
            "unknowns":         s["unknowns"],
            "fps_effective":    round(s["frames_processed"] / uptime, 2) if uptime > 0 else 0,
        }

    @property
    def active_streams(self) -> Dict[str, bool]:
        """Legacy-compatible property — returns {camera_id: is_running}."""
        return {cid: s.running for cid, s in self.streams.items()}

    # ── Internal stream loop ──────────────────────────────────────────────────

    async def _run_stream(self, state: StreamState):
        logger.info(f"[{state.camera_id}] Stream loop starting | url={state.rtsp_url}")
        backoff = 2  # seconds; doubles on each reconnect failure

        pipeline = RecognitionPipeline(
            camera_id=state.camera_id,
            mode=state.mode,
            target_user_id=state.target_user_id,
            target_user_ids=state.target_user_ids,
        )
        state._pipeline = pipeline  # expose for stats

        fps_cap    = settings.LIVE_STREAM_FPS_CAP
        frame_time = 1.0 / fps_cap if fps_cap > 0 else 0

        async with httpx.AsyncClient(timeout=10) as http:
            while state.running:
                from services.stream_grabber import ThreadedVideoStream
                cap = ThreadedVideoStream(state.rtsp_url)

                if not cap.isOpened():
                    logger.error(
                        f"[{state.camera_id}] Failed to open stream. "
                        f"Retrying in {backoff}s…"
                    )
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 60)
                    continue

                cap.start()
                backoff = 2  # reset on successful open
                logger.info(f"[{state.camera_id}] Stream opened successfully with ThreadedVideoStream.")

                while state.running:
                    t0 = time.time()
                    ret, frame = cap.read()

                    if not ret or frame is None:
                        logger.warning(
                            f"[{state.camera_id}] Frame read failed or empty. "
                            f"Reconnecting in {backoff}s…"
                        )
                        break  # break inner loop → reconnect

                    # ── Recognize ────────────────────────────────────────────
                    results = pipeline.process_frame(frame)

                    # ── Webhook for confirmed matches and unknowns ───────────────────
                    confirmed = [r for r in results if r.get("confirmed")]
                    for det in confirmed:
                        uid = det["user_id"]
                        
                        # Unknown faces bypass the strict person-based cooldown
                        # (because we want every unique track of an unknown person to be evaluated for clustering)
                        # The track_id deduplication in recognition_pipeline already ensures we only alert once per track
                        if uid == "unknown" or state.should_alert(uid):
                            if uid != "unknown":
                                state.record_alert(uid)
                            
                            payload = {
                                "cameraId":  state.camera_id,
                                "timestamp": time.time(),
                                "mode":      state.mode,
                                "detection": det,
                            }
                            try:
                                await http.post(
                                    f"{settings.BACKEND_API_URL}/webhooks/recognitions",
                                    json=payload,
                                )
                                logger.info(
                                    f"[{state.camera_id}] Alert sent: user={uid} "
                                    f"conf={det['confidence']:.3f}"
                                )
                            except Exception as e:
                                logger.error(
                                    f"[{state.camera_id}] Webhook failed for {uid}: {e}"
                                )

                            # ── Unknown Person Clustering ─────────────────────────
                            # Feed confirmed unknown faces into the cross-video
                            # clustering system (separate from the webhook above)
                            if uid == "unknown" and det.get("embedding"):
                                try:
                                    from services.unknown_person_manager import unknown_person_manager
                                    snap = det.get("snapshot", "")
                                    result = await unknown_person_manager.process_unknown_face(
                                        embedding=det["embedding"],
                                        quality_score=det.get("quality", 0) or 0,
                                        camera_id=state.camera_id,
                                        video_id=None,
                                        snapshot_path=f"snapshots/{snap}" if snap else "",
                                        track_id=det.get("track_id", 0),
                                        confidence=det.get("confidence", 0),
                                        timestamp=time.time(),
                                    )
                                    if result.action != "rejected":
                                        logger.info(
                                            f"[{state.camera_id}] Unknown clustering: "
                                            f"{result.action} {result.unknown_id}"
                                        )
                                except Exception as e:
                                    logger.error(
                                        f"[{state.camera_id}] Unknown clustering failed: {e}"
                                    )

                    # ── FPS cap ──────────────────────────────────────────────
                    elapsed = time.time() - t0
                    sleep   = max(0, frame_time - elapsed)
                    if sleep > 0:
                        await asyncio.sleep(sleep)
                    else:
                        await asyncio.sleep(0.001)

                cap.release()
                if state.running:
                    logger.info(
                        f"[{state.camera_id}] Reconnecting in {backoff}s…"
                    )
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 60)

        self.streams.pop(state.camera_id, None)
        logger.info(f"[{state.camera_id}] Stream loop exited cleanly.")


stream_manager = LiveStreamManager()
