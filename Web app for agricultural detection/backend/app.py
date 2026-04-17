"""
Flask backend — Vietnamese agricultural product detection via YOLO11n + HuggingFace.

HTTP endpoints:
  GET  /health
  POST /api/v1/detect/image
  POST /api/v1/detect/video
  GET  /api/v1/metadata/classes
  GET  /api/v1/sessions
  GET  /api/v1/sessions/<session_id>

Native WebSocket (flask-sock):
  WS   /api/v1/detect/realtime
  client → binary JPEG bytes (one frame per message)
  server → JSON string (RealtimeDetectionResult)

Cấu hình (biến môi trường):
  YOLO_MODEL_PATH  — đường dẫn tới .pt file (tự tìm nếu không đặt)
  HF_TOKEN         — HuggingFace token (tùy chọn)
"""

import json
import os
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

# Load .env file nếu có (trước khi import detection)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sock import Sock

from detection import YOLOHFDetector, resolve_detector
from sessions import store as session_store

# ──────────────────────────────────────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
sock = Sock(app)

# ──────────────────────────────────────────────────────────────────────────────
# Load YOLO+HF detector at startup
# ──────────────────────────────────────────────────────────────────────────────

_start_time = time.time()
_detector: YOLOHFDetector | None = None
_detector_error: str = ""

try:
    _detector = resolve_detector()
    print(f"\n{'='*60}")
    print(f"[backend] YOLO+HF detector loaded successfully.")
    print(f"[backend] Model path: {_detector.model_path}")
    print(f"[backend] Mapped classes: {len(_detector.classes)}")
    print(f"[backend] Sample classes: {_detector.classes[:10]}")
    print(f"{'='*60}\n")
except Exception as exc:
    _detector_error = str(exc)
    print(f"[backend] ✗ FATAL: Could not init YOLO detector — {exc}")
    traceback.print_exc()
    print("[backend] All detection endpoints will return 503 until restart.")


# ──────────────────────────────────────────────────────────────────────────────
# HTTP routes
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return jsonify({
        "status":        "ok" if _detector else "error",
        "model_loaded":  _detector is not None,
        "model_path":    _detector.model_path if _detector else "",
        "model_error":   _detector_error,
        "classes_count": len(_detector.classes) if _detector else 0,
        "class_sample":  _detector.classes[:10] if _detector else [],
        "version":       "3.0.0",
        "uptime_seconds": round(time.time() - _start_time, 1),
    })


def _require_detector():
    if _detector is None:
        return jsonify({"error": f"YOLO detector not loaded: {_detector_error}"}), 503
    return None, None


@app.post("/api/v1/detect/image")
def detect_image():
    err, code = _require_detector()
    if err:
        return err, code

    if "file" not in request.files:
        return jsonify({"error": "No 'file' field in request"}), 400

    file    = request.files["file"]
    conf    = float(request.form.get("conf",    0.25))
    iou     = float(request.form.get("iou",     0.50))
    max_det = int(request.form.get("max_det",   100))

    image_bytes = file.read()
    if not image_bytes:
        return jsonify({"error": "Empty file"}), 400

    session_id = session_store.create_session("image")

    try:
        result = _detector.detect_image(
            image_bytes,
            conf=conf, iou=iou, max_det=max_det,
            session_id=session_id,
        )
    except Exception as exc:
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500

    unique_classes = list({o["class_name"] for o in result["objects"]})
    session_store.update_session(session_id, {
        "objects_count":  len(result["objects"]),
        "unique_classes": unique_classes,
    })
    return jsonify(result)


@app.post("/api/v1/detect/video")
def detect_video():
    err, code = _require_detector()
    if err:
        return err, code

    if "file" not in request.files:
        return jsonify({"error": "No 'file' field in request"}), 400

    file  = request.files["file"]
    conf  = float(request.form.get("conf", 0.25))
    iou   = float(request.form.get("iou",  0.50))

    video_bytes = file.read()
    if not video_bytes:
        return jsonify({"error": "Empty file"}), 400

    session_id = session_store.create_session("video")

    try:
        result = _detector.detect_video(
            video_bytes, conf=conf, iou=iou, session_id=session_id,
        )
    except Exception as exc:
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500

    all_classes: set = set()
    total_objects = 0
    for frame in result.get("frames", []):
        for obj in frame.get("objects", []):
            all_classes.add(obj["class_name"])
            total_objects += 1

    session_store.update_session(session_id, {
        "objects_count":    total_objects,
        "unique_classes":   list(all_classes),
        "duration_seconds": result.get("duration_seconds"),
    })
    return jsonify(result)


@app.get("/api/v1/metadata/classes")
def get_classes():
    classes = _detector.classes if _detector else []
    return jsonify({"classes": classes, "count": len(classes)})


@app.get("/api/v1/sessions")
def list_sessions():
    return jsonify(session_store.list_sessions())


@app.get("/api/v1/sessions/<session_id>")
def get_session(session_id: str):
    s = session_store.get_session(session_id)
    if s is None:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(s)


# ──────────────────────────────────────────────────────────────────────────────
# Native WebSocket — realtime detection
# ──────────────────────────────────────────────────────────────────────────────

@sock.route("/api/v1/detect/realtime")
def realtime(ws):
    session_id = session_store.create_session("realtime")
    frame_id   = 0

    ws.send(json.dumps({
        "type":          "connected",
        "session_id":    session_id,
        "model_loaded":  _detector is not None,
        "classes_count": len(_detector.classes) if _detector else 0,
    }))

    try:
        while True:
            data = ws.receive()
            if data is None:
                break

            if _detector is None:
                ws.send(json.dumps({
                    "frame_id": frame_id, "objects": [],
                    "inference_time_ms": 0.0, "fps": 0.0,
                    "error": f"YOLO detector not loaded: {_detector_error}",
                }))
                frame_id += 1
                continue

            frame_bytes = (data if isinstance(data, (bytes, bytearray))
                           else data.encode())
            try:
                result = _detector.detect_frame(bytes(frame_bytes), frame_id=frame_id)
            except Exception as exc:
                traceback.print_exc()
                ws.send(json.dumps({
                    "frame_id": frame_id, "objects": [],
                    "inference_time_ms": 0.0, "fps": 0.0,
                    "error": str(exc),
                }))
                frame_id += 1
                continue

            ws.send(json.dumps(result))
            frame_id += 1

    except Exception:
        pass
    finally:
        print(f"[ws] session {session_id} closed after {frame_id} frames")


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("[backend] Starting on http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=False)
