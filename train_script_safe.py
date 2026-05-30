import sys
from ultralytics import YOLO

print("[Python] Resuming YOLO Training...")
try:
    model = YOLO(r"D:\Study\DETECT_VNESE_PROPS\runs\detect\crowded_cpu_fix\weights\last.pt") # Try resume if exists
except Exception:
    model = YOLO("yolo11n.pt")

data_yaml = r"C:\Users\Admin\Downloads\Study\machinelearningBT\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch_aug\data_aug.yaml"
hyp_yaml = r"D:\Study\DETECT_VNESE_PROPS\Web app for agricultural detection\backend\training\hyp_crowded.yaml"
proj_dir = r"D:\Study\DETECT_VNESE_PROPS\runs\detect"

try:
    model.train(
        data=data_yaml,
        cfg=hyp_yaml,
        epochs=200,
        imgsz=640,
        batch=4,           # Giảm tiếp batch size để tránh hết RAM đột ngột
        device="cpu",
        amp=False,         # Disable AMP
        multi_scale=False, # Disable multi-scale
        workers=0,         # TẮT hoàn toàn multiprocessing (Nguyên nhân chính gây crash ngầm trên Windows)
        project=proj_dir,
        name="crowded_cpu_fix2"
    )
except Exception as e:
    print(f"Training failed: {e}")
    sys.exit(1)
