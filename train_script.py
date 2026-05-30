import os
import sys
import torch
from ultralytics import YOLO

print("[Python] Starting YOLO Training via Python Code...")
try:
    model = YOLO("yolo11n.pt")
except Exception:
    model = YOLO("yolov8n.pt")

data_yaml = r"C:\Users\Admin\Downloads\Study\machinelearningBT\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch_aug\data_aug.yaml"
hyp_yaml = r"D:\Study\DETECT_VNESE_PROPS\Web app for agricultural detection\backend\training\hyp_crowded.yaml"
proj_dir = r"D:\Study\DETECT_VNESE_PROPS\runs\detect"

try:
    model.train(
        data=data_yaml,
        cfg=hyp_yaml,
        epochs=200,
        imgsz=640,
        batch=8,           # Reduce batch size for CPU stability
        device="cpu",
        amp=False,         # Disable AMP on CPU
        multi_scale=False, # Disable multi-scale to fix output (H: 0, W: 0) error
        workers=4,         # Use fewer workers
        project=proj_dir,
        name="crowded_cpu_fix"
    )
except Exception as e:
    print(f"Training failed: {e}")
    sys.exit(1)

print("[Python] Validation...")
try:
    model.val(data=data_yaml, device="cpu", project=proj_dir, name="val_crowded_cpu_fix")
except Exception as e:
    print("Val failed: ", e)
