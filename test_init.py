import sys
sys.path.append(r'C:\Users\Lenovo\OneDrive\Desktop\Major\ai-service')

from pipelines.recognition_pipeline import RecognitionPipeline

p = RecognitionPipeline(camera_id="test", target_user_id="undefined")
print("Target user ID:", repr(p.target_user_id))
print("Target embedding:", repr(p.target_embedding))
print("Is None?", p.target_embedding is None)
