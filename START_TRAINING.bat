@echo off
REM ===============================================================
REM YOLO Training Automation - Windows Batch Launcher
REM ===============================================================

echo.
echo ===============================================================
echo   YOLO TRAINING AUTOMATION - VIETNAMESE CROPS DATASET
echo ===============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found in PATH
    echo Please install Python 3.8+ and add it to PATH
    pause
    exit /b 1
)

echo [INFO] Python found
echo.
echo Starting automated training launcher...
echo.

REM Launch the training automation
python "d:\Study\Detect_VNese_Props\launch_training.py"

REM Check exit code
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===============================================================
    echo   TRAINING COMPLETED SUCCESSFULLY!
    echo ===============================================================
) else (
    echo.
    echo ===============================================================
    echo   TRAINING FAILED - Exit Code: %ERRORLEVEL%
    echo ===============================================================
)

echo.
pause
