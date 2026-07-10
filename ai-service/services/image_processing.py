"""
image_processing.py
Advanced face alignment and cropping utilities.
Uses skimage SimilarityTransform for ArcFace-standard 112×112 alignment.
Also adds CLAHE-based contrast enhancement for low-light faces.
"""
import cv2
import numpy as np
from typing import Optional

# Standard ArcFace reference facial points (112×112 output)
_ARCFACE_REF = np.array([
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
], dtype=np.float32)

# CLAHE for contrast enhancement (created once)
_clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))


def align_face(img: np.ndarray, landmarks: np.ndarray, enhance: bool = True) -> np.ndarray:
    """
    Align a face using 5 facial landmarks to the ArcFace 112×112 standard.

    Args:
        img:        BGR image (full frame or crop).
        landmarks:  5×2 ndarray of (x, y) keypoints.
        enhance:    If True, apply CLAHE contrast enhancement on the aligned face.
    Returns:
        112×112 BGR aligned face.
    """
    from skimage import transform as trans

    lmks = np.array(landmarks, dtype=np.float32).reshape(5, 2)
    tform = trans.SimilarityTransform()
    tform.estimate(lmks, _ARCFACE_REF)
    M = tform.params[:2, :]

    aligned = cv2.warpAffine(
        img, M, (112, 112),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REFLECT,
    )

    if enhance:
        # Apply CLAHE per-channel to improve recognition in poor lighting
        b, g, r = cv2.split(aligned)
        aligned = cv2.merge([_clahe.apply(b), _clahe.apply(g), _clahe.apply(r)])

    return aligned


def crop_face(img: np.ndarray, bbox: np.ndarray, margin: float = 0.25) -> np.ndarray:
    """
    Crop a face with a proportional margin, clamped to image bounds.
    margin=0.25 adds 25% padding on each side.
    """
    x1, y1, x2, y2 = bbox[:4].astype(int)
    h, w = img.shape[:2]
    bw, bh = x2 - x1, y2 - y1
    nx1 = max(0, int(x1 - bw * margin))
    ny1 = max(0, int(y1 - bh * margin))
    nx2 = min(w, int(x2 + bw * margin))
    ny2 = min(h, int(y2 + bh * margin))
    return img[ny1:ny2, nx1:nx2]


def compute_face_quality(img: np.ndarray) -> float:
    """
    Return a quality score (0–1) for a face crop.
    Based on sharpness (Laplacian variance) normalised to [0,1].
    Scores above ~0.3 are considered usable.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    # Sigmoid-like normalisation: score → 1 as var → ∞
    return float(1.0 - 1.0 / (1.0 + var / 200.0))
