"""
Flask backend for Vietnamese agricultural product detection.

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

Startup validation
──────────────────
After loading the model, app.py validates classes_count == 74.
If a COCO 80-class model slips through (e.g. someone accidentally sets
YOLO_MODEL_PATH to yolo11n.pt), the server refuses to start unless
ALLOW_COCO_FALLBACK=true is set.  This prevents silent wrong-class inference.
"""

import json
import os
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sock import Sock

from detection import YOLODetector, resolve_model_path
from sessions import store as session_store

# ──────────────────────────────────────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
sock = Sock(app)

# ──────────────────────────────────────────────────────────────────────────────
# Load YOLO model at startup
# ──────────────────────────────────────────────────────────────────────────────

_start_time = time.time()
_detector: YOLODetector | None = None
_model_path: str = ""
_model_error: str = ""

_EXPECTED_CLASSES = 74   # LeafLogic-VN dataset

try:
    _model_path = resolve_model_path()
    print(f"\n{'='*60}")
    print(f"[backend] Loading model : {_model_path}")
    _detector = YOLODetector(_model_path)

    n = len(_detector.classes)
    print(f"[backend] classes_count : {n}")
    print(f"[backend] first 10 names: {_detector.classes[:10]}")
    print(f"[backend] last  5 names : {_detector.classes[-5:]}")
    print(f"{'='*60}\n")

    # ── Guard: block COCO model unless explicitly opted in ──────────────────
    allow_coco = os.getenv("ALLOW_COCO_FALLBACK", "").lower() in ("1", "true", "yes")
    if n != _EXPECTED_CLASSES and not allow_coco:
        raise RuntimeError(
            f"Model has {n} classes but expected {_EXPECTED_CLASSES}.\n"
            f"Model path: {_model_path}\n"
            f"This looks like a COCO/wrong model. "
            f"Set ALLOW_COCO_FALLBACK=true to override (not recommended for production)."
        )
    if n == _EXPECTED_CLASSES:
        print(f"[backend] ✓ Model validated: {n} agricultural classes.")
    else:
        print(f"[backend] ⚠ ALLOW_COCO_FALLBACK=true — running with {n}-class model.")

except Exception as exc:
    _model_error = str(exc)
    print(f"[backend] ✗ FATAL: Could not load model — {exc}")
    traceback.print_exc()
    print("[backend] All detection endpoints will return 503 until restart.")


# ──────────────────────────────────────────────────────────────────────────────
# HTTP routes
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    classes_count = len(_detector.classes) if _detector else 0
    # Include first 10 class names so frontend can verify without extra call
    class_sample = _detector.classes[:10] if _detector else []
    return jsonify({
        "status":        "ok" if _detector else "error",
        "model_loaded":  _detector is not None,
        "model_path":    _model_path,
        "model_error":   _model_error,
        "classes_count": classes_count,
        "class_sample":  class_sample,
        "version":       "1.0.0",
        "uptime_seconds": round(time.time() - _start_time, 1),
    })


def _require_model():
    """Return (None, None) if model OK, or (response, status_code) if not."""
    if _detector is None:
        return jsonify({"error": f"Model not loaded: {_model_error}"}), 503
    return None, None


@app.post("/api/v1/detect/image")
def detect_image():
    err, code = _require_model()
    if err:
        return err, code

    if "file" not in request.files:
        return jsonify({"error": "No 'file' field in request"}), 400

    file    = request.files["file"]
    conf    = float(request.form.get("conf",    0.25))   # default lowered
    iou     = float(request.form.get("iou",     0.50))
    max_det = int(request.form.get("max_det",   100))
    augment = request.form.get("augment", "false").lower() in ("1", "true")

    image_bytes = file.read()
    if not image_bytes:
        return jsonify({"error": "Empty file"}), 400

    session_id = session_store.create_session("image")

    try:
        result = _detector.detect_image(
            image_bytes, conf=conf, iou=iou,
            max_det=max_det, augment=augment,
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
    err, code = _require_model()
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
        "type":         "connected",
        "session_id":   session_id,
        "model_loaded": _detector is not None,
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
                    "error": f"Model not loaded: {_model_error}",
                }))
                frame_id += 1
                continue

            frame_bytes = (data if isinstance(data, (bytes, bytearray))
                           else data.encode())
            try:
                result = _detector.detect_frame(bytes(frame_bytes),
                                                 frame_id=frame_id)
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
