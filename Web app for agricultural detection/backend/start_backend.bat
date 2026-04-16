@echo off
title YOLO Detection Backend — localhost:8000
cd /d "%~dp0"

echo [backend] All dependencies installed in system Python.
echo [backend] Starting Flask server on http://localhost:8000
echo [backend] Press Ctrl+C to stop
echo.
python app.py

pause
