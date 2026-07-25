# Sentinel AI Pipeline: Technical Deep Dive

This document provides a highly detailed, step-by-step breakdown of exactly how a video frame is processed from the camera down to the FAISS database to generate a real-time face recognition alert. 

Use this guide for your presentation to explain the internal mechanisms of the AI microservice.

---

## 1. Stream Ingestion & Management (`live_pipeline.py`)

The `LiveStreamManager` handles continuous connections to RTSP camera streams.

- **Connection & Auto-Recovery**: Uses OpenCV (`cv2.VideoCapture`) to connect to streams. If a camera disconnects or drops a frame, the manager uses an **Exponential Backoff Algorithm** to attempt reconnection (starts at 2s, doubles up to 60s) to prevent overwhelming the network.
- **FPS Capping**: To prevent GPU/CPU overload, it artificially limits the processing frame rate via `asyncio.sleep` to match the configured `LIVE_STREAM_FPS_CAP`.
- **Alert Deduplication (Cooldown)**: Before sending an alert webhook to the Node.js backend, it checks an internal cooldown dictionary. By default, it will not alert on the *same* recognized person on the *same* camera for 60 seconds (`ALERT_COOLDOWN_SEC`).

---

## 2. The Core Recognition Pipeline (`recognition_pipeline.py`)

When a frame is successfully read, it is passed into the `RecognitionPipeline.process_frame()` method. This is where the heavy lifting occurs.

### Step 2.1: Face Detection & Keypoint Extraction
- The frame is passed to `FaceDetector.detect()` (`detector.py`).
- **Processing**: The image is dynamically resized to a maximum dimension of 640px while maintaining the aspect ratio.
- **Model**: An ONNX model (typically SCRFD) runs inference. It outputs bounding boxes, classification scores, and 5 facial keypoints (eyes, nose, mouth corners) across three different feature map strides (8, 16, 32).
- **Refinement**: Non-Maximum Suppression (NMS) with an IoU threshold of 0.4 is applied to remove duplicate overlapping boxes.

### Step 2.2: Face Tracking (ByteTrack)
- The detected bounding boxes are passed into the `Tracker` (`tracker.py`).
- **Purpose**: Instead of treating every frame as independent, the tracker assigns a unique `track_id` to a person. It remembers where a face was in the previous frame and tracks it continuously even if the person turns slightly.

### Step 2.3: Performance Optimization (Recognition Cache)
- Before running heavy AI embedding models, the pipeline checks the RAM-based `recognition_cache`.
- If the current `track_id` has already been confirmed as a specific person in previous frames, the system skips all further AI processing for this frame and instantly returns the cached result, massively saving computational power.

### Step 2.4: Face Quality Gate (Blur & Size Check)
- If the track is new, the pipeline evaluates the image quality using `_face_quality_score()`.
- **Size Check**: Discards faces that are too small (below `MIN_FACE_SIZE`).
- **Blur Check**: Converts the face crop to grayscale and calculates the **Laplacian Variance**. If the variance is below the `BLUR_THRESHOLD`, the frame is too blurry and is skipped.

### Step 2.5: Alignment & Embedding Extraction
- **Alignment**: Uses the 5 keypoints to geometrically align the face (`align_face`). This ensures the eyes and nose are always in the exact same coordinate space before embedding, dramatically increasing accuracy.
- **Embedding**: The aligned face crop is fed into the `recognizer.py` ONNX model (usually ArcFace). This generates a 512-dimensional vector (embedding) that mathematically represents the unique geometry of the face.

### Step 2.6: Vector Search & Matching (`faiss_manager.py`)
- The 512D embedding is instantly matched using the pipeline's operational mode:
  - **Full DB Mode**: Uses **FAISS** (Facebook AI Similarity Search). FAISS normalizes the vector (L2 normalization) and performs an extremely fast `IndexFlatIP` (Inner Product / Cosine Similarity) search against millions of registered embeddings in RAM.
  - **Target / Multi-Target Mode**: Uses raw NumPy Cosine Similarity to compare the frame strictly against a specific subset of user embeddings (useful for searching for a specific missing person).

### Step 2.7: Multi-Frame Voting (False Positive Elimination)
- A high similarity match does **not** trigger an instant alert.
- The pipeline uses a strict **Voting System**: A match is only confirmed if the *same* `track_id` matches the *same* `user_id` for **3 consecutive frames** (`VOTE_FRAMES = 3`).
- If a person is only matched for 1 frame (e.g., a glitch or odd angle), the vote resets. This virtually eliminates false positives.

### Step 2.8: Snapshot & Webhook
- Once confirmed by the voting system, the pipeline crops the bounding box (adding 20 pixels of padding) and saves it to disk via `_save_snapshot()`.
- The ID, confidence score, and snapshot filename are returned to the `LiveStreamManager`, which fires the HTTP POST webhook to the Node.js backend.
