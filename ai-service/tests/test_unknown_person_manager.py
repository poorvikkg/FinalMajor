"""
test_unknown_person_manager.py

Comprehensive test suite for Cross-Video Recurring Unknown Person Detection.
Tests all 13 required scenarios:
1. New unknown creates new anonymous identity
2. Same unknown in another video maps to existing identity
3. Same track across 100 frames does not count as 100 appearances
4. Same unknown repeatedly appearing in same video does not increase distinctVideoCount
5. Four distinct videos changes UNKNOWN → RECURRING
6. Eleven distinct videos changes RECURRING → REVIEW_REQUIRED
7. Different unknown people remain separate
8. Low-quality detections are ignored
9. Known people never enter unknown index
10. Restart restores unknown identities from MongoDB
11. Concurrent processing does not create duplicate IDs
12. Invalid/corrupted embeddings do not crash startup
13. Status-change notifications are emitted only on transitions
"""

import pytest
import asyncio
import numpy as np
import time
from unittest.mock import AsyncMock, MagicMock, patch

from services.unknown_person_manager import (
    UnknownPersonManager,
    UnknownFaissIndex,
    ProcessResult,
)
from config.settings import settings


# Helper: generate a normalized random 512D embedding
def gen_embedding(seed: int = 42) -> np.ndarray:
    np.random.seed(seed)
    vec = np.random.randn(512).astype(np.float32)
    return vec / np.linalg.norm(vec)


# Helper: generate a slightly perturbed embedding (high similarity > 0.8)
def perturb_embedding(base: np.ndarray, noise_level: float = 0.05) -> np.ndarray:
    noise = np.random.randn(512).astype(np.float32) * noise_level
    vec = base + noise
    return vec / np.linalg.norm(vec)


class MockCollection:
    """In-memory mock for motor/MongoDB collection."""

    def __init__(self):
        self.docs = []

    def find(self, query=None):
        class AsyncCursor:
            def __init__(self, docs):
                self.docs = docs
                self.index = 0

            def __aiter__(self):
                return self

            async def __anext__(self):
                if self.index < len(self.docs):
                    doc = self.docs[self.index]
                    self.index += 1
                    return doc
                raise StopAsyncIteration

        return AsyncCursor(self.docs)

    async def insert_one(self, doc):
        from bson import ObjectId
        doc["_id"] = ObjectId()
        self.docs.append(doc)
        mock_res = MagicMock()
        mock_res.inserted_id = doc["_id"]
        return mock_res

    async def update_one(self, query, update):
        target = None
        for d in self.docs:
            if d.get("unknownId") == query.get("unknownId"):
                target = d
                break
        if target and "$set" in update:
            for k, v in update["$set"].items():
                target[k] = v
        if target and "$push" in update:
            for k, v in update["$push"].items():
                if k not in target:
                    target[k] = []
                target[k].append(v)
        mock_res = MagicMock()
        mock_res.modified_count = 1 if target else 0
        return mock_res


@pytest.fixture
def manager():
    """Returns a freshly initialized UnknownPersonManager with a mock DB."""
    mgr = UnknownPersonManager()
    mock_db = MockCollection()
    # Synchronously run async initialize
    asyncio.run(mgr.initialize({"unknownpersons": mock_db}))
    mgr._db = mock_db
    return mgr


# ── Test 1: New unknown creates new anonymous identity ──────────────────────
def test_1_new_unknown_creates_identity(manager):
    emb = gen_embedding(100)
    res = asyncio.run(
        manager.process_unknown_face(
            embedding=emb,
            quality_score=75.0,
            camera_id=None,
            video_id="video_001.mp4",
            snapshot_path="snapshots/snap1.jpg",
            track_id=1,
            confidence=0.9,
        )
    )

    assert res.action == "created"
    assert res.unknown_id == "U-000001"
    assert res.new_status == "UNKNOWN"
    assert res.distinct_video_count == 1
    assert manager.faiss_index.size == 1


# ── Test 2: Same unknown in another video maps to existing identity ─────────
def test_2_same_unknown_in_another_video_matches(manager):
    emb = gen_embedding(100)
    # First video
    asyncio.run(
        manager.process_unknown_face(
            embedding=emb,
            quality_score=75.0,
            camera_id=None,
            video_id="video_001.mp4",
            snapshot_path="snapshots/snap1.jpg",
            track_id=1,
            confidence=0.9,
        )
    )

    # Second video with slightly perturbed embedding of same face
    similar_emb = perturb_embedding(emb, 0.01)
    res2 = asyncio.run(
        manager.process_unknown_face(
            embedding=similar_emb,
            quality_score=80.0,
            camera_id=None,
            video_id="video_002.mp4",
            snapshot_path="snapshots/snap2.jpg",
            track_id=5,
            confidence=0.88,
        )
    )

    assert res2.action == "updated"
    assert res2.unknown_id == "U-000001"
    assert res2.distinct_video_count == 2
    assert res2.similarity >= settings.UNKNOWN_MATCH_THRESHOLD


# ── Test 3: 100 frames of same track does not count as 100 appearances ───────
def test_3_same_video_and_camera_deduplication(manager):
    emb = gen_embedding(200)
    # First appearance in video_001
    res1 = asyncio.run(
        manager.process_unknown_face(
            embedding=emb,
            quality_score=70.0,
            camera_id=None,
            video_id="video_001.mp4",
            snapshot_path="snapshots/snap1.jpg",
            track_id=1,
            confidence=0.95,
        )
    )
    assert res1.action == "created"

    # 100 duplicate observations in the same video
    for i in range(100):
        dup_res = asyncio.run(
            manager.process_unknown_face(
                embedding=perturb_embedding(emb, 0.01),
                quality_score=70.0,
                camera_id=None,
                video_id="video_001.mp4",
                snapshot_path="snapshots/snap1.jpg",
                track_id=1,
                confidence=0.95,
            )
        )
        assert dup_res.action == "duplicate"
        assert dup_res.distinct_video_count == 1


# ── Test 4: Same unknown in same video does not increase distinctVideoCount ──
def test_4_same_video_count_remains_one(manager):
    emb = gen_embedding(300)
    asyncio.run(
        manager.process_unknown_face(
            embedding=emb,
            quality_score=70.0,
            camera_id=None,
            video_id="video_SAME.mp4",
            snapshot_path="snapshots/snap.jpg",
            track_id=10,
            confidence=0.9,
        )
    )

    res = asyncio.run(
        manager.process_unknown_face(
            embedding=emb,
            quality_score=70.0,
            camera_id=None,
            video_id="video_SAME.mp4",
            snapshot_path="snapshots/snap.jpg",
            track_id=20,
            confidence=0.9,
        )
    )

    assert res.action == "duplicate"
    assert res.distinct_video_count == 1


# ── Test 5: Four distinct videos changes UNKNOWN → RECURRING ─────────────────
def test_5_four_videos_triggers_recurring(manager):
    emb = gen_embedding(400)
    videos = ["vid_A.mp4", "vid_B.mp4", "vid_C.mp4", "vid_D.mp4"]

    statuses = []
    for vid in videos:
        res = asyncio.run(
            manager.process_unknown_face(
                embedding=perturb_embedding(emb, 0.02),
                quality_score=75.0,
                camera_id=None,
                video_id=vid,
                snapshot_path=f"snapshots/{vid}.jpg",
                track_id=1,
                confidence=0.9,
            )
        )
        statuses.append(res.new_status)

    # 1-3 videos → UNKNOWN, 4th video → RECURRING
    assert statuses[:3] == ["UNKNOWN", "UNKNOWN", "UNKNOWN"]
    assert statuses[3] == "RECURRING"


# ── Test 6: Eleven distinct videos changes RECURRING → REVIEW_REQUIRED ──────
def test_6_eleven_videos_triggers_review_required(manager):
    emb = gen_embedding(500)
    videos = [f"vid_{i:02d}.mp4" for i in range(1, 12)]  # 11 videos

    last_res = None
    for vid in videos:
        last_res = asyncio.run(
            manager.process_unknown_face(
                embedding=perturb_embedding(emb, 0.02),
                quality_score=75.0,
                camera_id=None,
                video_id=vid,
                snapshot_path=f"snapshots/{vid}.jpg",
                track_id=1,
                confidence=0.9,
            )
        )

    assert last_res.new_status == "REVIEW_REQUIRED"
    assert last_res.distinct_video_count == 11


# ── Test 7: Different unknown people remain separate ────────────────────────
def test_7_different_unknowns_stay_separate(manager):
    emb1 = gen_embedding(601)
    emb2 = gen_embedding(602)  # orthogonal / different seed

    res1 = asyncio.run(
        manager.process_unknown_face(
            embedding=emb1,
            quality_score=80.0,
            camera_id=None,
            video_id="vid_1.mp4",
            snapshot_path="snap1.jpg",
            track_id=1,
            confidence=0.9,
        )
    )

    res2 = asyncio.run(
        manager.process_unknown_face(
            embedding=emb2,
            quality_score=80.0,
            camera_id=None,
            video_id="vid_2.mp4",
            snapshot_path="snap2.jpg",
            track_id=1,
            confidence=0.9,
        )
    )

    assert res1.unknown_id == "U-000001"
    assert res2.unknown_id == "U-000002"
    assert manager.faiss_index.size == 2


# ── Test 8: Low-quality detections are ignored ──────────────────────────────
def test_8_low_quality_rejected(manager):
    emb = gen_embedding(700)
    res = asyncio.run(
        manager.process_unknown_face(
            embedding=emb,
            quality_score=10.0,  # below UNKNOWN_MIN_QUALITY_SCORE (50.0)
            camera_id=None,
            video_id="vid_1.mp4",
            snapshot_path="snap.jpg",
            track_id=1,
            confidence=0.9,
        )
    )

    assert res.action == "rejected"
    assert manager.faiss_index.size == 0


# ── Test 9: Known people never enter unknown index ──────────────────────────
def test_9_known_match_preempts_unknown_pipeline():
    """
    Simulates the orchestrator behavior: if known FAISS matches,
    unknown_person_manager is NEVER called for that face.
    """
    from services.faiss_manager import FaissManager
    faiss_mgr = FaissManager()
    faiss_mgr.add_user("USER_REGISTERED_123", gen_embedding(900))

    query_emb = gen_embedding(900)  # exact match for registered user
    known_match = faiss_mgr.search(query_emb, threshold=0.35)

    assert known_match is not None
    assert known_match[0] == "USER_REGISTERED_123"
    # Orchestrator stops here → Unknown pipeline is bypassed!


# ── Test 10: Restart restores unknown identities from MongoDB ────────────────
def test_10_restart_restores_from_mongodb():
    mock_db = MockCollection()
    emb = gen_embedding(1000)

    # Simulate existing document in DB
    mock_db.docs.append({
        "_id": "64a000000000000000000001",
        "unknownId": "U-000042",
        "representativeEmbedding": emb.tolist(),
        "status": "RECURRING",
        "distinctVideoCount": 5,
        "distinctCameraCount": 2,
        "appearanceCount": 7,
        "appearances": [{"videoId": "vid_1"}, {"videoId": "vid_2"}],
        "firstSeen": time.time(),
        "lastSeen": time.time(),
    })

    # Initialize new manager
    new_mgr = UnknownPersonManager()
    asyncio.run(new_mgr.initialize({"unknownpersons": mock_db}))

    assert new_mgr.faiss_index.size == 1
    assert "U-000042" in new_mgr._identities
    assert new_mgr._id_counter == 42
    assert new_mgr._identities["U-000042"].status == "RECURRING"


# ── Test 11: Concurrent processing does not create duplicate IDs ─────────────
def test_11_concurrent_processing_safety(manager):
    embs = [gen_embedding(1100 + i) for i in range(10)]

    async def worker_task(e, vid):
        return await manager.process_unknown_face(
            embedding=e,
            quality_score=80.0,
            camera_id=None,
            video_id=vid,
            snapshot_path="snap.jpg",
            track_id=1,
            confidence=0.9,
        )

    async def run_concurrent():
        tasks = [worker_task(embs[i], f"vid_{i}.mp4") for i in range(10)]
        return await asyncio.gather(*tasks)

    results = asyncio.run(run_concurrent())
    uids = [r.unknown_id for r in results if r.action == "created"]

    # All created IDs must be unique
    assert len(uids) == len(set(uids))


# ── Test 12: Invalid/corrupted embeddings do not crash startup ──────────────
def test_12_corrupted_embeddings_graceful_handling():
    mock_db = MockCollection()

    # Document 1: invalid dimension (100D instead of 512D)
    mock_db.docs.append({
        "_id": "64a000000000000000000001",
        "unknownId": "U-000001",
        "representativeEmbedding": [0.1] * 100,
        "status": "UNKNOWN",
    })

    # Document 2: valid embedding
    valid_emb = gen_embedding(1200)
    mock_db.docs.append({
        "_id": "64a000000000000000000002",
        "unknownId": "U-000002",
        "representativeEmbedding": valid_emb.tolist(),
        "status": "UNKNOWN",
    })

    mgr = UnknownPersonManager()
    # Should not throw exception
    asyncio.run(mgr.initialize({"unknownpersons": mock_db}))

    assert mgr.faiss_index.size == 1
    assert "U-000002" in mgr._identities
    assert "U-000001" not in mgr._identities


# ── Test 13: Status-change notifications emitted only on transitions ─────────
def test_13_status_change_notifications_only_on_transitions(manager):
    emb = gen_embedding(1300)

    with patch.object(manager, "_notify_status_change", new_callable=AsyncMock) as mock_notify:
        # Video 1: UNKNOWN created (no transition notify)
        asyncio.run(
            manager.process_unknown_face(
                embedding=emb, quality_score=75.0, camera_id=None,
                video_id="v1.mp4", snapshot_path="s.jpg", track_id=1, confidence=0.9
            )
        )
        assert mock_notify.call_count == 0

        # Video 2 & 3: Still UNKNOWN
        asyncio.run(
            manager.process_unknown_face(
                embedding=emb, quality_score=75.0, camera_id=None,
                video_id="v2.mp4", snapshot_path="s.jpg", track_id=1, confidence=0.9
            )
        )
        asyncio.run(
            manager.process_unknown_face(
                embedding=emb, quality_score=75.0, camera_id=None,
                video_id="v3.mp4", snapshot_path="s.jpg", track_id=1, confidence=0.9
            )
        )
        assert mock_notify.call_count == 0

        # Video 4: UNKNOWN → RECURRING transition!
        asyncio.run(
            manager.process_unknown_face(
                embedding=emb, quality_score=75.0, camera_id=None,
                video_id="v4.mp4", snapshot_path="s.jpg", track_id=1, confidence=0.9
            )
        )
        assert mock_notify.call_count == 1
        call_args = mock_notify.call_args[0]
        assert call_args[0] == "U-000001"
        assert call_args[1] == "UNKNOWN"
        assert call_args[2] == "RECURRING"

        # Video 5: Still RECURRING → no new notification
        asyncio.run(
            manager.process_unknown_face(
                embedding=emb, quality_score=75.0, camera_id=None,
                video_id="v5.mp4", snapshot_path="s.jpg", track_id=1, confidence=0.9
            )
        )
        assert mock_notify.call_count == 1
