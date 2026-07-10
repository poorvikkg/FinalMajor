import urllib.request
import cv2
import os

url = "https://raw.githubusercontent.com/opencv/opencv/master/samples/data/lena.jpg"
path = r"C:\Users\Lenovo\OneDrive\Desktop\Major\lena.jpg"

if not os.path.exists(path):
    print("Downloading test image...")
    urllib.request.urlretrieve(url, path)

import sys
sys.path.append(r"C:\Users\Lenovo\OneDrive\Desktop\Major\ai-service")

from services.detector import detector
from services.recognizer import recognizer
from services.image_processing import align_face
from config.settings import settings
from services.model_manager import model_manager
import numpy as np

model_manager.load_model("detector", settings.DETECTOR_MODEL_PATH)
model_manager.load_model("recognizer", settings.RECOGNIZER_MODEL_PATH)

settings.DEBUG = True

print("Loading image...")
img = cv2.imread(path)
if img is None:
    print("Failed to load image!")
    sys.exit(1)

print(f"Image shape: {img.shape}")

print("Running detection...")
bboxes, kpss = detector.detect(img)
print(f"Detected {len(bboxes)} faces.")

for i, (b, k) in enumerate(zip(bboxes, kpss)):
    print(f"Face {i}: bbox {b[:4]}, score {b[4]:.4f}")
    
    print("Aligning face...")
    aligned = align_face(img, k)
    
    cv2.imwrite(rf"C:\Users\Lenovo\OneDrive\Desktop\Major\ai-service\logs\debug\5_aligned_face_{i}.jpg", aligned)
    
    print("Running recognition...")
    emb = recognizer.get_embedding(aligned)
    print(f"Embedding shape: {emb.shape}")
    print(f"Embedding norm: {np.linalg.norm(emb):.4f}")

print("Test complete. Check C:\\Users\\Lenovo\\OneDrive\\Desktop\\Major\\ai-service\\logs\\debug\\")
