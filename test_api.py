import requests

def test_api():
    url = "http://127.0.0.1:8000/videos/process"
    files = {
        'video': ('video_1783627420761.mp4', open(r'c:\Users\Lenovo\OneDrive\Desktop\Major\backend\uploads\video_1783627420761.mp4', 'rb'), 'video/mp4')
    }
    data = {
        'camera_id': 'test',
        'skip_frames': 5
    }
    print("Sending request...")
    response = requests.post(url, files=files, data=data)
    print("Status Code:", response.status_code)
    print("Response JSON:", response.text)

if __name__ == "__main__":
    test_api()
