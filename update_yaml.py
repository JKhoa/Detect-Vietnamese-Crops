import yaml

orig_yaml = r"C:\Users\Admin\Downloads\Study\machinelearningBT\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch\data.yaml"
aug_yaml = r"C:\Users\Admin\Downloads\Study\machinelearningBT\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch_aug\data_aug.yaml"
orig_dir = r"C:\Users\Admin\Downloads\Study\machinelearningBT\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch"
aug_dir = r"C:\Users\Admin\Downloads\Study\machinelearningBT\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch_aug"

with open(orig_yaml, "r", encoding="utf-8") as f:
    data = yaml.safe_load(f)

# Put absolute paths
data["path"] = orig_dir.replace("\\", "/")
data["train"] = aug_dir.replace("\\", "/") + "/train/images"
data["val"] = orig_dir.replace("\\", "/") + "/valid/images"
data["test"] = orig_dir.replace("\\", "/") + "/test/images"

with open(aug_yaml, "w", encoding="utf-8") as f:
    yaml.dump(data, f, sort_keys=False)
print("Updated YAML successfully!")
