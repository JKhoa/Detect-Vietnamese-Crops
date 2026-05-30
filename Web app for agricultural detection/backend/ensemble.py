"""
EnsembleDetector — chạy nhiều YOLO models song song, merge bằng class-aware NMS.

Pipeline:
  Primary model   (best.pt - 103 classes VN custom)
  Secondary model (yolov8n-oiv7.pt - 601 classes, nhiều trái cây quốc tế)
  → gộp tất cả boxes, map tên class về VN slug
  → class-aware NMS (IoU > 0.55, giữ box confidence cao hơn)
  → trả về output format giống YOLOHFDetector.detect_image

Tích hợp: YOLOHFDetector subclass, override detect_image.
"""

import io
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from detection import (
    YOLOHFDetector,
    _HF_TO_CLASS,
    _COCO_TO_CLASS,
    _VN_DISPLAY,
    _vn_display,
    _bbox_dict,
    _make_id,
    _PER_CLASS_CONF,
)


def _iou(a: tuple, b: tuple) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    aarea = max(0.0, (ax2 - ax1) * (ay2 - ay1))
    barea = max(0.0, (bx2 - bx1) * (by2 - by1))
    union = aarea + barea - inter
    return inter / union if union > 0 else 0.0


def _nms_merge(detections: list[dict], iou_thr: float = 0.55) -> list[dict]:
    """
    Class-aware NMS cross-model.
    - Cùng class: IoU > iou_thr → giữ box conf cao hơn.
    - Khác class nhưng IoU > 0.85 (overlap rất lớn): cũng merge, giữ conf cao nhất.
    """
    if not detections:
        return []
    dets = sorted(detections, key=lambda d: d["confidence"], reverse=True)
    kept: list[dict] = []
    for d in dets:
        dbox = (d["_x1"], d["_y1"], d["_x2"], d["_y2"])
        drop = False
        for k in kept:
            kbox = (k["_x1"], k["_y1"], k["_x2"], k["_y2"])
            iou = _iou(dbox, kbox)
            if d["class_name"] == k["class_name"] and iou > iou_thr:
                drop = True
                break
            if iou > 0.85:
                drop = True
                break
        if not drop:
            kept.append(d)
    return kept


class EnsembleDetector(YOLOHFDetector):
    """
    Ensemble: primary YOLO (custom 103-class VN) + secondary YOLO (OIV7 601-class).
    Cả 2 chạy song song trên cùng ảnh, merge qua class-aware NMS.
    """

    def __init__(self, primary_path: str, secondary_paths: list[str] | str = "",
                 hf_token: str = ""):
        super().__init__(model_path=primary_path, hf_token=hf_token)

        # Chấp nhận cả str (1 model) lẫn list[str] (nhiều model) để tương thích cũ.
        if isinstance(secondary_paths, str):
            secondary_paths = [secondary_paths] if secondary_paths else []

        from ultralytics import YOLO
        self.secondaries: list[tuple[str, "YOLO"]] = []
        for sp in secondary_paths:
            if sp and Path(sp).exists():
                try:
                    m = YOLO(sp)
                    self.secondaries.append((Path(sp).name, m))
                    print(f"[EnsembleDetector] Secondary loaded: {sp} ({len(m.names)} classes)")
                except Exception as e:
                    print(f"[EnsembleDetector] Cannot load secondary {sp}: {e}")

        # Backward-compat: code cũ tham chiếu .secondary / .secondary_path
        self.secondary = self.secondaries[0][1] if self.secondaries else None
        self.secondary_path = self.secondaries[0][0] if self.secondaries else ""

        if self.secondaries:
            sec_names = " + ".join([name for name, _ in self.secondaries])
            self.model_path = f"{Path(primary_path).name} & {sec_names}"
        else:
            print("[EnsembleDetector] Không có secondary model — chỉ dùng primary.")

    def _map_any_name(self, raw: str) -> str:
        """Map tên class (từ bất cứ model nào) sang VN slug. '' nếu không phải nông sản.

        Xử lý cả OIV7 (601-class với hậu tố parens "(Plant)", "(Animal)"…),
        custom Vietnamese model, và COCO 80.
        """
        r = raw.lower().strip()
        if "(" in r:
            r = r.split("(")[0].strip()
        if " - " in r: r = r.split(" - ")[-1].strip()
        elif "-" in r and r.endswith("-"): r = r.split("-")[-2].strip()
        r = r.replace("-", " ").replace("_", " ")
        r = " ".join(r.split())
        if r == "apple fruit": r = "apple"
        if r == "pear fruit": r = "pear"
        if r == "avacado": r = "avocado"

        # 1. Mapping trực tiếp (đa số trường hợp)
        if r in _HF_TO_CLASS:
            return _HF_TO_CLASS[r]
        # 2. Bỏ tiền tố OIV7 phổ biến rồi thử lại
        for prefix in ("garden ", "common ", "winter ", "summer "):
            if r.startswith(prefix) and r[len(prefix):] in _HF_TO_CLASS:
                return _HF_TO_CLASS[r[len(prefix):]]
        # 3. COCO whitelist
        if raw in _COCO_TO_CLASS:
            return _COCO_TO_CLASS[raw]
        # 4. Generic OIV7 buckets — quá rộng, drop để tránh hiển thị "Trái cây/Rau"
        if r in {"fruit", "vegetable", "food", "plant", "houseplant", "flower"}:
            return ""
        # 5. Custom VN model: nếu đã có sẵn trong VN display table thì giữ
        if raw not in {"person", "car", "chair", "bottle", "vase", "dog", "cat"}:
            cleaned = r.replace(" ", "_")
            if cleaned in _VN_DISPLAY:
                return cleaned
        return ""

    def _run_model(self, model, frame: np.ndarray, conf: float, iou: float,
                   max_det: int, augment: bool, source_tag: str) -> list[dict]:
        """Chạy 1 model, trả về list dict với các field: _x1/_y1/_x2/_y2, class_name, confidence, raw_name, source."""
        try:
            results = model(frame, conf=conf, iou=iou, max_det=max_det,
                            agnostic_nms=False, verbose=False, augment=augment)
        except Exception as e:
            print(f"[EnsembleDetector] {source_tag} inference error: {e}")
            return []
        boxes = results[0].boxes
        out: list[dict] = []
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            c = float(box.conf[0])
            raw = results[0].names[int(box.cls[0])]
            vn = self._map_any_name(raw)
            if not vn:
                continue
            out.append({
                "_x1": x1, "_y1": y1, "_x2": x2, "_y2": y2,
                "class_name": vn,
                "confidence": c,
                "raw_name": raw,
                "source": source_tag,
            })
        return out

    def detect_image(
        self,
        image_bytes: bytes,
        conf: float     = 0.25,
        iou: float      = 0.50,
        max_det: int    = 100,
        session_id: str = "",
        augment: bool   = False,
        model_target: str = "ensemble"
    ) -> dict:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = img.size
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

        t0 = time.perf_counter()

        if model_target == "ensemble":
            dets_p = self._run_model(self.model, frame, conf, iou, max_det, augment, "primary")
            sec_conf = max(0.15, conf * 0.7)
            dets_s: list[dict] = []
            
            # Chọn model lớn nhất trong secondaries (x > s > n)
            best_sm = None
            best_tag = ""
            for tag, sm in self.secondaries:
                if "x" in tag:
                    best_sm, best_tag = sm, tag
                    break
                elif "s" in tag and not best_sm:
                    best_sm, best_tag = sm, tag
                elif not best_sm:
                    best_sm, best_tag = sm, tag

            if best_sm:
                dets_s += self._run_model(best_sm, frame, sec_conf, iou, max_det, augment, f"sec:{best_tag}")
            
            combined = dets_p + dets_s
        elif model_target == "primary":
            combined = self._run_model(self.model, frame, conf, iou, max_det, augment, "primary")
        else:
            # Tìm model cụ thể trong secondaries
            sm_target = next((sm for tag, sm in self.secondaries if model_target in tag), None)
            if sm_target:
                combined = self._run_model(sm_target, frame, conf, iou, max_det, augment, f"sec:{model_target}")
            else:
                combined = self._run_model(self.model, frame, conf, iou, max_det, augment, "primary")

        # Auto-retry nếu tất cả rỗng — hạ conf xuống đáy
        if not combined and conf > 0.05:
            print("[EnsembleDetector] Empty — retry at conf=0.05")
            if model_target == "ensemble":
                dets_p = self._run_model(self.model, frame, 0.05, iou, max_det, augment, "primary")
                dets_s = []
                if best_sm:
                    dets_s += self._run_model(best_sm, frame, 0.05, iou, max_det, augment, f"sec:{best_tag}")
                combined = dets_p + dets_s
            elif model_target == "primary":
                combined = self._run_model(self.model, frame, 0.05, iou, max_det, augment, "primary")
            else:
                sm_target = next((sm for tag, sm in self.secondaries if model_target in tag), None)
                if sm_target:
                    combined = self._run_model(sm_target, frame, 0.05, iou, max_det, augment, f"sec:{model_target}")
                else:
                    combined = self._run_model(self.model, frame, 0.05, iou, max_det, augment, "primary")

        merged = _nms_merge(combined, iou_thr=0.55)

        # Per-class confidence floor (tôn trọng slider user nhưng cho phép pass nếu đạt pc)
        user_floor = max(0.05, float(conf))
        objects: list[dict] = []
        for i, d in enumerate(merged):
            pc = _PER_CLASS_CONF.get(d["class_name"])
            min_conf = min(user_floor, pc) if pc else user_floor
            if d["confidence"] < min_conf:
                continue
            class_id = (self.classes.index(d["class_name"])
                        if d["class_name"] in self.classes else i)
            x1, y1, x2, y2 = d["_x1"], d["_y1"], d["_x2"], d["_y2"]
            objects.append({
                "id":           _make_id("obj"),
                "class_id":     class_id,
                "class_name":   d["class_name"],
                "display_name": _vn_display(d["class_name"]),
                "confidence":   round(d["confidence"], 4),
                "bbox":         _bbox_dict(x1, y1, x2, y2, img_w, img_h),
                "source":       d["source"],
                "top_k": [{
                    "class_name":   d["class_name"],
                    "display_name": _vn_display(d["class_name"]),
                    "class_id":     class_id,
                    "confidence":   round(d["confidence"], 4),
                }],
            })

        # Fallback HF whole-image khi không có box nào
        if not objects:
            print("[EnsembleDetector] No ensemble detections — HF whole-image fallback")
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            full_bytes = buf.tobytes()
            want_k = 1 if max_det == 1 else 3
            hf_cands = self._classify_crop(full_bytes, top_k=want_k)
            accept = 0.05 if max_det == 1 else 0.15
            for name, sc in hf_cands:
                if not name or sc < accept:
                    continue
                cid = self.classes.index(name) if name in self.classes else 0
                top_k_list = [{
                    "class_name":   n,
                    "display_name": _vn_display(n),
                    "class_id":     self.classes.index(n) if n in self.classes else 0,
                    "confidence":   round(c, 4),
                } for n, c in hf_cands[:3]]
                objects.append({
                    "id":           _make_id("obj"),
                    "class_id":     cid,
                    "class_name":   name,
                    "display_name": _vn_display(name),
                    "confidence":   round(sc, 4),
                    "bbox":         _bbox_dict(0, 0, img_w, img_h, img_w, img_h),
                    "source":       "hf_fallback",
                    "top_k":        top_k_list,
                })

        inference_ms = (time.perf_counter() - t0) * 1000
        print(f"[EnsembleDetector] primary={len(dets_p)} secondary={len(dets_s)} "
              f"merged={len(merged)} final={len(objects)} in {inference_ms:.0f}ms")

        return {
            "session_id":        session_id,
            "image_width":       img_w,
            "image_height":      img_h,
            "objects":           objects,
            "inference_time_ms": round(inference_ms, 2),
            "created_at":        datetime.now(timezone.utc).isoformat(),
        }

    def _detect_frame_array(self, frame: np.ndarray, conf: float, iou: float, max_det: int = 300, model_target: str = "ensemble") -> tuple[list[dict], float]:
        """Override _detect_frame_array to use ensemble logic on video frames."""
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        res = self.detect_image(buf.tobytes(), conf=conf, iou=iou, max_det=max_det, augment=False, model_target=model_target)
        return res["objects"], res["inference_time_ms"]


def resolve_ensemble_detector() -> EnsembleDetector:
    """Factory tương tự resolve_detector nhưng dùng EnsembleDetector.

    Env vars:
      YOLO_MODEL_PATH        — primary .pt
      YOLO_SECONDARY_PATHS   — list secondary, ngăn bằng dấu ; (Windows) hoặc :
      YOLO_SECONDARY_PATH    — (legacy) 1 secondary duy nhất
    """
    import os
    primary_env    = os.getenv("YOLO_MODEL_PATH", "").strip()
    secondaries_env = os.getenv("YOLO_SECONDARY_PATHS", "").strip()
    secondary_env  = os.getenv("YOLO_SECONDARY_PATH", "").strip()

    base = Path(__file__).parent
    primary_candidates = [primary_env] if primary_env else [
        str(base / "models" / "yolov8s-world.pt"),
        str(base.parent.parent.parent / "ultralytics" / "runs" / "detect" / "train" / "weights" / "best.pt"),
        str(base.parent.parent / "runs" / "detect" / "crowded_cpu_fix2" / "weights" / "best.pt"),
        str(base.parent.parent / "yolo11n.pt"),
        "yolo11n.pt",
    ]

    # Tự khám phá: ưu tiên model lớn hơn (s > n) khi cùng dataset.
    if secondaries_env:
        sep = ";" if ";" in secondaries_env else ":"
        secondary_candidates = [s.strip() for s in secondaries_env.split(sep) if s.strip()]
    elif secondary_env:
        secondary_candidates = [secondary_env]
    else:
        # Nhiều OIV7 size khác nhau → chỉ giữ bản lớn nhất (x > s > n) vì cùng dataset.
        oiv7_candidates = [
            str(base / "models" / "yolov8x-oiv7.pt"),
            str(base / "models" / "yolov8s-oiv7.pt"),
            str(base / "models" / "yolov8n-oiv7.pt"),
        ]
        secondary_candidates = []
        for c in oiv7_candidates:
            if Path(c).exists():
                secondary_candidates.append(c)

    primary = next((c for c in primary_candidates if c and Path(c).exists()), "yolo11n.pt")

    # Giữ TẤT CẢ secondary tồn tại (không chỉ cái đầu) — nhiều model = nhiều coverage
    seen: set[str] = set()
    secondaries: list[str] = []
    for c in secondary_candidates:
        if c and Path(c).exists() and c not in seen:
            seen.add(c)
            secondaries.append(c)

    hf_token = os.getenv("HF_TOKEN", "").strip()
    return EnsembleDetector(primary_path=primary, secondary_paths=secondaries, hf_token=hf_token)
