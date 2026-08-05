"""
unknown_person_manager.py — Cross-Video Recurring Unknown Person Detection

Manages a separate FAISS index for anonymous face identities that are not in the
known-person database. Clusters unknown faces across videos/cameras using embedding
similarity and tracks recurrence statistics.

Status pipeline:
    UNKNOWN  →  RECURRING  →  REVIEW_REQUIRED

Architecture:
    Known FAISS  → registered/reference identities (faiss_manager.py)
    Unknown FAISS → anonymous recurring identities  (this file)

The two indexes are NEVER mixed. The processing order is:
    1. Query Known FAISS first
    2. Only on known miss → query Unknown FAISS
"""

import os
import cv2
import uuid
import time
import asyncio
import threading
import numpy as np
import faiss
import httpx
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass, field
from collections import defaultdict

from bson import ObjectId
from config.settings import settings
from services.logger import get_logger

logger = get_logger("unknown_persons", "unknown_persons.log")

def _to_object_id(val: Any) -> Any:
    if not val:
        return None
    val_str = str(val)
    if ObjectId.is_valid(val_str):
        return ObjectId(val_str)
    return val_str

# ─────────────────────────────────────────────────────────────────────────────
# Data Classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ProcessResult:
    """Result of processing an unknown face through the clustering pipeline."""
    action: str            # "created" | "updated" | "duplicate" | "rejected"
    unknown_id: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    status_changed: bool = False
    distinct_video_count: int = 0
    distinct_camera_count: int = 0
    similarity: float = 0.0


@dataclass
class UnknownIdentity:
    """In-memory representation of an anonymous identity."""
    unknown_id: str
    mongo_id: str                                   # MongoDB _id
    representative_embedding: np.ndarray            # 512-dim normalized
    faiss_idx: int                                  # position in FAISS index
    status: str                                     # UNKNOWN | RECURRING | REVIEW_REQUIRED
    distinct_video_ids: set = field(default_factory=set)
    distinct_camera_ids: set = field(default_factory=set)
    appearance_count: int = 0
    embedding_count: int = 0                        # how many embeddings contributed to centroid
    first_seen: float = 0.0
    last_seen: float = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Unknown FAISS Index (separate from known-person index)
# ─────────────────────────────────────────────────────────────────────────────

class UnknownFaissIndex:
    """Thread-safe FAISS IndexFlatIP for unknown person embeddings."""

    def __init__(self, dim: int = 512):
        self.dim = dim
        self.index = faiss.IndexFlatIP(dim)
        self._lock = threading.Lock()

    @property
    def size(self) -> int:
        with self._lock:
            return self.index.ntotal

    def search(
        self, embedding: np.ndarray, threshold: float
    ) -> Optional[Tuple[int, float]]:
        """
        Search for the closest unknown identity.
        Returns (faiss_idx, similarity) if above threshold, else None.
        """
        with self._lock:
            if self.index.ntotal == 0:
                return None

            query = np.array([embedding], dtype=np.float32)
            faiss.normalize_L2(query)
            distances, indices = self.index.search(query, 1)

            sim = float(distances[0][0])
            idx = int(indices[0][0])

            if sim >= threshold and idx >= 0:
                return (idx, sim)
            return None

    def add(self, embedding: np.ndarray) -> int:
        """Add a normalized embedding. Returns its FAISS index position."""
        with self._lock:
            vec = np.array([embedding], dtype=np.float32)
            faiss.normalize_L2(vec)
            idx = self.index.ntotal
            self.index.add(vec)
            return idx

    def rebuild(self, embeddings: List[np.ndarray]) -> None:
        """
        Full rebuild of the index. Used to update representative embeddings
        without leaving stale vectors. Called under the manager's lock.
        """
        with self._lock:
            self.index = faiss.IndexFlatIP(self.dim)
            if embeddings:
                arr = np.vstack(embeddings).astype(np.float32)
                faiss.normalize_L2(arr)
                self.index.add(arr)


# ─────────────────────────────────────────────────────────────────────────────
# Unknown Person Manager
# ─────────────────────────────────────────────────────────────────────────────

class UnknownPersonManager:
    """
    Orchestrates cross-video unknown person clustering.

    Responsibilities:
        - Maintains a separate FAISS index for unknown identities
        - Creates new unknown IDs (U-000001 format)
        - Associates face embeddings with existing unknown identities
        - Records appearances with deduplication
        - Computes recurrence status (UNKNOWN → RECURRING → REVIEW_REQUIRED)
        - Persists to MongoDB
        - Recovers state from MongoDB on restart
    """

    def __init__(self):
        self.faiss_index = UnknownFaissIndex(dim=512)
        self._identities: Dict[str, UnknownIdentity] = {}    # unknown_id → identity
        self._faiss_map: Dict[int, str] = {}                  # faiss_idx → unknown_id
        self._id_counter: int = 0
        self._lock = threading.Lock()
        self._db = None                                        # motor collection reference
        self._initialized = False
        # ── Deferred FAISS rebuild bookkeeping
        self._dirty_ids: set = set()   # unknown_ids whose centroids shifted significantly
        self._rebuild_task = None      # asyncio background task handle

    # ── Startup ──────────────────────────────────────────────────────────────

    async def initialize(self, db) -> None:
        """
        Load existing UnknownPerson records from MongoDB and rebuild
        the Unknown FAISS index. Called during FastAPI startup.
        """
        collection = db[settings.UNKNOWN_MONGODB_COLLECTION]
        self._db = collection

        loaded = 0
        skipped = 0
        max_counter = 0
        embeddings_ordered: List[np.ndarray] = []

        cursor = collection.find({"representativeEmbedding": {"$exists": True}})
        async for doc in cursor:
            unknown_id = doc.get("unknownId", "")
            embedding_list = doc.get("representativeEmbedding", [])
            mongo_id = str(doc["_id"])

            # Validate embedding
            if not isinstance(embedding_list, list) or len(embedding_list) != 512:
                logger.warning(
                    f"UNKNOWN_INDEX_LOADED: Skipping {unknown_id} — "
                    f"invalid embedding (len={len(embedding_list) if isinstance(embedding_list, list) else 'N/A'})"
                )
                skipped += 1
                continue

            try:
                emb = np.array(embedding_list, dtype=np.float32)
                if not np.isfinite(emb).all():
                    raise ValueError("Non-finite values in embedding")
            except Exception as e:
                logger.warning(f"UNKNOWN_INDEX_LOADED: Skipping {unknown_id} — {e}")
                skipped += 1
                continue

            # Normalize
            norm = np.linalg.norm(emb)
            if norm < 1e-6:
                logger.warning(f"UNKNOWN_INDEX_LOADED: Skipping {unknown_id} — zero-norm embedding")
                skipped += 1
                continue
            emb = emb / norm

            # Extract counter from ID
            try:
                num = int(unknown_id.split("-")[1])
                max_counter = max(max_counter, num)
            except (IndexError, ValueError):
                pass

            # Build appearance tracking sets
            appearances = doc.get("appearances", [])
            video_ids = set()
            camera_ids = set()
            for app in appearances:
                vid = app.get("videoId")
                cam = app.get("cameraId")
                if vid:
                    video_ids.add(str(vid))
                if cam:
                    camera_ids.add(str(cam))

            faiss_idx = len(embeddings_ordered)
            embeddings_ordered.append(emb)

            identity = UnknownIdentity(
                unknown_id=unknown_id,
                mongo_id=mongo_id,
                representative_embedding=emb,
                faiss_idx=faiss_idx,
                status=doc.get("status", "UNKNOWN"),
                distinct_video_ids=video_ids,
                distinct_camera_ids=camera_ids,
                appearance_count=doc.get("appearanceCount", len(appearances)),
                embedding_count=doc.get("embeddingCount", max(1, len(appearances))),
                first_seen=doc.get("firstSeen", time.time()),
                last_seen=doc.get("lastSeen", time.time()),
            )

            self._identities[unknown_id] = identity
            self._faiss_map[faiss_idx] = unknown_id
            loaded += 1

        # Build FAISS index
        self.faiss_index.rebuild(embeddings_ordered)
        self._id_counter = max_counter
        self._initialized = True

        logger.info(
            f"UNKNOWN_INDEX_LOADED: Loaded {loaded} unknown identities, "
            f"skipped {skipped}, FAISS index size={self.faiss_index.size}"
        )

        # Start background deferred-rebuild loop
        self._rebuild_task = asyncio.ensure_future(self._deferred_rebuild_loop())

    # ── Core Processing ──────────────────────────────────────────────────────

    async def process_unknown_face(
        self,
        embedding: np.ndarray,
        quality_score: float,
        camera_id: Optional[str],
        video_id: Optional[str],
        snapshot_path: str,
        track_id: int,
        confidence: float,
        timestamp: Optional[float] = None,
    ) -> ProcessResult:
        """
        Main entry point. Called after known FAISS returns no match
        and multi-frame voting confirms the detection.

        Returns a ProcessResult indicating what happened.
        """
        if not self._initialized:
            logger.warning("UNKNOWN_MATCH_REJECTED: Manager not initialized yet")
            return ProcessResult(action="rejected")

        # Quality gate — reuse existing blur threshold
        if quality_score < settings.UNKNOWN_MIN_QUALITY_SCORE:
            logger.debug(
                f"UNKNOWN_MATCH_REJECTED: quality={quality_score:.1f} "
                f"below threshold={settings.UNKNOWN_MIN_QUALITY_SCORE}"
            )
            return ProcessResult(action="rejected")

        # Normalize embedding
        emb = np.array(embedding, dtype=np.float32).flatten()
        if emb.shape[0] != 512:
            logger.warning(f"UNKNOWN_MATCH_REJECTED: embedding dim={emb.shape[0]}, expected 512")
            return ProcessResult(action="rejected")

        norm = np.linalg.norm(emb)
        if norm < 1e-6:
            return ProcessResult(action="rejected")
        emb = emb / norm

        ts = timestamp or time.time()

        # Check against Registered Target Persons in Known FAISS first
        try:
            from services.faiss_manager import faiss_manager
            known_match = faiss_manager.search(emb, threshold=max(0.35, settings.RECOGNITION_THRESHOLD - 0.05))
            if known_match:
                known_uid, known_sim = known_match
                logger.info(
                    f"UNKNOWN_MATCH_REJECTED: Face matches registered target person '{known_uid}' "
                    f"(similarity={known_sim:.3f}). Skipping unknown person creation."
                )
                return ProcessResult(action="rejected")
        except Exception as e:
            logger.warning(f"Known FAISS pre-check failed during unknown processing: {e}")

        # Search Unknown FAISS
        match = self.faiss_index.search(emb, settings.UNKNOWN_MATCH_THRESHOLD)


        if match is not None:
            faiss_idx, similarity = match
            matched_id = self._faiss_map.get(faiss_idx)
            if matched_id and matched_id in self._identities:
                return await self._update_existing(
                    matched_id, emb, similarity, quality_score,
                    camera_id, video_id, snapshot_path, track_id,
                    confidence, ts
                )

        # No match → create new unknown identity
        return await self._create_new(
            emb, quality_score, camera_id, video_id,
            snapshot_path, track_id, confidence, ts
        )

    # ── Create New Identity ──────────────────────────────────────────────────

    async def _create_new(
        self,
        embedding: np.ndarray,
        quality_score: float,
        camera_id: Optional[str],
        video_id: Optional[str],
        snapshot_path: str,
        track_id: int,
        confidence: float,
        timestamp: float,
    ) -> ProcessResult:
        """Create a brand-new anonymous identity."""

        with self._lock:
            self._id_counter += 1
            unknown_id = f"U-{self._id_counter:06d}"

        # Add to FAISS
        faiss_idx = self.faiss_index.add(embedding)

        # Build video/camera sets
        video_ids = {video_id} if video_id else set()
        camera_ids = {camera_id} if camera_id else set()

        identity = UnknownIdentity(
            unknown_id=unknown_id,
            mongo_id="",  # will be set after MongoDB insert
            representative_embedding=embedding.copy(),
            faiss_idx=faiss_idx,
            status="UNKNOWN",
            distinct_video_ids=video_ids,
            distinct_camera_ids=camera_ids,
            appearance_count=1,
            embedding_count=1,
            first_seen=timestamp,
            last_seen=timestamp,
        )

        with self._lock:
            self._identities[unknown_id] = identity
            self._faiss_map[faiss_idx] = unknown_id

        # Persist to MongoDB
        appearance = {
            "timestamp": timestamp,
            "detectedAt": time.time(),
            "snapshotObjectKey": snapshot_path,
            "trackId": track_id,
            "similarity": 1.0,
            "qualityScore": quality_score,
        }
        if video_id:
            appearance["videoId"] = _to_object_id(video_id)
        if camera_id:
            appearance["cameraId"] = _to_object_id(camera_id)

        doc = {
            "unknownId": unknown_id,
            "representativeEmbedding": embedding.tolist(),
            "representativeSnapshot": snapshot_path,
            "status": "UNKNOWN",
            "appearanceCount": 1,
            "embeddingCount": 1,
            "distinctVideoCount": len(video_ids),
            "distinctCameraCount": len(camera_ids),
            "distinctVideoIds": [_to_object_id(v) for v in video_ids if v],
            "distinctCameraIds": [_to_object_id(c) for c in camera_ids if c],
            "firstSeen": timestamp,
            "lastSeen": timestamp,
            "appearances": [appearance],
            "isReviewed": False,
        }

        try:
            result = await self._db.insert_one(doc)
            identity.mongo_id = str(result.inserted_id)
            logger.info(
                f"UNKNOWN_CREATED: {unknown_id} | "
                f"video={video_id} camera={camera_id} conf={confidence:.3f}"
            )
        except Exception as e:
            logger.error(f"UNKNOWN_CREATED: MongoDB insert failed for {unknown_id}: {e}")

        return ProcessResult(
            action="created",
            unknown_id=unknown_id,
            old_status=None,
            new_status="UNKNOWN",
            status_changed=False,
            distinct_video_count=len(video_ids),
            distinct_camera_count=len(camera_ids),
        )

    # ── Update Existing Identity ─────────────────────────────────────────────

    async def _update_existing(
        self,
        unknown_id: str,
        embedding: np.ndarray,
        similarity: float,
        quality_score: float,
        camera_id: Optional[str],
        video_id: Optional[str],
        snapshot_path: str,
        track_id: int,
        confidence: float,
        timestamp: float,
    ) -> ProcessResult:
        """Update an existing unknown identity with a new sighting."""

        identity = self._identities[unknown_id]
        old_status = identity.status

        # ── Deduplication check ──────────────────────────────────────────
        # Same video → only count once per video
        is_new_video = video_id and video_id not in identity.distinct_video_ids
        is_new_camera = camera_id and camera_id not in identity.distinct_camera_ids
        is_new_source = is_new_video or is_new_camera

        if not is_new_source:
            # Still log the match, but it's a duplicate source
            logger.debug(
                f"UNKNOWN_MATCHED: {unknown_id} duplicate source | "
                f"video={video_id} camera={camera_id} sim={similarity:.3f}"
            )
            return ProcessResult(
                action="duplicate",
                unknown_id=unknown_id,
                old_status=old_status,
                new_status=old_status,
                status_changed=False,
                distinct_video_count=len(identity.distinct_video_ids),
                distinct_camera_count=len(identity.distinct_camera_ids),
                similarity=similarity,
            )

        # ── Update tracking sets ─────────────────────────────────────────
        if video_id:
            identity.distinct_video_ids.add(video_id)
        if camera_id:
            identity.distinct_camera_ids.add(camera_id)
        identity.appearance_count += 1
        identity.last_seen = timestamp

        # ── Update representative embedding (incremental normalized centroid)
        count = identity.embedding_count
        new_centroid = (identity.representative_embedding * count + embedding) / (count + 1)
        centroid_norm = np.linalg.norm(new_centroid)
        if centroid_norm > 1e-6:
            new_centroid = new_centroid / centroid_norm

        # Only mark dirty (trigger future FAISS rebuild) if the centroid shifted meaningfully.
        # Cosine distance > 0.02 means > ~1.1° angular shift — below this the
        # nearest-neighbour search result is unchanged, so rebuilding is wasteful.
        cosine_shift = float(1.0 - np.dot(identity.representative_embedding, new_centroid))
        if cosine_shift > 0.02:
            with self._lock:
                self._dirty_ids.add(unknown_id)

        identity.representative_embedding = new_centroid
        identity.embedding_count = count + 1

        # ── Compute new status ───────────────────────────────────────────
        new_status = self._compute_status(
            len(identity.distinct_video_ids),
            len(identity.distinct_camera_ids),
        )
        identity.status = new_status
        status_changed = old_status != new_status

        # ── Persist to MongoDB ───────────────────────────────────────────
        appearance = {
            "timestamp": timestamp,
            "detectedAt": time.time(),
            "snapshotObjectKey": snapshot_path,
            "trackId": track_id,
            "similarity": round(similarity, 4),
            "qualityScore": quality_score,
        }
        if video_id:
            appearance["videoId"] = _to_object_id(video_id)
        if camera_id:
            appearance["cameraId"] = _to_object_id(camera_id)

        try:
            update = {
                "$set": {
                    "representativeEmbedding": new_centroid.tolist(),
                    "representativeSnapshot": snapshot_path if confidence > 0.5 else None,
                    "status": new_status,
                    "appearanceCount": identity.appearance_count,
                    "embeddingCount": identity.embedding_count,
                    "distinctVideoCount": len(identity.distinct_video_ids),
                    "distinctCameraCount": len(identity.distinct_camera_ids),
                    "distinctVideoIds": [_to_object_id(v) for v in identity.distinct_video_ids if v],
                    "distinctCameraIds": [_to_object_id(c) for c in identity.distinct_camera_ids if c],
                    "lastSeen": timestamp,
                },
                "$push": {"appearances": appearance},
            }
            # Don't overwrite snapshot if the new one isn't better
            if confidence <= 0.5:
                del update["$set"]["representativeSnapshot"]

            await self._db.update_one(
                {"unknownId": unknown_id}, update
            )
        except Exception as e:
            logger.error(f"UNKNOWN_APPEARANCE_ADDED: MongoDB update failed for {unknown_id}: {e}")

        # ── Logging ──────────────────────────────────────────────────────
        logger.info(
            f"UNKNOWN_APPEARANCE_ADDED: {unknown_id} | "
            f"videos={len(identity.distinct_video_ids)} "
            f"cameras={len(identity.distinct_camera_ids)} "
            f"sim={similarity:.3f} status={new_status}"
        )

        if status_changed:
            logger.info(
                f"UNKNOWN_STATUS_CHANGED: {unknown_id} | "
                f"{old_status} → {new_status} | "
                f"videos={len(identity.distinct_video_ids)}"
            )
            # Fire webhook to backend
            asyncio.create_task(self._notify_status_change(
                unknown_id, old_status, new_status,
                len(identity.distinct_video_ids),
                len(identity.distinct_camera_ids),
            ))

        return ProcessResult(
            action="updated",
            unknown_id=unknown_id,
            old_status=old_status,
            new_status=new_status,
            status_changed=status_changed,
            distinct_video_count=len(identity.distinct_video_ids),
            distinct_camera_count=len(identity.distinct_camera_ids),
            similarity=similarity,
        )

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _compute_status(self, distinct_videos: int, distinct_cameras: int) -> str:
        """Determine status based on configurable thresholds."""
        if distinct_videos >= settings.UNKNOWN_REVIEW_VIDEO_THRESHOLD:
            return "REVIEW_REQUIRED"
        if distinct_videos >= settings.UNKNOWN_RECURRING_VIDEO_THRESHOLD:
            return "RECURRING"
        return "UNKNOWN"

    async def _deferred_rebuild_loop(self) -> None:
        """
        Background coroutine: rebuilds the Unknown FAISS index at most once every
        30 seconds, but only when identities are marked dirty (centroid shifted).

        This replaces the previous per-update O(N) full rebuild with an amortised
        O(N / (detections_per_30s)) cost — at 10 detections/sec that is a 300x reduction.
        """
        REBUILD_INTERVAL_SECONDS = 30
        while True:
            await asyncio.sleep(REBUILD_INTERVAL_SECONDS)
            with self._lock:
                if not self._dirty_ids:
                    continue
                dirty_snapshot = self._dirty_ids.copy()
                self._dirty_ids.clear()

            logger.debug(
                f"FAISS_DEFERRED_REBUILD: {len(dirty_snapshot)} dirty identities — rebuilding index."
            )
            try:
                self._rebuild_faiss_index()
            except Exception as e:
                logger.error(f"FAISS_DEFERRED_REBUILD: Rebuild failed: {e}")

    def _rebuild_faiss_index(self) -> None:
        """
        Rebuild the entire Unknown FAISS index from current identity embeddings.
        This ensures no stale vectors exist after centroid updates.
        """
        with self._lock:
            ordered_ids: List[str] = sorted(
                self._identities.keys(),
                key=lambda uid: self._identities[uid].faiss_idx,
            )
            embeddings = []
            new_faiss_map: Dict[int, str] = {}

            for new_idx, uid in enumerate(ordered_ids):
                identity = self._identities[uid]
                embeddings.append(identity.representative_embedding)
                identity.faiss_idx = new_idx
                new_faiss_map[new_idx] = uid

            self._faiss_map = new_faiss_map

        self.faiss_index.rebuild(embeddings)

    async def _notify_status_change(
        self,
        unknown_id: str,
        old_status: str,
        new_status: str,
        distinct_video_count: int,
        distinct_camera_count: int,
    ) -> None:
        """Send status change webhook to Node.js backend."""
        payload = {
            "event": "UNKNOWN_STATUS_CHANGED",
            "unknownId": unknown_id,
            "oldStatus": old_status,
            "newStatus": new_status,
            "distinctVideoCount": distinct_video_count,
            "distinctCameraCount": distinct_camera_count,
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"{settings.BACKEND_API_URL}/webhooks/unknown-status-change",
                    json=payload,
                )
            logger.info(f"UNKNOWN_STATUS_CHANGED: Webhook sent for {unknown_id}")
        except Exception as e:
            logger.error(f"UNKNOWN_STATUS_CHANGED: Webhook failed for {unknown_id}: {e}")

    # ── Snapshot helper ──────────────────────────────────────────────────────

    @staticmethod
    def save_unknown_snapshot(
        frame: np.ndarray,
        bbox: np.ndarray,
        unknown_id: str,
    ) -> str:
        """
        Crop and save an unknown person's face snapshot.
        Returns the relative path for storage reference.
        """
        x1, y1, x2, y2 = [int(v) for v in bbox[:4]]
        pad = 20
        x1 = max(0, x1 - pad)
        y1 = max(0, y1 - pad)
        x2 = min(frame.shape[1], x2 + pad)
        y2 = min(frame.shape[0], y2 + pad)
        crop = frame[y1:y2, x1:x2]

        filename = f"snap_{unknown_id}_{uuid.uuid4().hex[:8]}.jpg"
        filepath = os.path.join(settings.UNKNOWN_SNAPSHOTS_DIR, filename)

        if crop.size > 0:
            cv2.imwrite(filepath, crop, [cv2.IMWRITE_JPEG_QUALITY, 92])

        return f"unknown_snapshots/{filename}"

    # ── Stats ────────────────────────────────────────────────────────────────

    def get_stats(self) -> Dict[str, Any]:
        """Return current unknown person statistics."""
        total = len(self._identities)
        recurring = sum(1 for i in self._identities.values() if i.status == "RECURRING")
        review = sum(1 for i in self._identities.values() if i.status == "REVIEW_REQUIRED")
        return {
            "unknown_identity_count": total,
            "recurring_count": recurring,
            "review_required_count": review,
            "unknown_index_size": self.faiss_index.size,
        }


# Module-level singleton
unknown_person_manager = UnknownPersonManager()
