import urllib.request
import os

MODELS = {
    r"C:\Users\Lenovo\OneDrive\Desktop\Major\ai-service\models\weights\detector\scrfd_2.5g_bnkps.onnx": 
        "https://huggingface.co/DIAMONIK7777/scrfd/resolve/main/scrfd_2.5g_bnkps.onnx",
    r"C:\Users\Lenovo\OneDrive\Desktop\Major\ai-service\models\weights\recognizer\w600k_r50.onnx": 
        "https://huggingface.co/DIAMONIK7777/w600k_r50/resolve/main/w600k_r50.onnx"
}

for path, url in MODELS.items():
    if not os.path.exists(path):
        print(f"Downloading {os.path.basename(path)} from {url}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(path, 'wb') as out_file:
                data = response.read()
                out_file.write(data)
            print(f"Successfully downloaded to {path} ({len(data)} bytes)")
        except Exception as e:
            print(f"Failed to download {url}: {e}")
            
            # Fallback URL for scrfd if the first fails
            if "scrfd" in url:
                fallback = "https://github.com/nizhib/scrfd/releases/download/v1.0/scrfd_2.5g_bnkps.onnx"
                print(f"Trying fallback: {fallback}")
                try:
                    req = urllib.request.Request(fallback, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response, open(path, 'wb') as out_file:
                        data = response.read()
                        out_file.write(data)
                    print(f"Successfully downloaded to {path}")
                except Exception as e2:
                    print(f"Fallback also failed: {e2}")
    else:
        print(f"{os.path.basename(path)} already exists.")
