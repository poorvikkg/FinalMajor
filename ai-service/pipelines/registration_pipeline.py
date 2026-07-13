import cv2
import numpy as np
import faiss
from typing import List
from services.detector import detector
from services.recognizer import recognizer
from services.faiss_manager import faiss_manager
from cache.embedding_cache import embedding_cache
from services.image_processing import align_face
from config.settings import settings
import os
import uuid
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

logger = logging.getLogger(__name__)


class RegistrationError(Exception):
    pass


def _extract_embedding_from_bytes(image_bytes: bytes) -> tuple:
    """
    Decode image bytes, detect exactly one face, align it, and return its embedding.
    Returns (embedding: np.ndarray, aligned_face: np.ndarray) on success.
    Raises RegistrationError if image is invalid, has no face, or has multiple faces.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise RegistrationError("Invalid image file.")

    bboxes, kpss = detector.detect(img)

    if len(bboxes) == 0:
        raise RegistrationError("No face detected in the image.")
    if len(bboxes) > 1:
        raise RegistrationError("Multiple faces detected. Please provide an image with only one face.")

    aligned_face = align_face(img, kpss[0])
    embedding = recognizer.get_embedding(aligned_face)
    return embedding, aligned_face


def _compute_mean_embedding(embeddings: List[np.ndarray]) -> np.ndarray:
    """
    Average a list of L2-normalized embeddings and re-normalize the result.
    This produces a single strong composite embedding.
    """
    stacked = np.vstack(embeddings).astype(np.float32)
    mean_emb = np.mean(stacked, axis=0, keepdims=True)  # (1, 512)
    faiss.normalize_L2(mean_emb)                        # in-place L2 normalize
    return mean_emb[0]                                   # (512,)


async def _persist_embedding(user_id: str, embedding: np.ndarray):
    """Save the embedding to MongoDB so it survives restarts."""
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        db = client.get_database()
        collection = db[settings.MONGODB_COLLECTION_EMBEDDINGS]
        result = await collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"searchVector": embedding.tolist()}}
        )
        client.close()
        if result.matched_count == 1:
            logger.info(f"Persisted embedding for {user_id} to MongoDB (modified={result.modified_count})")
        else:
            logger.warning(f"MongoDB update for {user_id}: no document matched _id")
    except Exception as e:
        logger.error(f"Failed to persist embedding to MongoDB for {user_id}: {e}")


def _update_ram_and_faiss(user_id: str, embedding: np.ndarray):
    """Replace the in-memory cache and FAISS index entry for this user."""
    # Remove old entries for this user to avoid duplicates
    embedding_cache.remove(user_id)
    embedding_cache.add(user_id, embedding)

    # Rebuild FAISS fully from cache (cleanest approach; fast for < 100k faces)
    faiss_manager.build_from_cache()
    faiss_manager.save_index()


# ── Public API ─────────────────────────────────────────────────────────────────

async def register_user_batch(images_bytes: List[bytes], user_id: str) -> dict:
    """
    Register a person using multiple photos.

    For each image:
      - Detect exactly one face (skip if 0 or >1 faces are found).
      - Generate a 512-dim ArcFace embedding.

    All valid embeddings are averaged and L2-normalized into one strong
    composite embedding, then persisted to MongoDB + RAM cache + FAISS.

    Returns a summary dict with counts of processed / skipped images.
    """
    if not images_bytes:
        raise RegistrationError("At least one image is required.")

    valid_embeddings: List[np.ndarray] = []
    saved_filenames: List[str] = []
    skip_reasons: List[str] = []

    for idx, img_bytes in enumerate(images_bytes):
        try:
            embedding, aligned_face = _extract_embedding_from_bytes(img_bytes)

            # Normalize before averaging
            emb_norm = embedding.copy().reshape(1, -1).astype(np.float32)
            faiss.normalize_L2(emb_norm)
            valid_embeddings.append(emb_norm[0])

            # Save aligned face to disk (audit trail)
            filename = f"{user_id}_{uuid.uuid4().hex[:8]}.jpg"
            filepath = os.path.join(settings.FACES_DIR, filename)
            cv2.imwrite(filepath, aligned_face)
            saved_filenames.append(filename)

            logger.info(f"[Batch] Image {idx + 1}: embedding extracted OK")
        except RegistrationError as e:
            reason = f"Image {idx + 1}: {e}"
            skip_reasons.append(reason)
            logger.warning(f"[Batch] Skipped — {reason}")

    if not valid_embeddings:
        raise RegistrationError(
            f"No valid face found in any of the {len(images_bytes)} provided images. "
            f"Reasons: {'; '.join(skip_reasons)}"
        )

    # Build strong composite embedding
    composite = _compute_mean_embedding(valid_embeddings)
    logger.info(
        f"[Batch] Composite embedding built from {len(valid_embeddings)}/{len(images_bytes)} images."
    )

    # Persist everywhere
    await _persist_embedding(user_id, composite)
    _update_ram_and_faiss(user_id, composite)

    logger.info(f"[Batch] Successfully registered user {user_id}")

    return {
        "status": "success",
        "user_id": user_id,
        "images_processed": len(valid_embeddings),
        "images_skipped": len(skip_reasons),
        "skip_reasons": skip_reasons,
        "saved_faces": saved_filenames,
    }


async def register_user(image_bytes: bytes, user_id: str) -> dict:
    """
    Single-image registration (backward-compatible wrapper).
    Internally delegates to register_user_batch with one image.
    """
    result = await register_user_batch([image_bytes], user_id)
    # Return shape compatible with old RegisterUserResponse schema
    return {
        "status": result["status"],
        "user_id": result["user_id"],
        "filename": result["saved_faces"][0] if result["saved_faces"] else "",
    }

