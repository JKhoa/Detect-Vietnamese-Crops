"""
Pre-flight Check Script
Validates all configurations before starting training
"""

import os
import sys
from pathlib import Path
import yaml

def print_section(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def check_mark(condition):
    return "✓" if condition else "✗"

def main():
    print("\n" + "="*70)
    print("  YOLO TRAINING - PRE-FLIGHT CHECK")
    print("="*70)
    
    all_good = True
    
    # 1. Check paths
    print_section("1. PATH VALIDATION")
    
    paths_to_check = {
        "Training script": Path(r"d:\Study\Detect_VNese_Props\train_vn_yolo26.py"),
        "Launcher script": Path(r"d:\Study\Detect_VNese_Props\launch_training.py"),
        "Data YAML": Path(r"d:\Study\Detect_VNese_Props\100_crops_plants_object_detection_25k_image_dataset\leaflogic_vn\data.yaml"),
        "Dataset root": Path(r"d:\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch"),
        "Ultralytics folder": Path(r"d:\Study\Detect_VNese_Props\ultralytics"),
    }
    
    for name, path in paths_to_check.items():
        exists = path.exists()
        print(f"{check_mark(exists)} {name}: {path}")
        if not exists:
            all_good = False
    
    # 2. Check data.yaml configuration
    print_section("2. DATA CONFIGURATION")
    
    data_yaml_path = Path(r"d:\Study\Detect_VNese_Props\100_crops_plants_object_detection_25k_image_dataset\leaflogic_vn\data.yaml")
    
    if data_yaml_path.exists():
        try:
            with open(data_yaml_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            print(f"✓ data.yaml loaded successfully")
            print(f"  - Number of classes: {data.get('nc', 'N/A')}")
            print(f"  - Train path: {data.get('train', 'N/A')}")
            print(f"  - Val path: {data.get('val', 'N/A')}")
            
            # Check if required fields exist
            required_fields = ['train', 'val', 'nc', 'names']
            for field in required_fields:
                if field not in data:
                    print(f"✗ Missing required field: {field}")
                    all_good = False
            
            # Check if dataset paths exist
            dataset_root = Path(data.get('path', ''))
            if dataset_root.exists():
                train_path = dataset_root / data.get('train', '')
                val_path = dataset_root / data.get('val', '')
                
                print(f"\n{check_mark(train_path.exists())} Train images folder: {train_path}")
                print(f"{check_mark(val_path.exists())} Val images folder: {val_path}")
                
                if train_path.exists():
                    train_images = list(train_path.glob('*.jpg')) + list(train_path.glob('*.png'))
                    print(f"  - Training images found: {len(train_images)}")
                
                if val_path.exists():
                    val_images = list(val_path.glob('*.jpg')) + list(val_path.glob('*.png'))
                    print(f"  - Validation images found: {len(val_images)}")
            else:
                print(f"✗ Dataset root not found: {dataset_root}")
                all_good = False
                
        except Exception as e:
            print(f"✗ Error reading data.yaml: {e}")
            all_good = False
    else:
        print(f"✗ data.yaml not found")
        all_good = False
    
    # 3. Check Python environment
    print_section("3. PYTHON ENVIRONMENT")
    
    print(f"✓ Python version: {sys.version}")
    print(f"✓ Python executable: {sys.executable}")
    
    # Check if venv exists
    venv_path = Path(r"d:\Study\Detect_VNese_Props\ultralytics\.venv")
    venv_exists = (venv_path / "Scripts" / "python.exe").exists()
    
    print(f"{check_mark(venv_exists)} Virtual environment: {venv_path}")
    if not venv_exists:
        print("  ⚠ Will be created automatically on first run")
    
    # 4. Check GPU availability
    print_section("4. GPU AVAILABILITY")
    
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        print(f"{check_mark(cuda_available)} CUDA available: {cuda_available}")
        
        if cuda_available:
            print(f"  - GPU name: {torch.cuda.get_device_name(0)}")
            print(f"  - GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        else:
            print("  ⚠ Training will use CPU (slower)")
    except ImportError:
        print("⚠ PyTorch not installed yet (will be installed by launcher)")
    
    # 5. Check disk space
    print_section("5. DISK SPACE")
    
    try:
        import shutil
        disk_usage = shutil.disk_usage("d:\\")
        free_gb = disk_usage.free / (1024**3)
        
        print(f"  - Free space on D: drive: {free_gb:.2f} GB")
        
        if free_gb < 10:
            print("  ⚠ Warning: Less than 10 GB free space")
            all_good = False
        else:
            print("  ✓ Sufficient disk space")
    except:
        print("  ⚠ Could not check disk space")
    
    # 6. Summary
    print_section("SUMMARY")
    
    if all_good:
        print("✅ All checks passed! Ready to start training.")
        print("\nTo start training, run:")
        print("  python d:\\Study\\Detect_VNese_Props\\launch_training.py")
        print("\nOr double-click:")
        print("  START_TRAINING.bat")
        return 0
    else:
        print("❌ Some checks failed. Please fix the issues above before training.")
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        print("\n" + "="*70 + "\n")
        sys.exit(exit_code)
    except Exception as e:
        print(f"\n❌ Error during pre-flight check: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
