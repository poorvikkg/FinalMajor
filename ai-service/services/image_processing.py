"""
image_processing.py
Advanced face alignment and cropping utilities.
Uses skimage SimilarityTransform for ArcFace-standard 112×112 alignment.
Also adds CLAHE-based contrast enhancement for low-light faces.
"""
import cv2
import numpy as np
from typing import Optional, Tuple

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
    lmks = np.array(landmarks, dtype=np.float32).reshape(5, 2)
    try:
        from skimage import transform as trans
        tform = trans.SimilarityTransform()
        tform.estimate(lmks, _ARCFACE_REF)
        M = tform.params[:2, :]
    except ImportError:
        M, _ = cv2.estimateAffinePartial2D(lmks, _ARCFACE_REF)

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


def align_face_tta(img: np.ndarray, landmarks: np.ndarray, enhance: bool = True) -> Tuple[np.ndarray, np.ndarray]:
    """
    Returns ArcFace 112×112 aligned face crop AND its horizontally flipped version for Test-Time Augmentation (TTA).
    """
    aligned = align_face(img, landmarks, enhance=enhance)
    flipped = cv2.flip(aligned, 1)
    return aligned, flipped


def compute_head_pose_symmetry(landmarks: np.ndarray) -> float:
    """
    Evaluates keypoint symmetry ratio (eye-to-nose distances).
    Returns symmetry score between 0.0 (extreme side profile) and 1.0 (perfect front view).
    """
    if landmarks is None or len(landmarks) < 5:
        return 0.5
    lmks = np.array(landmarks, dtype=np.float32).reshape(5, 2)
    left_eye, right_eye, nose = lmks[0], lmks[1], lmks[2]
    
    dist_l = np.linalg.norm(left_eye - nose)
    dist_r = np.linalg.norm(right_eye - nose)
    if dist_l + dist_r < 1e-4:
        return 0.0
    
    ratio = min(dist_l, dist_r) / max(dist_l, dist_r)
    return float(np.clip(ratio, 0.0, 1.0))


def compute_face_quality(img: np.ndarray, landmarks: Optional[np.ndarray] = None) -> float:
    """
    Multi-Factor Face Quality Index (FQI) (0.0 to 1.0).
    Evaluates Sharpness, Head Pose Symmetry, and Exposure Balance.
    """
    if img is None or img.size == 0:
        return 0.0
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    
    # 1. Sharpness score
    var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    sharpness_score = float(1.0 - 1.0 / (1.0 + var / 200.0))
    
    # 2. Exposure score (punishes mean intensity < 30 or > 225)
    mean_val = float(np.mean(gray))
    if mean_val < 30 or mean_val > 225:
        exposure_penalty = 0.5
    else:
        exposure_penalty = 1.0
        
    # 3. Head Pose Symmetry score
    pose_score = compute_head_pose_symmetry(landmarks) if landmarks is not None else 1.0
    
    # Composite weighted Quality Index
    fqi = (0.5 * sharpness_score + 0.3 * pose_score + 0.2 * exposure_penalty)
    return round(float(fqi), 3)
