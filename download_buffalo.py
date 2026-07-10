import urllib.request
import zipfile
import os
import shutil

url = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"
zip_path = r"C:\Users\Lenovo\OneDrive\Desktop\Major\buffalo_l.zip"
extract_dir = r"C:\Users\Lenovo\OneDrive\Desktop\Major\buffalo_l"

if not os.path.exists(zip_path):
    print(f"Downloading buffalo_l.zip from {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(zip_path, 'wb') as out_file:
        shutil.copyfileobj(response, out_file)
    print("Download complete.")

print("Extracting...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_dir)

print("Files extracted:")
for f in os.listdir(extract_dir):
    print(f)
    
# Copy w600k_r50.onnx
shutil.copy(
    os.path.join(extract_dir, "w600k_r50.onnx"), 
    r"C:\Users\Lenovo\OneDrive\Desktop\Major\ai-service\models\weights\recognizer\w600k_r50.onnx"
)

# Copy det_10g.onnx as scrfd_2.5g_bnkps.onnx (same input/output interface, just different size)
shutil.copy(
    os.path.join(extract_dir, "det_10g.onnx"), 
    r"C:\Users\Lenovo\OneDrive\Desktop\Major\ai-service\models\weights\detector\scrfd_2.5g_bnkps.onnx"
)

print("Models copied successfully!")
