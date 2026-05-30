import sys
from ultralytics import YOLO

print("[Python] Resuming YOLO Training directly...")
checkpoint_path = r"D:\Study\DETECT_VNESE_PROPS\runs\detect\crowded_cpu_fix2\weights\last.pt"

try:
    print(f"Loading checkpoint: {checkpoint_path}")
    model = YOLO(checkpoint_path)
except Exception as e:
    print(f"Cannot load last.pt: {e}")
    sys.exit(1)

try:
    model.train(resume=True)
except Exception as e:
    print(f"Training failed or interrupted: {e}")
    sys.exit(1)
