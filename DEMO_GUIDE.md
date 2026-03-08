# 🎬 DEMO SCRIPT - How to Use YOLO Training Automation

## 📝 Step-by-Step Guide

### STEP 1: Pre-Flight Check (Optional but Recommended)
```powershell
cd d:\Study\Detect_VNese_Props
python check_config.py
```

**Expected Output:**
```
✓ Training script found
✓ Data YAML found
✓ Dataset root exists
✓ All checks passed!
```

---

### STEP 2: Start Training

**Option A - Double Click (Easiest)**
```
Navigate to: d:\Study\Detect_VNese_Props
Double-click: START_TRAINING.bat
```

**Option B - Command Line**
```powershell
cd d:\Study\Detect_VNese_Props
python launch_training.py
```

**What Happens:**
1. Checks if venv exists
2. Creates venv if needed (first time only)
3. Installs ultralytics and dependencies
4. Validates data.yaml
5. Checks for existing checkpoints
6. Starts training

**First Run Timeline:**
- Venv creation: ~2 minutes
- Package installation: ~5-10 minutes
- Training starts automatically

---

### STEP 3: During Training

**You'll See:**
```
================================================================================
📊 EPOCH 1/100 SUMMARY
================================================================================
⏱ Time Elapsed: 0h 5m
📉 Train Loss: 3.2456
📉 Val Loss: 3.1234
💾 Output Directory: d:\Study\Detect_VNese_Props\ultralytics\runs\detect\train
================================================================================
```

**Checkpoints Saved:**
- Every 3 epochs: `checkpoint_epoch_N.pt`
- After each epoch: `last.pt` (for resume)
- Best validation: `best.pt`

---

### STEP 4: Stopping Training

**Scenario A - Planned Stop (Ctrl+C)**
```
1. Press Ctrl+C in terminal
2. Wait for current epoch to finish
3. Checkpoint saved automatically
4. Training exits safely
```

**Scenario B - Emergency Stop (Stop Flag)**
```powershell
# In another terminal
New-Item -Path "d:\Study\Detect_VNese_Props\stop.flag" -ItemType File
```
Training will detect flag and stop safely.

---

### STEP 5: Resume Training

**Automatic Resume:**
```powershell
# Just run launcher again
python launch_training.py
```

**You'll Be Asked:**
```
📂 Found existing checkpoint: ...runs\detect\train\weights\last.pt
Resume training from this checkpoint? (y/n):
```

**Type 'y':**
- Loads checkpoint
- Continues from last epoch
- Preserves optimizer state
- No progress lost!

---

### STEP 6: View Results

**Navigate to:**
```
d:\Study\Detect_VNese_Props\ultralytics\runs\detect\train\
```

**Key Files:**
- `weights/best.pt` - Your trained model!
- `weights/last.pt` - Last checkpoint
- `results.csv` - All metrics (can open in Excel)
- `results.png` - Training curves graph
- `confusion_matrix.png` - Class performance

**Use Best Model:**
```python
from ultralytics import YOLO

# Load your trained model
model = YOLO('d:/Study/Detect_VNese_Props/ultralytics/runs/detect/train/weights/best.pt')

# Make predictions
results = model('path/to/image.jpg')
results.show()
```

---

## 🎯 Common Scenarios

### Scenario 1: First Time Training
```
1. Double-click START_TRAINING.bat
2. Wait for venv creation (2 min)
3. Wait for package installation (10 min)
4. Training starts automatically
5. Let it run overnight
6. Find best.pt in runs/detect/train/weights/
```

### Scenario 2: Continue After Interruption
```
1. Run launcher again
2. Type 'y' when asked to resume
3. Training continues from last epoch
```

### Scenario 3: Start Fresh Training
```
1. Delete or rename existing runs folder
2. Run launcher
3. Type 'n' when asked to resume
4. New training starts from epoch 1
```

### Scenario 4: GPU Out of Memory
```
1. Stop training (Ctrl+C)
2. Edit train_vn_yolo26.py
3. Change: BATCH_SIZE = 8 (or 4)
4. Run launcher again
5. Resume from checkpoint
```

### Scenario 5: Monitor Training Remotely
```bash
# On training machine
python launch_training.py > training.log 2>&1

# On remote machine
ssh user@training-machine
tail -f d:/Study/Detect_VNese_Props/training.log
```

---

## 📊 Expected Timeline

| Phase | Duration | What Happens |
|-------|----------|--------------|
| First Setup | 10-15 min | Venv + packages |
| Each Epoch | 2-5 min | Depends on GPU |
| 100 Epochs | 3-8 hours | Full training |
| Validation | 30 sec | After each epoch |
| Checkpoint Save | 5 sec | Every 3 epochs |

---

## 🎥 Demo Commands Sequence

```powershell
# Terminal Window 1 - Training
cd d:\Study\Detect_VNese_Props
python check_config.py
python launch_training.py
# Let it run...

# Terminal Window 2 - Monitor (optional)
cd d:\Study\Detect_VNese_Props\ultralytics\runs\detect\train
Get-Content results.csv -Wait

# Terminal Window 3 - TensorBoard (optional)
d:\Study\Detect_VNese_Props\ultralytics\.venv\Scripts\activate
tensorboard --logdir=d:\Study\Detect_VNese_Props\ultralytics\runs\detect
# Open: http://localhost:6006

# To Stop Gracefully
# In Terminal Window 1: Press Ctrl+C
```

---

## ✅ Success Indicators

**Training is Working:**
- ✓ Epoch numbers incrementing
- ✓ Loss values decreasing
- ✓ No error messages
- ✓ Checkpoint files appearing

**Training is Stuck:**
- ✗ Same epoch for >10 minutes
- ✗ Loss values not changing
- ✗ GPU utilization 0%
- ✗ Error messages in log

**Training Completed:**
- ✓ Final epoch summary shown
- ✓ "TRAINING COMPLETED SUCCESSFULLY!" message
- ✓ best.pt file exists
- ✓ results.png shows convergence

---

## 🎓 Training Tips

1. **First Run**: Use small epochs (10-20) to test
2. **GPU Check**: Run `nvidia-smi` to verify GPU usage
3. **Loss Values**: Should decrease over time
4. **Early Stop**: Triggers if no improvement in 10 epochs
5. **Best Model**: Always use best.pt, not last.pt
6. **Backup**: Copy best.pt after successful run

---

## 🔧 Troubleshooting Live

**Problem: "CUDA Out of Memory"**
```
Solution:
1. Ctrl+C to stop
2. Edit train_vn_yolo26.py → BATCH_SIZE = 8
3. Run launcher again
4. Resume training
```

**Problem: "No module named 'xxx'"**
```
Solution:
Launcher should auto-install. If not:
1. d:\Study\Detect_VNese_Props\ultralytics\.venv\Scripts\activate
2. pip install xxx
3. deactivate
4. Run launcher again
```

**Problem: "data.yaml not found"**
```
Solution:
1. Check path in train_vn_yolo26.py
2. Verify: d:\Study\...\leaflogic_vn\data.yaml exists
3. Run check_config.py to verify
```

**Problem: Training very slow**
```
Solution:
- Check GPU is being used (nvidia-smi)
- Reduce IMAGE_SIZE to 416
- Increase BATCH_SIZE if GPU has memory
```

---

**Ready to Start? Follow QUICK_START.md! 🚀**
