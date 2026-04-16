"""
GCVDetector — gọi Google Cloud Vision REST API và chuyển đổi kết quả
sang JSON contract mà React frontend mong đợi.

Thay thế hoàn toàn YOLODetector cũ. Không còn phụ thuộc vào ultralytics.

Luồng xử lý:
  image_bytes / frame_bytes / video_bytes
    → base64 encode
    → POST https://vision.googleapis.com/v1/images:annotate?key=...
    → localizedObjectAnnotations + labelAnnotations
    → map GCV names → Vietnamese class names
    → DetectedObject[] (cùng format cũ, frontend không cần thay đổi)
"""

import base64
import io
import json
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
# GCV endpoint
# ──────────────────────────────────────────────────────────────────────────────
GCV_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate"

# ──────────────────────────────────────────────────────────────────────────────
# Mapping: GCV object name (English) → Vietnamese class name (system)
# GCV OBJECT_LOCALIZATION trả về tên tiếng Anh viết hoa như "Mango", "Banana"
# ──────────────────────────────────────────────────────────────────────────────
_GCV_TO_CLASS: dict[str, str] = {
    # Trái cây nhiệt đới
    "Mango":             "xoai",
    "Pomelo":            "buoi",
    "Dragon fruit":      "thanh_long",
    "Dragonfruit":       "thanh_long",
    "Watermelon":        "dua_hau",
    "Banana":            "chuoi",
    "Orange":            "cam",
    "Tangerine":         "quit",
    "Mandarin orange":   "quit",
    "Mandarin":          "quit",
    "Guava":             "oi",
    "Longan":            "nhan",
    "Lychee":            "vai",
    "Litchi":            "vai",
    "Rambutan":          "chom_chom",
    "Durian":            "sau_rieng",
    "Jackfruit":         "mit",
    "Papaya":            "du_du",
    "Coconut":           "dua",
    "Lime":              "chanh",
    "Lemon":             "chanh",
    "Mangosteen":        "mang_cut",
    "Custard apple":     "na",
    "Sugar apple":       "na",
    "Tamarind":          "me",
    "Carambola":         "khe",
    "Star fruit":        "khe",
    "Starfruit":         "khe",
    "Tomato":            "ca_chua",
    "Sweet potato":      "khoai_lang",
    "Cantaloupe":        "dua_luoi",
    "Melon":             "dua_luoi",
    "Honeydew":          "dua_luoi",
    "Grapefruit":        "buoi",
    "Pineapple":         "dua",          # fallback nếu không tách được
    "Grape":             "nho",
    "Strawberry":        "dau",
    "Plum":              "man",
    "Peach":             "dao",
    "Apple":             "tao",
    "Pear":              "le",
    "Avocado":           "bo",
    "Passion fruit":     "chanh_day",
    "Sapodilla":         "hong_xiem",
    "Fig":               "sung",
    "Soursop":           "mang_cau",
    "Breadfruit":        "sa_ke",
    "Jujube":            "tao_ta",
    "Kumquat":           "quat",
    "Persimmon":         "hong",
    "Pomegranate":       "luu",
    "Pepper":            "ot",
    "Bell pepper":       "ot",
    "Chili pepper":      "ot",
    "Eggplant":          "ca_tim",
    "Bitter melon":      "kho_qua",
    "Bitter gourd":      "kho_qua",
    "Squash":            "bi",
    "Pumpkin":           "bi_do",
    "Corn":              "ngo",
    "Cucumber":          "dua_chuot",
    "Taro":              "khoai_mon",
    "Cassava":           "san",
    "Sweet corn":        "ngo",
    "Potato":            "khoai_tay",
    "Ginger":            "gung",
    "Garlic":            "toi",
    "Onion":             "hanh",
    "Chive":             "he",
    "Lemongrass":        "sa",
}

# ──────────────────────────────────────────────────────────────────────────────
# Helpers dùng chung
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
# GCVDetector
# ──────────────────────────────────────────────────────────────────────────────

class GCVDetector:
    """
    Gọi Google Cloud Vision API và trả về cùng format DetectedObject[]
    như YOLODetector cũ — frontend không cần thay đổi gì.

    Features sử dụng:
      • OBJECT_LOCALIZATION: Phát hiện + định vị vật thể (bounding box)
      • LABEL_DETECTION: Nhận diện nhãn bổ sung cho top_k

    Lưu ý:
      GCV trả về normalizedVertices [0.0, 1.0] thay vì pixel coords.
      Ta nhân với kích thước ảnh để có pixel coords như YOLO.
    """

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("GCV_API_KEY không được để trống.")
        self.api_key = api_key
        # Danh sách classes từ mapping (dùng cho /metadata/classes)
        self.classes: list[str] = sorted(set(_GCV_TO_CLASS.values()))
        print(f"[GCVDetector] API key: {api_key[:8]}...{api_key[-4:]}")
        print(f"[GCVDetector] Mapped classes: {len(self.classes)}")

    # ── Internal: gọi GCV API ─────────────────────────────────────────────────

    def _call_api(self, image_bytes: bytes) -> dict:
        """POST base64 image lên GCV và trả về raw JSON response."""
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "requests": [{
                "image": {"content": b64},
                "features": [
                    {"type": "OBJECT_LOCALIZATION", "maxResults": 50},
                    {"type": "LABEL_DETECTION",     "maxResults": 20},
                ],
            }]
        }
        try:
            resp = http_requests.post(
                f"{GCV_ENDPOINT}?key={self.api_key}",
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()
        except http_requests.HTTPError as e:
            body = ""
            try:
                body = e.response.text[:300]
            except Exception:
                pass
            raise RuntimeError(f"GCV API HTTP {e.response.status_code}: {body}") from e

    # ── Internal: map GCV response → DetectedObject[] ────────────────────────

    def _map_response(
        self,
        gcv_data: dict,
        img_w: int,
        img_h: int,
        conf_threshold: float = 0.0,
    ) -> list[dict]:
        """
        Chuyển localizedObjectAnnotations của GCV sang DetectedObject[].
        Nếu GCV trả lỗi hoặc không có kết quả → trả list rỗng.
        """
        response = gcv_data.get("responses", [{}])[0]
        if "error" in response:
            err = response["error"]
            raise RuntimeError(f"GCV error {err.get('code')}: {err.get('message')}")

        # Nhãn bổ sung từ LABEL_DETECTION (dùng cho top_k)
        label_annotations = response.get("labelAnnotations", [])
        extra_labels = [
            {
                "class_name": _GCV_TO_CLASS.get(la["description"], la["description"].lower()),
                "class_id": 0,
                "confidence": round(la["score"], 4),
            }
            for la in label_annotations[:5]
        ]

        objects: list[dict] = []
        localizations = response.get("localizedObjectAnnotations", [])

        for i, loc in enumerate(localizations):
            gcv_name = loc.get("name", "")
            score    = float(loc.get("score", 0.0))

            if score < conf_threshold:
                continue

            # Ánh xạ tên GCV → class name Việt
            class_name = _GCV_TO_CLASS.get(gcv_name)
            if class_name is None:
                # Fallback: lowercase + underscore
                class_name = gcv_name.lower().replace(" ", "_")

            class_id = (
                self.classes.index(class_name)
                if class_name in self.classes else i
            )

            # normalizedVertices → pixel bbox
            verts  = loc.get("boundingPoly", {}).get("normalizedVertices", [])
            xs     = [v.get("x", 0.0) for v in verts]
            ys     = [v.get("y", 0.0) for v in verts]
            x_min  = min(xs) if xs else 0.0
            x_max  = max(xs) if xs else 0.0
            y_min  = min(ys) if ys else 0.0
            y_max  = max(ys) if ys else 0.0

            x1 = x_min * img_w
            y1 = y_min * img_h
            x2 = x_max * img_w
            y2 = y_max * img_h

            objects.append({
                "id":          _make_id("obj"),
                "class_id":    class_id,
                "class_name":  class_name,
                "confidence":  round(score, 4),
                "bbox":        _bbox_dict(x1, y1, x2, y2, img_w, img_h),
                "top_k":       [
                    {
                        "class_name": class_name,
                        "class_id":   class_id,
                        "confidence": round(score, 4),
                    },
                    *extra_labels[:2],
                ],
            })

        return objects

    # ── Public: detect image ──────────────────────────────────────────────────

    def detect_image(
        self,
        image_bytes: bytes,
        conf: float    = 0.25,
        iou: float     = 0.50,   # không dùng (GCV xử lý NMS nội bộ)
        max_det: int   = 100,
        session_id: str = "",
        augment: bool  = False,  # không dùng
    ) -> dict:
        img     = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = img.size

        t0       = time.perf_counter()
        gcv_data = self._call_api(image_bytes)
        inference_ms = (time.perf_counter() - t0) * 1000

        objects = self._map_response(gcv_data, img_w, img_h, conf_threshold=conf)
        objects = objects[:max_det]

        return {
            "session_id":        session_id,
            "image_width":       img_w,
            "image_height":      img_h,
            "objects":           objects,
            "inference_time_ms": round(inference_ms, 2),
            "created_at":        datetime.now(timezone.utc).isoformat(),
        }

    # ── Public: detect frame (realtime WebSocket) ─────────────────────────────

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

        # Encode lại thành JPEG để gửi lên GCV
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        jpeg_bytes = buf.tobytes()

        t0       = time.perf_counter()
        gcv_data = self._call_api(jpeg_bytes)
        inference_ms = (time.perf_counter() - t0) * 1000

        objects = self._map_response(gcv_data, img_w, img_h, conf_threshold=conf)
        fps     = round(1000.0 / inference_ms, 1) if inference_ms > 0 else 0.0

        return {
            "frame_id":          frame_id,
            "objects":           objects,
            "inference_time_ms": round(inference_ms, 2),
            "fps":               fps,
        }

    # ── Public: detect video ──────────────────────────────────────────────────

    def detect_video(
        self,
        video_bytes: bytes,
        conf: float  = 0.25,
        iou: float   = 0.50,
        session_id: str = "",
        progress_cb: Optional[Callable[[int], None]] = None,
    ) -> dict:
        MAX_FRAMES = 20   # Giới hạn để tiết kiệm quota GCV

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

                _, buf       = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                jpeg_bytes   = buf.tobytes()

                t0       = time.perf_counter()
                gcv_data = self._call_api(jpeg_bytes)
                inf_ms   = (time.perf_counter() - t0) * 1000
                total_inf_ms += inf_ms

                objects = self._map_response(gcv_data, img_w, img_h, conf_threshold=conf)

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

def resolve_detector() -> "GCVDetector":
    """
    Đọc GCV_API_KEY từ biến môi trường và trả về GCVDetector đã khởi tạo.
    Raise ValueError nếu key chưa được cấu hình.
    """
    api_key = os.getenv("GCV_API_KEY", "").strip()
    if not api_key:
        raise ValueError(
            "GCV_API_KEY chưa được cấu hình.\n"
            "Fix: export GCV_API_KEY=<your-api-key> hoặc thêm vào file .env"
        )
    return GCVDetector(api_key)
