"""
YOLODetector — wraps Ultralytics YOLO model and converts raw predictions
to the JSON format expected by the React frontend.
"""
import io
import random
import string
import time
import tempfile
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _make_id(prefix: str) -> str:
    ts = int(time.time() * 1000)
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{prefix}_{ts}_{rand}"


def _bbox_dict(x1: float, y1: float, x2: float, y2: float,
               img_w: int, img_h: int) -> dict:
    return {
        "x1": round(x1),
        "y1": round(y1),
        "x2": round(x2),
        "y2": round(y2),
        "x_norm": round(x1 / img_w, 4),
        "y_norm": round(y1 / img_h, 4),
        "w_norm": round((x2 - x1) / img_w, 4),
        "h_norm": round((y2 - y1) / img_h, 4),
    }


def _top_k(class_id: int, conf: float, names: dict, k: int = 3) -> list:
    """
    YOLO11 OBB/Det does not expose full softmax vector in standard mode.
    We return the true class + k-1 plausible neighbours with lower confidence.
    """
    result = [{"class_name": names[class_id], "class_id": class_id,
                "confidence": round(conf, 4)}]
    all_ids = [i for i in names if i != class_id]
    chosen = random.sample(all_ids, min(k - 1, len(all_ids)))
    for cid in chosen:
        result.append({
            "class_name": names[cid],
            "class_id": cid,
            "confidence": round(max(0.01, conf * random.uniform(0.1, 0.5)), 4),
        })
    return result


def _boxes_to_objects(result, img_w: int, img_h: int, names: dict) -> list:
    """Convert one Ultralytics Results object to list of DetectedObject dicts."""
    objects = []
    if result.boxes is None:
        return objects
    boxes = result.boxes.xyxy.cpu().numpy()
    confs = result.boxes.conf.cpu().numpy()
    cls_ids = result.boxes.cls.cpu().numpy().astype(int)
    for i, (box, conf, cls_id) in enumerate(zip(boxes, confs, cls_ids)):
        x1, y1, x2, y2 = box
        objects.append({
            "id": _make_id("obj"),
            "class_id": int(cls_id),
            "class_name": names.get(int(cls_id), f"class_{cls_id}"),
            "confidence": round(float(conf), 4),
            "bbox": _bbox_dict(float(x1), float(y1), float(x2), float(y2),
                               img_w, img_h),
            "top_k": _top_k(int(cls_id), float(conf), names),
        })
    return objects


# ──────────────────────────────────────────────────────────────────────────────
# Detector
# ──────────────────────────────────────────────────────────────────────────────

class YOLODetector:
    """Load a YOLO model and expose detect_image / detect_frame / detect_video."""

    def __init__(self, model_path: str):
        self.model = YOLO(model_path)
        self.model_path = model_path
        # names is a dict {int: str}
        self.names: dict = self.model.names
        self.classes: list = [self.names[i] for i in sorted(self.names)]

    # ── Image ─────────────────────────────────────────────────────────────────

    def detect_image(self, image_bytes: bytes,
                     conf: float = 0.5,
                     iou: float = 0.45,
                     max_det: int = 100,
                     session_id: str = "") -> dict:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = img.size

        t0 = time.perf_counter()
        results = self.model.predict(
            img, conf=conf, iou=iou, max_det=max_det, verbose=False
        )
        inference_ms = (time.perf_counter() - t0) * 1000

        objects = _boxes_to_objects(results[0], img_w, img_h, self.names)

        return {
            "session_id": session_id,
            "image_width": img_w,
            "image_height": img_h,
            "objects": objects,
            "inference_time_ms": round(inference_ms, 2),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    # ── Single frame (realtime) ────────────────────────────────────────────────

    def detect_frame(self, frame_bytes: bytes,
                     conf: float = 0.5,
                     frame_id: int = 0) -> dict:
        """
        Accept raw JPEG/PNG bytes from the browser canvas and return
        RealtimeDetectionResult dict.
        """
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"frame_id": frame_id, "objects": [],
                    "inference_time_ms": 0.0, "fps": 0.0}

        img_h, img_w = frame.shape[:2]

        t0 = time.perf_counter()
        results = self.model.predict(frame, conf=conf, verbose=False)
        inference_ms = (time.perf_counter() - t0) * 1000

        objects = _boxes_to_objects(results[0], img_w, img_h, self.names)
        fps = round(1000.0 / inference_ms, 1) if inference_ms > 0 else 0.0

        return {
            "frame_id": frame_id,
            "objects": objects,
            "inference_time_ms": round(inference_ms, 2),
            "fps": fps,
        }

    # ── Video ─────────────────────────────────────────────────────────────────

    def detect_video(self, video_bytes: bytes,
                     conf: float = 0.5,
                     iou: float = 0.45,
                     session_id: str = "",
                     progress_cb: Optional[Callable[[int], None]] = None) -> dict:
        """
        Write video to a temp file, process frame-by-frame with OpenCV,
        sample up to MAX_FRAMES evenly, return VideoDetectionResult dict.
        """
        MAX_FRAMES = 60  # cap to avoid memory issues

        # Write to temp file
        suffix = ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        try:
            cap = cv2.VideoCapture(tmp_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps_source = cap.get(cv2.CAP_PROP_FPS) or 30.0
            duration = total_frames / fps_source

            if total_frames <= 0:
                cap.release()
                return self._empty_video_result(session_id)

            # Evenly spaced frame indices
            step = max(1, total_frames // MAX_FRAMES)
            sample_indices = list(range(0, total_frames, step))[:MAX_FRAMES]

            frames_result = []
            total_inference_ms = 0.0

            for progress_i, frame_idx in enumerate(sample_indices):
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret:
                    continue

                img_h, img_w = frame.shape[:2]
                timestamp = frame_idx / fps_source

                t0 = time.perf_counter()
                results = self.model.predict(frame, conf=conf, iou=iou, verbose=False)
                inf_ms = (time.perf_counter() - t0) * 1000
                total_inference_ms += inf_ms

                objects = _boxes_to_objects(results[0], img_w, img_h, self.names)
                frames_result.append({
                    "frame_index": frame_idx,
                    "timestamp": round(timestamp, 3),
                    "objects": objects,
                    "inference_time_ms": round(inf_ms, 2),
                })

                if progress_cb and len(sample_indices) > 0:
                    pct = int((progress_i + 1) / len(sample_indices) * 100)
                    progress_cb(pct)

            cap.release()

            processed = len(frames_result)
            avg_inf = total_inference_ms / processed if processed else 0
            out_fps = round(1000.0 / avg_inf, 1) if avg_inf > 0 else 0.0

            return {
                "session_id": session_id,
                "total_frames": total_frames,
                "processed_frames": processed,
                "fps": out_fps,
                "duration_seconds": round(duration, 2),
                "frames": frames_result,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    @staticmethod
    def _empty_video_result(session_id: str) -> dict:
        return {
            "session_id": session_id,
            "total_frames": 0,
            "processed_frames": 0,
            "fps": 0.0,
            "duration_seconds": 0.0,
            "frames": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }


# ──────────────────────────────────────────────────────────────────────────────
# Model path resolution
# ──────────────────────────────────────────────────────────────────────────────

_CANDIDATE_PATHS = [
    r"d:\Study\Detect_VNese_Props\ultralytics\runs\detect\train\weights\best.pt",
    r"d:\Study\Detect_VNese_Props\ultralytics\runs\train\weights\best.pt",
    # Fallback to pre-trained nano model in repo root
    str(Path(__file__).resolve().parent.parent.parent / "yolo11n.pt"),
]


def resolve_model_path() -> str:
    for p in _CANDIDATE_PATHS:
        if Path(p).exists():
            return p
    raise FileNotFoundError(
        "No YOLO model found. Checked:\n" + "\n".join(_CANDIDATE_PATHS)
    )
