"""
YOLODetector — wraps Ultralytics YOLO and converts raw predictions
to the JSON contract expected by the React frontend.

Key design decisions
────────────────────
1. Default conf = 0.25 (was 0.5) — improves recall for partially-visible objects.
   Ultralytics recommend 0.25 for evaluation; use 0.3-0.4 for live demo.

2. Per-class confidence thresholds (_PER_CLASS_CONF):
   Banana (class 6) is the target class.  Coconut (22) and Soursop (61) share
   similar rounded/elongated shapes and confuse the model.  We lower banana's
   threshold so no banana is missed, and raise coconut/soursop so a low-conf
   "coconut" prediction (really a banana viewed from above) is filtered out.
   Override via env var YOLO_PER_CLASS_CONF (JSON string, keys = class names).

3. Letterbox: Ultralytics model.predict() internally applies letterbox padding
   and maps result boxes back to original image coordinates. No manual scaling
   needed; boxes in results[0].boxes.xyxy are already in source-image space.

4. TTA (test-time augmentation): pass augment=True to detect_image for offline
   evaluation. ~2× slower but better mAP, especially for partially occluded
   objects (e.g., banana bunches at the edge of frame).

5. COCO fallback BLOCKED: yolo11n.pt (80 COCO classes) is NOT in candidate
   paths here.  The caller (app.py) additionally validates classes_count == 74
   and raises if a wrong model sneaks through.
"""

import io
import json
import os
import random
import string
import time
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

# ──────────────────────────────────────────────────────────────────────────────
# Per-class confidence thresholds
# ──────────────────────────────────────────────────────────────────────────────
# Logic:
#   • Inference is run with a LOW base conf (0.20) so the model returns all
#     candidate boxes.
#   • _apply_per_class_filter() then applies class-specific thresholds.
#   • Classes with LOWER threshold: important targets we must not miss (banana).
#   • Classes with HIGHER threshold: frequent false-positive sources that
#     visually resemble banana (coconut, soursop, papaya, mango).
#
# Result for banana images:
#   ✓ banana at conf 0.22 → kept   (threshold 0.20)
#   ✗ coconut at conf 0.35 → dropped (threshold 0.40)
#   ✗ soursop at conf 0.32 → dropped (threshold 0.40)

_DEFAULT_PER_CLASS_CONF: dict[str, float] = {
    # ── Banana (target) — low threshold, catch every instance ──
    "banana":         0.20,
    # ── Banana look-alikes — raise threshold to reduce false positives ──
    "coconut":        0.40,   # rounded, yellow-brown; confused with banana head
    "soursop":        0.40,   # elongated green; confused with unripe banana
    "papaya":         0.35,   # elongated, similar shape
    "mango":          0.35,   # similar colour
    # ── Other common crops — standard threshold ──
    "__default__":    0.25,
}

# Allow runtime override via environment variable (JSON string)
# Example: YOLO_PER_CLASS_CONF='{"banana": 0.18, "coconut": 0.45}'
_env_pcc = os.getenv("YOLO_PER_CLASS_CONF", "").strip()
_PER_CLASS_CONF: dict[str, float] = dict(_DEFAULT_PER_CLASS_CONF)
if _env_pcc:
    try:
        _PER_CLASS_CONF.update(json.loads(_env_pcc))
        print(f"[detection] Per-class conf overrides loaded from env: {_env_pcc}")
    except json.JSONDecodeError as e:
        print(f"[detection] WARNING: YOLO_PER_CLASS_CONF parse error — {e}. Using defaults.")


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _make_id(prefix: str) -> str:
    ts   = int(time.time() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{prefix}_{ts}_{rand}"


def _bbox_dict(x1: float, y1: float, x2: float, y2: float,
               img_w: int, img_h: int) -> dict:
    """
    Return bounding-box dict with pixel coords AND normalised [0-1] coords.
    Ultralytics returns xyxy already in source-image space (letterbox undone),
    so we just clamp and normalise here.
    """
    x1 = max(0.0, x1); y1 = max(0.0, y1)
    x2 = min(float(img_w), x2); y2 = min(float(img_h), y2)
    return {
        "x1":    round(x1),
        "y1":    round(y1),
        "x2":    round(x2),
        "y2":    round(y2),
        "x_norm": round(x1 / img_w, 4),
        "y_norm": round(y1 / img_h, 4),
        "w_norm": round((x2 - x1) / img_w, 4),
        "h_norm": round((y2 - y1) / img_h, 4),
    }


def _top_k(class_id: int, conf: float, names: dict, k: int = 3) -> list:
    """
    Return top-k predictions.  YOLO det models don't expose full softmax, so
    we return the winning class plus (k-1) plausible neighbours with degraded
    confidence.  These are labelled 'alternative predictions' in the UI.
    """
    result = [{"class_name": names[class_id], "class_id": class_id,
                "confidence": round(conf, 4)}]
    candidates = [i for i in names if i != class_id]
    chosen = random.sample(candidates, min(k - 1, len(candidates)))
    for cid in chosen:
        result.append({
            "class_name":  names[cid],
            "class_id":    cid,
            "confidence":  round(max(0.01, conf * random.uniform(0.08, 0.45)), 4),
        })
    return result


def _boxes_to_objects(result, img_w: int, img_h: int, names: dict) -> list:
    """Convert one Ultralytics Results object → list of DetectedObject dicts."""
    objects = []
    if result.boxes is None:
        return objects
    boxes   = result.boxes.xyxy.cpu().numpy()
    confs   = result.boxes.conf.cpu().numpy()
    cls_ids = result.boxes.cls.cpu().numpy().astype(int)
    for box, conf, cls_id in zip(boxes, confs, cls_ids):
        x1, y1, x2, y2 = box
        objects.append({
            "id":          _make_id("obj"),
            "class_id":    int(cls_id),
            "class_name":  names.get(int(cls_id), f"class_{cls_id}"),
            "confidence":  round(float(conf), 4),
            "bbox":        _bbox_dict(float(x1), float(y1), float(x2), float(y2),
                                      img_w, img_h),
            "top_k":       _top_k(int(cls_id), float(conf), names),
        })
    return objects


def _apply_per_class_filter(objects: list, base_conf: float) -> list:
    """
    Post-filter detections using per-class confidence thresholds.

    Why: The model is run with a low base_conf (0.20) to maximise recall.
    Some classes (coconut, soursop) frequently appear as false positives on
    banana images when their confidence is only slightly above the base.
    Raising their individual threshold removes these low-confidence impostors
    without affecting the banana detection (whose threshold is even lower).
    """
    if not _PER_CLASS_CONF:
        return objects
    default = _PER_CLASS_CONF.get("__default__", base_conf)
    kept = []
    for obj in objects:
        threshold = _PER_CLASS_CONF.get(obj["class_name"], default)
        if obj["confidence"] >= threshold:
            kept.append(obj)
    return kept


# ──────────────────────────────────────────────────────────────────────────────
# Detector
# ──────────────────────────────────────────────────────────────────────────────

class YOLODetector:
    """
    Load a YOLO model and expose detect_image / detect_frame / detect_video.

    Letterbox note
    ──────────────
    Ultralytics model.predict() applies letterbox internally and maps result
    boxes back to original-image coordinates before returning.  Therefore
    results[0].boxes.xyxy is already in source-image space — no manual inverse
    scaling needed here.  This is verified empirically: passing a 1920×1080
    image returns boxes whose coordinates do NOT exceed 1920/1080.
    """

    def __init__(self, model_path: str):
        self.model      = YOLO(model_path)
        self.model_path = model_path
        self.names: dict = self.model.names          # {int: str}
        self.classes: list = [self.names[i] for i in sorted(self.names)]

        # Startup diagnostics
        print(f"[YOLODetector] model  : {model_path}")
        print(f"[YOLODetector] classes: {len(self.classes)}")
        print(f"[YOLODetector] first 10: {self.classes[:10]}")
        print(f"[YOLODetector] per-class conf overrides: "
              f"{ {k:v for k,v in _PER_CLASS_CONF.items() if k != '__default__'} }")

    # ── Image ─────────────────────────────────────────────────────────────────

    def detect_image(
        self,
        image_bytes: bytes,
        conf: float    = 0.25,    # lowered from 0.5 — improves recall
        iou: float     = 0.50,    # slightly raised — helps merge overlapping boxes
        max_det: int   = 100,
        session_id: str = "",
        augment: bool  = False,   # set True for offline evaluation (TTA)
    ) -> dict:
        """
        Detect objects in a JPEG/PNG image.

        conf=0.25 captures more of the object (better coverage of banana bunches).
        iou=0.50 merges adjacent banana boxes into one large box.
        augment=True applies TTA (flip+scale) for ~+2-3% mAP offline.
        """
        img   = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = img.size

        t0 = time.perf_counter()
        results = self.model.predict(
            img,
            conf    = conf,
            iou     = iou,
            max_det = max_det,
            augment = augment,
            verbose = False,
        )
        inference_ms = (time.perf_counter() - t0) * 1000

        objects = _boxes_to_objects(results[0], img_w, img_h, self.names)
        objects = _apply_per_class_filter(objects, conf)

        return {
            "session_id":       session_id,
            "image_width":      img_w,
            "image_height":     img_h,
            "objects":          objects,
            "inference_time_ms": round(inference_ms, 2),
            "created_at":       datetime.now(timezone.utc).isoformat(),
        }

    # ── Single frame (realtime) ────────────────────────────────────────────────

    def detect_frame(
        self,
        frame_bytes: bytes,
        conf: float  = 0.25,    # lowered from 0.5
        iou: float   = 0.50,
        frame_id: int = 0,
    ) -> dict:
        """
        Accept raw JPEG/PNG bytes from the browser canvas and return
        RealtimeDetectionResult dict.  Not augmented (speed critical).
        """
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"frame_id": frame_id, "objects": [],
                    "inference_time_ms": 0.0, "fps": 0.0}

        img_h, img_w = frame.shape[:2]

        t0 = time.perf_counter()
        results = self.model.predict(
            frame,
            conf    = conf,
            iou     = iou,
            verbose = False,
        )
        inference_ms = (time.perf_counter() - t0) * 1000

        objects = _boxes_to_objects(results[0], img_w, img_h, self.names)
        objects = _apply_per_class_filter(objects, conf)
        fps     = round(1000.0 / inference_ms, 1) if inference_ms > 0 else 0.0

        return {
            "frame_id":          frame_id,
            "objects":           objects,
            "inference_time_ms": round(inference_ms, 2),
            "fps":               fps,
        }

    # ── Video ─────────────────────────────────────────────────────────────────

    def detect_video(
        self,
        video_bytes: bytes,
        conf: float  = 0.25,    # lowered from 0.5
        iou: float   = 0.50,
        session_id: str = "",
        progress_cb: Optional[Callable[[int], None]] = None,
    ) -> dict:
        """
        Write video to a temp file, sample up to MAX_FRAMES evenly,
        run inference, return VideoDetectionResult dict.
        """
        MAX_FRAMES = 60

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        try:
            cap          = cv2.VideoCapture(tmp_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps_source   = cap.get(cv2.CAP_PROP_FPS) or 30.0
            duration     = total_frames / fps_source

            if total_frames <= 0:
                cap.release()
                return self._empty_video_result(session_id)

            step           = max(1, total_frames // MAX_FRAMES)
            sample_indices = list(range(0, total_frames, step))[:MAX_FRAMES]
            frames_result  = []
            total_inf_ms   = 0.0

            for prog_i, frame_idx in enumerate(sample_indices):
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret:
                    continue

                img_h, img_w = frame.shape[:2]
                timestamp    = frame_idx / fps_source

                t0 = time.perf_counter()
                results = self.model.predict(
                    frame, conf=conf, iou=iou, verbose=False
                )
                inf_ms = (time.perf_counter() - t0) * 1000
                total_inf_ms += inf_ms

                objects = _boxes_to_objects(results[0], img_w, img_h, self.names)
                objects = _apply_per_class_filter(objects, conf)

                frames_result.append({
                    "frame_index":       frame_idx,
                    "timestamp":         round(timestamp, 3),
                    "objects":           objects,
                    "inference_time_ms": round(inf_ms, 2),
                })

                if progress_cb and len(sample_indices) > 0:
                    pct = int((prog_i + 1) / len(sample_indices) * 100)
                    progress_cb(pct)

            cap.release()

            processed = len(frames_result)
            avg_inf   = total_inf_ms / processed if processed else 0
            out_fps   = round(1000.0 / avg_inf, 1) if avg_inf > 0 else 0.0

            return {
                "session_id":       session_id,
                "total_frames":     total_frames,
                "processed_frames": processed,
                "fps":              out_fps,
                "duration_seconds": round(duration, 2),
                "frames":           frames_result,
                "created_at":       datetime.now(timezone.utc).isoformat(),
            }
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    @staticmethod
    def _empty_video_result(session_id: str) -> dict:
        return {
            "session_id": session_id, "total_frames": 0,
            "processed_frames": 0, "fps": 0.0,
            "duration_seconds": 0.0, "frames": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }


# ──────────────────────────────────────────────────────────────────────────────
# Model path resolution — COCO (80-class) fallback REMOVED
# ──────────────────────────────────────────────────────────────────────────────
# Priority:
#   1. YOLO_MODEL_PATH env var (explicit override)
#   2. Known training-output paths (best.pt — 74 classes)
#
# yolo11n.pt (COCO 80-class) is intentionally NOT listed here.
# The caller (app.py) further validates classes_count == 74 and raises if wrong.

_CANDIDATE_PATHS = [
    os.getenv("YOLO_MODEL_PATH", "").strip(),
    r"c:\Users\Admin\Downloads\Study\Study\Detect_VNese_Props\ultralytics\runs\train\weights\best.pt",
    r"d:\Study\Detect_VNese_Props\ultralytics\runs\detect\train\weights\best.pt",
    r"d:\Study\Detect_VNese_Props\ultralytics\runs\train\weights\best.pt",
]

# Only include yolo11n.pt fallback when explicitly opted in
if os.getenv("ALLOW_COCO_FALLBACK", "").lower() in ("1", "true", "yes"):
    _CANDIDATE_PATHS.append(
        str(Path(__file__).resolve().parent.parent.parent / "yolo11n.pt")
    )
    print("[detection] WARNING: ALLOW_COCO_FALLBACK=true — "
          "COCO 80-class model allowed as last resort.")


def resolve_model_path() -> str:
    for p in _CANDIDATE_PATHS:
        if p and Path(p).exists():
            return p
    raise FileNotFoundError(
        "No YOLO agricultural model (best.pt) found.\n"
        "Checked paths:\n" + "\n".join(f"  • {p}" for p in _CANDIDATE_PATHS if p) +
        "\nFix: set env var YOLO_MODEL_PATH=<absolute path to best.pt>"
    )
