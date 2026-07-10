import onnxruntime
import sys

try:
    session = onnxruntime.InferenceSession(r"C:\Users\Lenovo\OneDrive\Desktop\Major\ai-service\models\weights\detector\scrfd_2.5g_bnkps.onnx", providers=['CPUExecutionProvider'])
    
    print("Inputs:")
    for inp in session.get_inputs():
        print(f"- {inp.name}: {inp.shape} ({inp.type})")
        
    print("\nOutputs:")
    for out in session.get_outputs():
        print(f"- {out.name}: {out.shape} ({out.type})")
except Exception as e:
    print("Error:", e)
