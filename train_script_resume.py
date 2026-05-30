import sys
from ultralytics import YOLO

print("[Python] Resuming YOLO Training directly...")
try:
    print("Resuming from crowded_cpu_fix2/last.pt")
    model = YOLO(r"D:\Study\DETECT_VNESE_PROPS\runs\detect\crowded_cpu_fix2\weights\last.pt") 
except Exception as e:
    print(f"Cannot load last.pt: {e}")
    sys.exit(1)

data_yaml = r"C:\Users\Admin\Downloads\Study\machinelearningBT\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch_aug\data_aug.yaml"
hyp_yaml = r"D:\Study\DETECT_VNESE_PROPS\Web app for agricultural detection\backend\training\hyp_crowded.yaml"
proj_dir = r"D:\Study\DETECT_VNESE_PROPS\runs\detect"

try:
    model.train(
        data=data_yaml,
        cfg=hyp_yaml,
        epochs=200,
        imgsz=640,
        batch=4,
        device="cpu", # CPU Training
        amp=False,
        multi_scale=False,
        workers=0,
        project=proj_dir,
        name="crowded_cpu_fix_resume_2", # Save to new dir
        resume=True 
    )
except Exception as e:
    print(f"Training failed: {e}")
    sys.exit(1)
