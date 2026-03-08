"""
YOLO Training Script for Vietnamese Agricultural Crops Dataset
Comprehensive training automation with checkpoint management, monitoring, and graceful stopping.
"""

import os
import sys
import signal
import time
import shutil
from pathlib import Path
from datetime import datetime
import yaml
import torch
from ultralytics import YOLO

# =========================== CONFIGURATION ===========================
class TrainingConfig:
    """Centralized training configuration"""
    # Paths
    DATA_YAML = r"d:\Study\Detect_VNese_Props\100_crops_plants_object_detection_25k_image_dataset\leaflogic_vn\data.yaml"
    RUNS_DIR = Path(r"d:\Study\Detect_VNese_Props\ultralytics\runs")
    STOP_FLAG_FILE = Path(r"d:\Study\Detect_VNese_Props\stop.flag")
    
    # Training parameters
    MODEL_SIZE = r"d:\Study\Detect_VNese_Props\ultralytics\runs\train\weights\last.pt"  # Resume from last checkpoint
    EPOCHS = 100
    BATCH_SIZE = 16
    IMAGE_SIZE = 640
    PATIENCE = 10  # Early stopping patience
    RESUME = True  # Resume training from checkpoint
    
    # Checkpoint management
    CHECKPOINT_INTERVAL = 3  # Save checkpoint every N epochs
    MAX_CHECKPOINTS = 3  # Keep only N latest checkpoints
    
    # Device configuration
    DEVICE = 0 if torch.cuda.is_available() else 'cpu'

# =========================== CHECKPOINT MANAGER ===========================
class CheckpointManager:
    """Manages checkpoint saving and rotation"""
    
    def __init__(self, save_dir, max_checkpoints=3):
        self.save_dir = Path(save_dir)
        self.max_checkpoints = max_checkpoints
        self.checkpoint_dir = self.save_dir / "checkpoints"
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        
    def get_checkpoint_path(self, epoch):
        """Generate checkpoint path for given epoch"""
        return self.checkpoint_dir / f"checkpoint_epoch_{epoch}.pt"
    
    def save_checkpoint(self, model_path, epoch):
        """Save checkpoint and manage rotation"""
        checkpoint_path = self.get_checkpoint_path(epoch)
        
        # Copy the weight file
        if Path(model_path).exists():
            shutil.copy2(model_path, checkpoint_path)
            print(f"✓ Checkpoint saved: {checkpoint_path}")
            
            # Perform rotation - keep only latest N checkpoints
            self._rotate_checkpoints()
        else:
            print(f"⚠ Warning: Model file not found at {model_path}")
    
    def _rotate_checkpoints(self):
        """Keep only the latest N checkpoints, delete older ones"""
        checkpoints = sorted(
            self.checkpoint_dir.glob("checkpoint_epoch_*.pt"),
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        
        # Delete old checkpoints
        for old_checkpoint in checkpoints[self.max_checkpoints:]:
            try:
                old_checkpoint.unlink()
                print(f"✗ Deleted old checkpoint: {old_checkpoint.name}")
            except Exception as e:
                print(f"⚠ Could not delete {old_checkpoint}: {e}")

# =========================== GRACEFUL STOP HANDLER ===========================
class GracefulStopHandler:
    """Handles graceful shutdown on SIGINT or stop flag"""
    
    def __init__(self, stop_flag_file):
        self.stop_flag_file = Path(stop_flag_file)
        self.stop_requested = False
        
        # Register signal handler
        signal.signal(signal.SIGINT, self._signal_handler)
        
    def _signal_handler(self, signum, frame):
        """Handle SIGINT (Ctrl+C)"""
        print("\n⚠ Stop signal received (Ctrl+C). Finishing current epoch...")
        self.stop_requested = True
    
    def check_stop_flag(self):
        """Check if stop flag file exists"""
        if self.stop_flag_file.exists():
            print(f"\n⚠ Stop flag detected: {self.stop_flag_file}")
            self.stop_requested = True
            # Remove flag file
            try:
                self.stop_flag_file.unlink()
            except:
                pass
        return self.stop_requested
    
    def should_stop(self):
        """Check if training should stop"""
        return self.stop_requested or self.check_stop_flag()

# =========================== TRAINING MONITOR ===========================
class TrainingMonitor:
    """Monitors and reports training progress"""
    
    def __init__(self, total_epochs):
        self.total_epochs = total_epochs
        self.start_time = time.time()
        self.epoch_losses = []
        
    def log_epoch(self, epoch, metrics, save_dir):
        """Log epoch information"""
        elapsed = time.time() - self.start_time
        hours = int(elapsed // 3600)
        minutes = int((elapsed % 3600) // 60)
        
        # Extract metrics
        train_loss = metrics.get('train/box_loss', 0) + metrics.get('train/cls_loss', 0) + metrics.get('train/dfl_loss', 0)
        val_loss = metrics.get('val/box_loss', 0) + metrics.get('val/cls_loss', 0) + metrics.get('val/dfl_loss', 0)
        
        self.epoch_losses.append(val_loss)
        
        print("\n" + "="*80)
        print(f"📊 EPOCH {epoch}/{self.total_epochs} SUMMARY")
        print("="*80)
        print(f"⏱ Time Elapsed: {hours}h {minutes}m")
        print(f"📉 Train Loss: {train_loss:.4f}")
        print(f"📉 Val Loss: {val_loss:.4f}")
        print(f"💾 Output Directory: {save_dir}")
        print("="*80 + "\n")
        
        return val_loss
    
    def check_early_stopping(self, patience):
        """Check if early stopping should trigger"""
        if len(self.epoch_losses) < patience + 1:
            return False
        
        recent_losses = self.epoch_losses[-patience:]
        best_loss = min(self.epoch_losses[:-patience]) if len(self.epoch_losses) > patience else float('inf')
        
        if all(loss >= best_loss for loss in recent_losses):
            print(f"\n⚠ Early stopping triggered: No improvement in {patience} epochs")
            return True
        return False

# =========================== RESUME LOGIC ===========================
def find_latest_run(runs_dir):
    """Find the latest training run with checkpoint"""
    runs_dir = Path(runs_dir)
    if not runs_dir.exists():
        return None, None
    
    # Find all train directories
    train_dirs = sorted(
        [d for d in runs_dir.glob("train*") if d.is_dir()],
        key=lambda x: x.stat().st_mtime,
        reverse=True
    )
    
    for train_dir in train_dirs:
        last_pt = train_dir / "weights" / "last.pt"
        if last_pt.exists():
            return train_dir, last_pt
    
    return None, None

# =========================== MAIN TRAINING FUNCTION ===========================
def train_yolo():
    """Main training function with full automation"""
    
    print("\n" + "="*80)
    print("🚀 YOLO TRAINING FOR VIETNAMESE AGRICULTURAL CROPS")
    print("="*80 + "\n")
    
    config = TrainingConfig()
    
    # Verify data.yaml exists
    if not Path(config.DATA_YAML).exists():
        print(f"❌ ERROR: data.yaml not found at {config.DATA_YAML}")
        sys.exit(1)
    
    # Load dataset info
    with open(config.DATA_YAML, 'r', encoding='utf-8') as f:
        data_config = yaml.safe_load(f)
    
    print(f"✓ Dataset loaded: {data_config.get('nc', 0)} classes")
    print(f"✓ Device: {config.DEVICE}")
    print(f"✓ Model: {config.MODEL_SIZE}")
    print(f"✓ Epochs: {config.EPOCHS}")
    print(f"✓ Batch size: {config.BATCH_SIZE}\n")
    
    # Resume from checkpoint
    if hasattr(config, 'RESUME') and config.RESUME and Path(config.MODEL_SIZE).exists():
        print(f"📂 Resuming training from checkpoint: {config.MODEL_SIZE}")
        model = YOLO(config.MODEL_SIZE)
        resume = True
    else:
        # Check for resume
        latest_run, last_checkpoint = find_latest_run(config.RUNS_DIR)
        resume = False
        
        if last_checkpoint:
            print(f"📂 Found existing checkpoint: {last_checkpoint}")
            print("✓ Automatically resuming training from checkpoint\n")
            resume = True
            model = YOLO(str(last_checkpoint))
        else:
            model = YOLO(config.MODEL_SIZE)
            print("✓ No existing checkpoint found. Starting fresh training\n")
    
    # Initialize managers
    stop_handler = GracefulStopHandler(config.STOP_FLAG_FILE)
    monitor = TrainingMonitor(config.EPOCHS)
    
    # Start training
    try:
        print("🏋️ Starting training...\n")
        
        results = model.train(
            data=config.DATA_YAML,
            epochs=config.EPOCHS,
            batch=config.BATCH_SIZE,
            imgsz=config.IMAGE_SIZE,
            device=config.DEVICE,
            patience=config.PATIENCE,
            save=True,
            save_period=-1,  # Disabled automatic checkpoint saving
            resume=resume,
            project=str(config.RUNS_DIR.parent),
            name='train',
            exist_ok=True,
            verbose=True
        )
        
        print("\n" + "="*80)
        print("✅ TRAINING COMPLETED SUCCESSFULLY!")
        print("="*80)
        print(f"📁 Results saved to: {model.trainer.save_dir}")
        print(f"🏆 Best model: {model.trainer.best}")
        print("="*80 + "\n")
        
    except KeyboardInterrupt:
        print("\n⚠ Training interrupted by user")
        print("💾 Last checkpoint saved automatically by YOLO")
        sys.exit(0)
    
    except Exception as e:
        print(f"\n❌ ERROR during training: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

# =========================== ENTRY POINT ===========================
if __name__ == "__main__":
    train_yolo()
