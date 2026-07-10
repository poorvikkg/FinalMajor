import cv2
import numpy as np
from services.detector import detector
from services.model_manager import model_manager

# Ensure models are loaded
model_manager.load_model("detector", r"C:\Users\Lenovo\OneDrive\Desktop\Major\ai-service\models\weights\detector\scrfd_2.5g_bnkps.onnx")

# Create a test image
img = np.zeros((480, 640, 3), dtype=np.uint8)
# Add a fake face pattern so it's not totally black? Actually just see if the ONNX pass succeeds
try:
    bboxes, kpss = detector.detect(img)
    print("DETECTION SUCCESS")
    print(f"Bboxes shape: {bboxes.shape}")
    print(f"Kpss shape: {kpss.shape}")
except Exception as e:
    print("DETECTION FAILED")
    import traceback
    traceback.print_exc()
