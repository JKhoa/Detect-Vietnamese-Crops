# ⚡ QUICK REFERENCE CARD - YOLO Training Automation

## 🚀 START TRAINING

### Windows (Double-click):
```
START_TRAINING.bat
```

### Command Line:
```bash
python d:\Study\Detect_VNese_Props\launch_training.py
```

### PowerShell:
```powershell
.\START_TRAINING.ps1
```

---

## 🛑 STOP TRAINING SAFELY

### Method 1: Keyboard
```
Press Ctrl+C in terminal
```
→ Finishes current epoch, saves checkpoint, then exits

### Method 2: Stop Flag
```powershell
# Create stop flag
New-Item -Path "d:\Study\Detect_VNese_Props\stop.flag" -ItemType File
```
→ Will stop at next checkpoint

---

## 🔄 RESUME TRAINING

Just run the launcher again:
```bash
python d:\Study\Detect_VNese_Props\launch_training.py
```
→ Automatically detects last checkpoint and asks to resume

---

## 📊 VIEW RESULTS

### Results Location:
```
d:\Study\Detect_VNese_Props\ultralytics\runs\detect\train\
```

### Key Files:
- `weights/best.pt` - Best model
- `weights/last.pt` - Latest checkpoint
- `results.csv` - Training metrics
- `results.png` - Training curves
- `confusion_matrix.png` - Class confusion

---

## ⚙️ MODIFY SETTINGS

Edit `train_vn_yolo26.py` → `TrainingConfig` class:

```python
MODEL_SIZE = "yolo11n.pt"      # Model: n/s/m/l/x
EPOCHS = 100                   # Training epochs
BATCH_SIZE = 16                # Batch size
IMAGE_SIZE = 640               # Image size
PATIENCE = 10                  # Early stop patience
CHECKPOINT_INTERVAL = 3        # Save every N epochs
MAX_CHECKPOINTS = 3            # Keep N checkpoints
```

---

## 🐛 COMMON ISSUES

### CUDA Out of Memory
```python
# Reduce batch size in train_vn_yolo26.py
BATCH_SIZE = 8  # or 4
```

### Missing Package
```bash
# Activate venv
d:\Study\Detect_VNese_Props\ultralytics\.venv\Scripts\activate

# Install package
pip install package-name
```

### Reset Everything
```powershell
# Delete venv and runs
Remove-Item -Recurse -Force "d:\Study\Detect_VNese_Props\ultralytics\.venv"
Remove-Item -Recurse -Force "d:\Study\Detect_VNese_Props\ultralytics\runs"

# Run launcher again
python d:\Study\Detect_VNese_Props\launch_training.py
```

---

## 📈 MONITOR PROGRESS

### Real-time Logs:
Watch terminal output for epoch summaries

### TensorBoard:
```bash
# Activate venv
d:\Study\Detect_VNese_Props\ultralytics\.venv\Scripts\activate

# Launch TensorBoard
tensorboard --logdir=d:\Study\Detect_VNese_Props\ultralytics\runs\detect

# Open: http://localhost:6006
```

---

## ✅ PRE-FLIGHT CHECK

Before training:
```bash
python d:\Study\Detect_VNese_Props\check_config.py
```
→ Validates all configs, paths, and dependencies

---

## 📁 FILE STRUCTURE

```
d:\Study\Detect_VNese_Props\
├── START_TRAINING.bat          ← Double-click to start
├── launch_training.py          ← Main launcher
├── train_vn_yolo26.py         ← Training script
├── check_config.py            ← Pre-flight check
├── README.md                  ← Full documentation
│
└── ultralytics\
    ├── .venv\                 ← Virtual environment
    └── runs\detect\train\     ← Training results
```

---

## 💡 TIPS

1. **First Run**: Launcher creates venv and installs packages (10-15 min)
2. **GPU Required**: Training on CPU is very slow
3. **Batch Size**: Start with 16, reduce if GPU memory error
4. **Checkpoint**: Auto-saves every 3 epochs
5. **Backup**: Copy `best.pt` after successful training

---

## 🆘 HELP

Check full documentation:
```bash
d:\Study\Detect_VNese_Props\README.md
```

---

**Quick Start Checklist:**
- [ ] Run pre-flight check
- [ ] Verify GPU available
- [ ] Check dataset paths
- [ ] Start training
- [ ] Monitor progress
- [ ] Save best.pt

**Happy Training! 🎉**
