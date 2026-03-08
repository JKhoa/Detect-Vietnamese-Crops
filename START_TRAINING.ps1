# ===============================================================
# YOLO Training Automation - Quick Start Script
# ===============================================================
# This script launches the automated training system
# ===============================================================

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "  YOLO TRAINING AUTOMATION - VIETNAMESE CROPS DATASET" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: Python not found in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ and add it to PATH" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""
Write-Host "Starting automated training launcher..." -ForegroundColor Yellow
Write-Host ""

# Launch the training automation
python "d:\Study\Detect_VNese_Props\launch_training.py"

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor Green
    Write-Host "  ✅ TRAINING COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "===============================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor Red
    Write-Host "  ❌ TRAINING FAILED (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "===============================================================" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
