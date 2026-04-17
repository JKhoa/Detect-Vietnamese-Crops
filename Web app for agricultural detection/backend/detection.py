"""
YOLOHFDetector — YOLO11n local (offline) + HuggingFace free Inference API.

Thay thế GCVDetector (đã bị 403 do Google Cloud billing).

Pipeline:
  detect_image():
    YOLO11n → bboxes → crop từng bbox → HF classifier → Vietnamese class name

  detect_frame() [realtime WebSocket]:
    YOLO11n only (HF quá chậm cho realtime)

  detect_video():
    YOLO11n only per frame (giống detect_frame)

Env vars:
  YOLO_MODEL_PATH  — đường dẫn tới .pt file (mặc định: yolo11n.pt)
  HF_TOKEN         — HuggingFace token (tùy chọn, free tier không cần)
"""

import io
import os
import random
import string
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np
import requests as http_requests
from PIL import Image

# ──────────────────────────────────────────────────────────────────────────────
# HuggingFace free Inference API
# ──────────────────────────────────────────────────────────────────────────────

_HF_MODEL   = "dima806/fruits_vegetable_image_detection"
_HF_API_URL = f"https://api-inference.huggingface.co/models/{_HF_MODEL}"

# Mapping HF label → Vietnamese class name
_HF_TO_CLASS: dict[str, str] = {
    "Banana":        "chuoi",
    "Mango":         "xoai",
    "Dragon Fruit":  "thanh_long",
    "Dragonfruit":   "thanh_long",
    "Watermelon":    "dua_hau",
    "Orange":        "cam",
    "Tangerine":     "quit",
    "Mandarin":      "quit",
    "Guava":         "oi",
    "Longan":        "nhan",
    "Lychee":        "vai",
    "Rambutan":      "chom_chom",
    "Durian":        "sau_rieng",
    "Jackfruit":     "mit",
    "Papaya":        "du_du",
    "Coconut":       "dua",
    "Lime":          "chanh",
    "Lemon":         "chanh",
    "Mangosteen":    "mang_cut",
    "Soursop":       "mang_cau",
    "Custard Apple": "mang_cau",
    "Starfruit":     "khe",
    "Carambola":     "khe",
    "Star Fruit":    "khe",
    "Pomelo":        "buoi",
    "Grapefruit":    "buoi",
    "Tomato":        "ca_chua",
    "Passion Fruit": "chanh_day",
    "Pomegranate":   "luu",
    "Apple":         "tao",
    "Pineapple":     "dua",
    "Strawberry":    "dau",
    "Grape":         "nho",
    "Avocado":       "bo",
    "Cantaloupe":    "dua_luoi",
    "Honeydew":      "dua_luoi",
    "Sweet Potato":  "khoai_lang",
    "Pepper":        "ot",
    "Chili":         "ot",
    "Eggplant":      "ca_tim",
    "Corn":          "ngo",
    "Cucumber":      "dua_chuot",
    "Potato":        "khoai_tay",
    "Ginger":        "gung",
    "Garlic":        "toi",
    "Onion":         "hanh",
    "Carrot":        "ca_rot",
    "Broccoli":      "bong_cai_xanh",
    "Pear":          "le",
    "Peach":         "dao",
    "Plum":          "man",
    "Watermelon Rind": "dua_hau",
}

# Mapping COCO class name → Vietnamese (fallback khi HF không khả dụng)
_COCO_TO_CLASS: dict[str, str] = {
    "banana":    "chuoi",
    "orange":    "cam",
    "apple":     "tao",
    "carrot":    "ca_rot",
    "broccoli":  "bong_cai_xanh",
}

# ──────────────────────────────────────────────────────────────────────────────
# Per-class confidence post-filter (áp dụng cho cả YOLO + HF)
# ──────────────────────────────────────────────────────────────────────────────
_PER_CLASS_CONF: dict[str, float] = {
    "chuoi":     0.20,   # banana hay bị false-negative ở conf cao
    "dua":       0.40,   # coconut / pineapple dễ nhầm
    "mang_cau":  0.40,   # soursop
}
_DEFAULT_CONF = 0.25


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _make_id(prefix: str) -> str:
    ts   = int(time.time() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{prefix}_{ts}_{rand}"


def _bbox_dict(x1: float, y1: float, x2: float, y2: float,
               img_w: int, img_h: int) -> dict:
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


# ──────────────────────────────────────────────────────────────────────────────
# YOLOHFDetector
# ──────────────────────────────────────────────────────────────────────────────

class YOLOHFDetector:
    """
    2-tier detection pipeline:
      1. YOLO11n (local, offline) → bounding boxes
      2. HuggingFace free Inference API → crop classification → class name

    Fallback: nếu HF không khả dụng (loading / network error) → dùng COCO mapping.
    """

    def __init__(self, model_path: str, hf_token: str = ""):
        from ultralytics import YOLO
        self.model     = YOLO(model_path)
        self.hf_token  = hf_token
        self.model_path = model_path

        # Tập hợp tất cả class names đã biết
        all_vn = set(_HF_TO_CLASS.values()) | set(_COCO_TO_CLASS.values())
        # Thêm tên từ model.names nếu model đã train (74 lớp)
        if hasattr(self.model, "names"):
            for n in self.model.names.values():
                all_vn.add(n)
        self.classes: list[str] = sorted(all_vn)

        print(f"[YOLOHFDetector] Model: {model_path}")
        print(f"[YOLOHFDetector] Classes: {len(self.classes)}")
        print(f"[YOLOHFDetector] HF token: {'set' if hf_token else 'not set (free tier)'}")

    # ── Internal: crop JPEG bytes ─────────────────────────────────────────────

    def _crop_bytes(self, frame: np.ndarray,
                    x1: float, y1: float, x2: float, y2: float) -> bytes:
        """Crop vùng bbox từ numpy BGR image, encode thành JPEG bytes."""
        crop = frame[int(y1):int(y2), int(x1):int(x2)]
        if crop.size == 0:
            return b""
        _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
        return buf.tobytes()

    # ── Internal: HF classify crop ────────────────────────────────────────────

    def _classify_crop(self, crop_bytes: bytes) -> tuple[str, float]:
        """
        Gửi crop lên HF free API.
        Trả về (vietnamese_class_name, confidence) hoặc ("", 0.0) nếu lỗi.
        Tự retry 1 lần khi model đang loading (cold start ~20s).
        """
        if not crop_bytes:
            return "", 0.0

        headers: dict[str, str] = {"Content-Type": "image/jpeg"}
        if self.hf_token:
            headers["Authorization"] = f"Bearer {self.hf_token}"

        for attempt in range(2):
            try:
                resp = http_requests.post(
                    _HF_API_URL,
                    headers=headers,
                    data=crop_bytes,
                    timeout=30,
                )
                data = resp.json()

                # HF cold start: {"error": "Model ... is currently loading"}
                if (isinstance(data, dict)
                        and "error" in data
                        and "loading" in data.get("error", "").lower()):
                    if attempt == 0:
                        print("[YOLOHFDetector] HF model loading, waiting 8s...")
                        time.sleep(8)
                        continue
                    break  # vẫn loading sau retry → fallback

                # Kết quả thành công: [{label: "Banana", score: 0.98}, ...]
                if isinstance(data, list) and data:
                    top   = data[0]
                    label = top.get("label", "")
                    score = float(top.get("score", 0.0))
                    # Ánh xạ HF label → Vietnamese
                    class_name = _HF_TO_CLASS.get(
                        label,
                        label.lower().replace(" ", "_")
                    )
                    return class_name, score

            except Exception as e:
                print(f"[YOLOHFDetector] HF error (attempt {attempt}): {e}")
                break

        return "", 0.0

    # ── Public: detect image ──────────────────────────────────────────────────

    def detect_image(
        self,
        image_bytes: bytes,
        conf: float     = 0.25,
        iou: float      = 0.50,
        max_det: int    = 100,
        session_id: str = "",
        augment: bool   = False,
    ) -> dict:
        # 1. Decode image
        img         = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = img.size

        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            # Fallback: convert PIL → numpy BGR
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

        # 2. YOLO detection
        t0      = time.perf_counter()
        results = self.model(
            frame,
            conf=conf,
            iou=iou,
            max_det=max_det,
            verbose=False,
            augment=augment,
        )
        boxes = results[0].boxes

        objects: list[dict] = []
        for i, box in enumerate(boxes):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            yolo_conf  = float(box.conf[0])
            coco_name  = results[0].names[int(box.cls[0])]

            # 3. Crop → HF classify
            crop_b          = self._crop_bytes(frame, x1, y1, x2, y2)
            hf_name, hf_conf = self._classify_crop(crop_b)

            # 4. Chọn class name: HF > YOLO trained name > COCO mapping
            if hf_name:
                class_name = hf_name
                confidence = max(yolo_conf, hf_conf)
            else:
                # Nếu model đã trained 74 lớp VN, dùng YOLO name trực tiếp
                if coco_name in self.classes:
                    class_name = coco_name
                else:
                    class_name = _COCO_TO_CLASS.get(coco_name, coco_name)
                confidence = yolo_conf

            # 5. Per-class confidence filter
            min_conf = _PER_CLASS_CONF.get(class_name, _DEFAULT_CONF)
            if confidence < min_conf:
                continue

            class_id = (
                self.classes.index(class_name)
                if class_name in self.classes else i
            )

            objects.append({
                "id":         _make_id("obj"),
                "class_id":   class_id,
                "class_name": class_name,
                "confidence": round(confidence, 4),
                "bbox":       _bbox_dict(x1, y1, x2, y2, img_w, img_h),
                "top_k": [
                    {
                        "class_name": class_name,
                        "class_id":   class_id,
                        "confidence": round(confidence, 4),
                    }
                ],
            })

        inference_ms = (time.perf_counter() - t0) * 1000
        return {
            "session_id":        session_id,
            "image_width":       img_w,
            "image_height":      img_h,
            "objects":           objects,
            "inference_time_ms": round(inference_ms, 2),
            "created_at":        datetime.now(timezone.utc).isoformat(),
        }

    # ── Public: detect frame (realtime WebSocket — YOLO only) ─────────────────

    def detect_frame(
        self,
        frame_bytes: bytes,
        conf: float   = 0.25,
        iou: float    = 0.50,
        frame_id: int = 0,
    ) -> dict:
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"frame_id": frame_id, "objects": [],
                    "inference_time_ms": 0.0, "fps": 0.0}

        img_h, img_w = frame.shape[:2]

        t0      = time.perf_counter()
        results = self.model(frame, conf=conf, iou=iou, verbose=False)
        boxes   = results[0].boxes

        objects: list[dict] = []
        for i, box in enumerate(boxes):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            yolo_conf = float(box.conf[0])
            coco_name = results[0].names[int(box.cls[0])]

            if coco_name in self.classes:
                class_name = coco_name
            else:
                class_name = _COCO_TO_CLASS.get(coco_name, coco_name)

            # Per-class conf filter
            min_conf = _PER_CLASS_CONF.get(class_name, _DEFAULT_CONF)
            if yolo_conf < min_conf:
                continue

            class_id = (
                self.classes.index(class_name)
                if class_name in self.classes else i
            )

            objects.append({
                "id":         _make_id("obj"),
                "class_id":   class_id,
                "class_name": class_name,
                "confidence": round(yolo_conf, 4),
                "bbox":       _bbox_dict(x1, y1, x2, y2, img_w, img_h),
                "top_k": [{
                    "class_name": class_name,
                    "class_id":   class_id,
                    "confidence": round(yolo_conf, 4),
                }],
            })

        inference_ms = (time.perf_counter() - t0) * 1000
        fps = round(1000.0 / inference_ms, 1) if inference_ms > 0 else 0.0

        return {
            "frame_id":          frame_id,
            "objects":           objects,
            "inference_time_ms": round(inference_ms, 2),
            "fps":               fps,
        }

    # ── Public: detect video (YOLO only per frame) ────────────────────────────

    def detect_video(
        self,
        video_bytes: bytes,
        conf: float  = 0.25,
        iou: float   = 0.50,
        session_id: str = "",
        progress_cb: Optional[Callable[[int], None]] = None,
    ) -> dict:
        MAX_FRAMES = 50

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
            frames_result: list[dict] = []
            total_inf_ms  = 0.0

            for prog_i, frame_idx in enumerate(sample_indices):
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret:
                    continue

                img_h, img_w = frame.shape[:2]
                timestamp    = frame_idx / fps_source

                t0      = time.perf_counter()
                results = self.model(frame, conf=conf, iou=iou, verbose=False)
                inf_ms  = (time.perf_counter() - t0) * 1000
                total_inf_ms += inf_ms

                boxes   = results[0].boxes
                objects: list[dict] = []

                for i, box in enumerate(boxes):
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    yolo_conf = float(box.conf[0])
                    coco_name = results[0].names[int(box.cls[0])]

                    if coco_name in self.classes:
                        class_name = coco_name
                    else:
                        class_name = _COCO_TO_CLASS.get(coco_name, coco_name)

                    min_conf = _PER_CLASS_CONF.get(class_name, _DEFAULT_CONF)
                    if yolo_conf < min_conf:
                        continue

                    class_id = (
                        self.classes.index(class_name)
                        if class_name in self.classes else i
                    )
                    objects.append({
                        "id":         _make_id("obj"),
                        "class_id":   class_id,
                        "class_name": class_name,
                        "confidence": round(yolo_conf, 4),
                        "bbox":       _bbox_dict(x1, y1, x2, y2, img_w, img_h),
                        "top_k": [{
                            "class_name": class_name,
                            "class_id":   class_id,
                            "confidence": round(yolo_conf, 4),
                        }],
                    })

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
# Factory: load detector từ env var
# ──────────────────────────────────────────────────────────────────────────────

def resolve_detector() -> "YOLOHFDetector":
    """
    Đọc YOLO_MODEL_PATH + HF_TOKEN từ env, trả về YOLOHFDetector đã init.
    Tự tìm best.pt → yolo11n.pt nếu YOLO_MODEL_PATH không đặt.
    """
    model_path_env = os.getenv("YOLO_MODEL_PATH", "").strip()

    if model_path_env:
        candidates = [model_path_env]
    else:
        # Tự khám phá
        base = Path(__file__).parent
        candidates = [
            # Custom trained 74-class model
            str(base.parent.parent.parent / "ultralytics" / "runs" / "detect" / "train" / "weights" / "best.pt"),
            r"c:\Users\Admin\Downloads\Study\Study\Detect_VNese_Props\ultralytics\runs\detect\train\weights\best.pt",
            r"d:\Study\Detect_VNese_Props\ultralytics\runs\detect\train\weights\best.pt",
            # COCO pretrained fallback
            str(base.parent.parent / "yolo11n.pt"),
            str(base.parent / "yolo11n.pt"),
            "yolo11n.pt",
        ]

    model_path = None
    for c in candidates:
        if Path(c).exists():
            model_path = c
            break

    if model_path is None:
        # ultralytics sẽ tự download yolo11n.pt nếu không tìm thấy
        model_path = "yolo11n.pt"
        print(f"[resolve_detector] No model found, using default '{model_path}' (will auto-download)")
    else:
        print(f"[resolve_detector] Found model: {model_path}")

    hf_token = os.getenv("HF_TOKEN", "").strip()
    return YOLOHFDetector(model_path=model_path, hf_token=hf_token)


# Backward-compat alias (app.py hiện tại import GCVDetector)
GCVDetector = YOLOHFDetector
