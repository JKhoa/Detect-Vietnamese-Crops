"""
Flask backend for Vietnamese agricultural product detection.

HTTP endpoints:
  GET  /health
  POST /api/v1/detect/image
  POST /api/v1/detect/video
  GET  /api/v1/metadata/classes
  GET  /api/v1/sessions
  GET  /api/v1/sessions/<session_id>

Native WebSocket endpoint (flask-sock):
  WS   /api/v1/detect/realtime
  client → binary JPEG frame
  server → JSON string (RealtimeDetectionResult)
"""

import json
import time
import traceback
from datetime import datetime, timezone

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

try:
    _model_path = resolve_model_path()
    print(f"[backend] Loading model: {_model_path}")
    _detector = YOLODetector(_model_path)
    print(f"[backend] Model loaded — {len(_detector.classes)} classes")
except Exception as exc:
    _model_error = str(exc)
    print(f"[backend] WARNING: Could not load model — {exc}")
    traceback.print_exc()


# ──────────────────────────────────────────────────────────────────────────────
# HTTP routes
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": _detector is not None,
        "model_path": _model_path,
        "model_error": _model_error,
        "classes_count": len(_detector.classes) if _detector else 0,
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - _start_time, 1),
    })


@app.post("/api/v1/detect/image")
def detect_image():
    if _detector is None:
        return jsonify({"error": f"Model not loaded: {_model_error}"}), 503

    if "file" not in request.files:
        return jsonify({"error": "No file field in request"}), 400

    file = request.files["file"]
    conf = float(request.form.get("conf", 0.5))
    iou = float(request.form.get("iou", 0.45))
    max_det = int(request.form.get("max_det", 100))

    image_bytes = file.read()
    if not image_bytes:
        return jsonify({"error": "Empty file"}), 400

    session_id = session_store.create_session("image")

    try:
        result = _detector.detect_image(
            image_bytes, conf=conf, iou=iou, max_det=max_det, session_id=session_id
        )
    except Exception as exc:
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500

    unique_classes = list({o["class_name"] for o in result["objects"]})
    session_store.update_session(session_id, {
        "objects_count": len(result["objects"]),
        "unique_classes": unique_classes,
    })

    return jsonify(result)


@app.post("/api/v1/detect/video")
def detect_video():
    if _detector is None:
        return jsonify({"error": f"Model not loaded: {_model_error}"}), 503

    if "file" not in request.files:
        return jsonify({"error": "No file field in request"}), 400

    file = request.files["file"]
    conf = float(request.form.get("conf", 0.5))
    iou = float(request.form.get("iou", 0.45))

    video_bytes = file.read()
    if not video_bytes:
        return jsonify({"error": "Empty file"}), 400

    session_id = session_store.create_session("video")

    try:
        result = _detector.detect_video(
            video_bytes, conf=conf, iou=iou, session_id=session_id
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
        "objects_count": total_objects,
        "unique_classes": list(all_classes),
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
# Path: /api/v1/detect/realtime
#
# Protocol:
#   client → binary JPEG bytes  (one frame per message)
#   server → JSON text          (RealtimeDetectionResult)
# ──────────────────────────────────────────────────────────────────────────────

@sock.route("/api/v1/detect/realtime")
def realtime(ws):
    session_id = session_store.create_session("realtime")
    frame_id = 0

    # Notify client that the session is ready
    ws.send(json.dumps({
        "type": "connected",
        "session_id": session_id,
        "model_loaded": _detector is not None,
    }))

    try:
        while True:
            data = ws.receive()
            if data is None:
                break  # client disconnected

            if _detector is None:
                ws.send(json.dumps({
                    "frame_id": frame_id,
                    "objects": [],
                    "inference_time_ms": 0.0,
                    "fps": 0.0,
                    "error": f"Model not loaded: {_model_error}",
                }))
                frame_id += 1
                continue

            frame_bytes = data if isinstance(data, (bytes, bytearray)) else data.encode()

            try:
                result = _detector.detect_frame(bytes(frame_bytes), frame_id=frame_id)
            except Exception as exc:
                traceback.print_exc()
                ws.send(json.dumps({
                    "frame_id": frame_id,
                    "objects": [],
                    "inference_time_ms": 0.0,
                    "fps": 0.0,
                    "error": str(exc),
                }))
                frame_id += 1
                continue

            ws.send(json.dumps(result))
            frame_id += 1

    except Exception:
        pass  # connection closed abruptly
    finally:
        print(f"[ws] session {session_id} closed after {frame_id} frames")


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("[backend] Starting on http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=False)
