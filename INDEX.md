# 📚 YOLO TRAINING AUTOMATION - FILE INDEX

## 🚀 Quick Start Files

### For End Users (Just Want to Train):
1. **START_TRAINING.bat** - Double-click to start training (Windows)
2. **START_TRAINING.ps1** - PowerShell launcher
3. **QUICK_START.md** - Quick reference card (1 page)

### Pre-Flight:
4. **check_config.py** - Validate configuration before training

---

## 📖 Documentation Files

### Essential Reading:
5. **README.md** - Complete documentation with all features
6. **DEMO_GUIDE.md** - Step-by-step guide with examples
7. **THIS FILE** (INDEX.md) - File navigation guide

---

## 🔧 Core System Files

### Main Components:
8. **launch_training.py** - Main launcher with auto-setup
9. **train_vn_yolo26.py** - Training script with monitoring
10. **create_stop_flag.py** - Emergency stop utility

---

## 📁 Configuration Files

11. **data.yaml** - Dataset configuration
    - Location: `100_crops_plants_object_detection_25k_image_dataset/leaflogic_vn/data.yaml`
    - Contains: 74 crop classes, dataset paths

---

## 🗂️ Directory Structure

```
d:\Study\Detect_VNese_Props\
│
├── 📄 START_TRAINING.bat          ← CLICK HERE TO START
├── 📄 START_TRAINING.ps1
├── 📄 QUICK_START.md              ← READ THIS FIRST
├── 📄 README.md                   ← FULL DOCUMENTATION
├── 📄 DEMO_GUIDE.md
├── 📄 INDEX.md                    ← YOU ARE HERE
│
├── 🔧 launch_training.py          ← Main launcher
├── 🔧 train_vn_yolo26.py          ← Training engine
├── 🔧 check_config.py             ← Pre-flight check
├── 🔧 create_stop_flag.py         ← Stop utility
│
├── 📂 ultralytics\
│   ├── 📂 .venv\                  ← Virtual environment (auto-created)
│   └── 📂 runs\detect\            ← Training results
│       └── 📂 train\              ← Latest run
│           ├── 📂 weights\
│           │   ├── best.pt       ← Your trained model! ⭐
│           │   └── last.pt       ← Resume checkpoint
│           ├── 📂 checkpoints\    ← Rotation checkpoints
│           ├── results.csv       ← Training metrics
│           ├── results.png       ← Training curves
│           └── confusion_matrix.png
│
└── 📂 100_crops_plants_object_detection_25k_image_dataset\
    └── 📂 leaflogic_vn\
        └── data.yaml              ← Dataset config
```

---

## 🎯 Usage Roadmap

### For First-Time Users:
```
1. Read: QUICK_START.md (5 min)
2. Run: check_config.py
3. Start: START_TRAINING.bat
4. Wait: Training completes (3-8 hours)
5. Use: runs/detect/train/weights/best.pt
```

### For Advanced Users:
```
1. Read: README.md (full features)
2. Modify: train_vn_yolo26.py (TrainingConfig)
3. Run: launch_training.py
4. Monitor: Terminal logs + TensorBoard
5. Resume: Automatic checkpoint detection
```

### For Troubleshooting:
```
1. Run: check_config.py
2. Read: README.md → "Xử Lý Lỗi" section
3. Check: Terminal error messages
4. Reset: Delete .venv and runs folders
5. Retry: Run launcher again
```

---

## 📝 File Descriptions

### START_TRAINING.bat
- **Purpose**: One-click training start
- **Use When**: You want easiest method
- **Requirements**: Python installed in PATH

### launch_training.py
- **Purpose**: Automated environment setup + training
- **Features**: Auto-install, error recovery, resume detection
- **Use When**: First run or after system changes

### train_vn_yolo26.py
- **Purpose**: Core training logic
- **Features**: Checkpoint rotation, monitoring, graceful stop
- **Modify**: To change training parameters

### check_config.py
- **Purpose**: Validate setup before training
- **Output**: Status of all requirements
- **Use When**: Before first run, after config changes

### data.yaml
- **Purpose**: Dataset configuration
- **Contains**: Paths, class names, metadata
- **Location**: Separate from training files

---

## 🔑 Key Concepts

### Checkpoint Rotation
- Saves every 3 epochs
- Keeps only 3 latest
- Auto-deletes old ones
- Saves disk space

### Graceful Stop
- Ctrl+C: Finish current epoch
- Stop flag: Stop at next checkpoint
- Always saves before exit
- Resume from exact point

### Auto Resume
- Detects last checkpoint
- Asks user to resume
- Continues from last epoch
- No progress lost

### Error Recovery
- Auto-installs missing packages
- Retries on temporary errors
- Logs all issues
- Max 3 retry attempts

---

## 🎓 Learning Path

### Beginner → Intermediate:
1. ✅ Run with default settings
2. ✅ Monitor training progress
3. ✅ Use best.pt for predictions
4. 📚 Learn to modify batch size
5. 📚 Experiment with model sizes
6. 📚 Understand checkpoint system

### Intermediate → Advanced:
1. 📚 Modify training parameters
2. 📚 Use TensorBoard monitoring
3. 📚 Implement custom callbacks
4. 🔬 Fine-tune hyperparameters
5. 🔬 Multi-GPU training
6. 🔬 Custom data augmentation

---

## 📊 Metrics Guide

### Training Metrics:
- **box_loss**: Bounding box localization loss
- **cls_loss**: Classification loss
- **dfl_loss**: Distribution focal loss

### Validation Metrics:
- **Precision**: Correct detections / All detections
- **Recall**: Correct detections / All ground truth
- **mAP50**: Mean average precision at IoU 0.5
- **mAP50-95**: mAP averaged over IoU 0.5-0.95

---

## 🆘 Emergency Procedures

### Training Frozen?
```bash
1. Ctrl+C to stop
2. Check GPU with: nvidia-smi
3. Check disk space
4. Resume training
```

### GPU Out of Memory?
```python
1. Edit train_vn_yolo26.py
2. BATCH_SIZE = 8  # reduce
3. Run launcher again
```

### Lost Checkpoint?
```bash
1. Check: ultralytics/runs/detect/train/weights/
2. Look for: last.pt or checkpoint_epoch_*.pt
3. Manually resume if needed
```

### Need to Reset?
```powershell
Remove-Item -Recurse .venv, runs
python launch_training.py
```

---

## 📚 Additional Resources

### Official YOLO Documentation:
- https://docs.ultralytics.com/

### PyTorch Documentation:
- https://pytorch.org/docs/

### Local Files:
- README.md - Complete feature guide
- DEMO_GUIDE.md - Step-by-step examples
- QUICK_START.md - Quick reference

---

## 🎯 Success Checklist

Before Training:
- [ ] Read QUICK_START.md
- [ ] Run check_config.py
- [ ] Verify GPU available
- [ ] Check disk space (>10GB)
- [ ] Dataset paths correct

During Training:
- [ ] Monitor epoch progress
- [ ] Watch loss decrease
- [ ] Verify checkpoints save
- [ ] Check GPU utilization

After Training:
- [ ] Locate best.pt
- [ ] Review results.csv
- [ ] Check confusion matrix
- [ ] Backup best model
- [ ] Test predictions

---

## 📞 Quick Help

| Issue | Solution File | Section |
|-------|---------------|---------|
| How to start? | QUICK_START.md | "START TRAINING" |
| Config error? | check_config.py | Run this script |
| GPU memory? | README.md | "Xử Lý Lỗi" |
| Stop training? | QUICK_START.md | "STOP TRAINING" |
| Resume? | QUICK_START.md | "RESUME TRAINING" |
| Find results? | QUICK_START.md | "VIEW RESULTS" |
| Modify params? | README.md | "Cấu Hình" |

---

**Navigation Tips:**
- 🚀 = Action required
- 📄 = Documentation
- 🔧 = System file (don't modify unless needed)
- 📂 = Directory
- ⭐ = Important output file

**Start Here:** 
1. QUICK_START.md (read first)
2. START_TRAINING.bat (run this)
3. Wait for training
4. Get best.pt file
5. Done! 🎉

---

*Last Updated: 2026-02-23*
*Version: 1.0*
