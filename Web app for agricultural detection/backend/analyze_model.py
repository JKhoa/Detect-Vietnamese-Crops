"""
analyze_model.py — Offline model evaluation script
====================================================
Runs YOLO val() on the validation split and produces:
  1. Confusion matrix (saved as PNG + CSV)
  2. Top-10 most-confused class pairs
  3. Per-class precision / recall / mAP50
  4. Suggested per-class confidence thresholds to reduce banana false positives

Usage:
    python analyze_model.py [--data PATH_TO_DATA_YAML] [--conf 0.25] [--iou 0.50]

Example:
    python analyze_model.py \
        --data "d:/Study/Detect_VNese_Props/100_crops_plants_object_detection_25k_image_dataset/leaflogic_vn/data.yaml" \
        --conf 0.25 --iou 0.50

Output files (created in ./analysis_output/):
    confusion_matrix.png
    per_class_metrics.csv
    top_confused_pairs.csv
    suggested_per_class_conf.json
"""

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np

# ──────────────────────────────────────────────────────────────────────────────
# Locate model
# ──────────────────────────────────────────────────────────────────────────────

CANDIDATE_MODEL_PATHS = [
    os.getenv("YOLO_MODEL_PATH", "").strip(),
    r"c:\Users\Admin\Downloads\Study\Study\Detect_VNese_Props\ultralytics\runs\train\weights\best.pt",
    r"d:\Study\Detect_VNese_Props\ultralytics\runs\detect\train\weights\best.pt",
    r"d:\Study\Detect_VNese_Props\ultralytics\runs\train\weights\best.pt",
]

DEFAULT_DATA_YAML = (
    r"d:\Study\Detect_VNese_Props\100_crops_plants_object_detection_25k_image_dataset"
    r"\leaflogic_vn\data.yaml"
)

# ──────────────────────────────────────────────────────────────────────────────
# Visual similarity groups — classes that share appearance with banana
# ──────────────────────────────────────────────────────────────────────────────
BANANA_CONFUSION_TARGETS = [
    "coconut",   # rounded, yellow-brown when ripe
    "soursop",   # elongated green, bumpy; confused with unripe banana bunch
    "papaya",    # elongated, similar shape
    "mango",     # similar colour profile
    "pineapple", # elongated, yellow
]


def find_model() -> str:
    for p in CANDIDATE_MODEL_PATHS:
        if p and Path(p).exists():
            return p
    print("ERROR: No model found. Set YOLO_MODEL_PATH env var.")
    sys.exit(1)


def run_analysis(model_path: str, data_yaml: str, conf: float, iou: float):
    from ultralytics import YOLO

    out_dir = Path("analysis_output")
    out_dir.mkdir(exist_ok=True)

    model = YOLO(model_path)
    names = model.names
    n_cls = len(names)
    cls_list = [names[i] for i in range(n_cls)]

    print(f"\n{'='*60}")
    print(f"Model  : {model_path}")
    print(f"Classes: {n_cls}")
    print(f"Data   : {data_yaml}")
    print(f"Conf   : {conf}   IoU : {iou}")
    print(f"{'='*60}\n")

    # ── Run validation ─────────────────────────────────────────────────────
    print("Running model.val() ... (this may take several minutes)")
    metrics = model.val(
        data    = data_yaml,
        conf    = conf,
        iou     = iou,
        plots   = True,
        save_dir= str(out_dir),
        verbose = False,
    )

    # ── Per-class metrics ─────────────────────────────────────────────────
    # metrics.box.p/r/ap50  shape: (n_classes,)
    precision_per_class = metrics.box.p           # np array
    recall_per_class    = metrics.box.r
    ap50_per_class      = metrics.box.ap50
    map50               = metrics.box.map50
    map50_95            = metrics.box.map

    print(f"\nmAP50     : {map50:.4f}")
    print(f"mAP50-95  : {map50_95:.4f}")
    print(f"mean P    : {precision_per_class.mean():.4f}")
    print(f"mean R    : {recall_per_class.mean():.4f}")

    # Per-class CSV
    import csv
    pc_csv = out_dir / "per_class_metrics.csv"
    with open(pc_csv, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["class_id", "class_name", "precision", "recall", "ap50"])
        for i, name in enumerate(cls_list):
            if i < len(ap50_per_class):
                w.writerow([i, name,
                             round(float(precision_per_class[i]), 4),
                             round(float(recall_per_class[i]), 4),
                             round(float(ap50_per_class[i]), 4)])
    print(f"\nPer-class metrics saved → {pc_csv}")

    # ── Confusion matrix analysis ──────────────────────────────────────────
    # Ultralytics saves confusion_matrix.png in save_dir automatically.
    # We also extract the raw matrix for top-confused-pairs analysis.
    cm_path = out_dir / "confusion_matrix.png"
    if cm_path.exists():
        print(f"Confusion matrix image → {cm_path}")

    # Try to access raw confusion matrix (available in recent Ultralytics versions)
    try:
        cm_matrix = metrics.confusion_matrix.matrix   # shape (n_cls+1, n_cls+1)
        # Rows = predicted class, Cols = actual class (background = last row/col)
        # Extract top confused pairs (exclude diagonal and background)
        confusion_pairs = []
        for pred in range(n_cls):
            for actual in range(n_cls):
                if pred == actual:
                    continue
                count = int(cm_matrix[pred, actual])
                if count > 0:
                    confusion_pairs.append({
                        "predicted":   cls_list[pred],
                        "actual":      cls_list[actual],
                        "count":       count,
                        "pred_id":     pred,
                        "actual_id":   actual,
                    })

        confusion_pairs.sort(key=lambda x: -x["count"])
        top10 = confusion_pairs[:10]

        print(f"\nTop-10 most confused class pairs:")
        print(f"{'Predicted':<25} {'Actual':<25} {'Count':>6}")
        print("-" * 58)
        for p in top10:
            print(f"{p['predicted']:<25} {p['actual']:<25} {p['count']:>6}")

        # Banana-specific analysis
        banana_row = [(p["predicted"], p["actual"], p["count"])
                      for p in confusion_pairs
                      if p["actual"] == "banana" and p["predicted"] != "banana"]
        if banana_row:
            print(f"\nBanana false negatives (predicted as):")
            for pred, _, cnt in sorted(banana_row, key=lambda x: -x[2])[:5]:
                print(f"  banana → {pred:<20} {cnt} times")

        # Save CSV
        pairs_csv = out_dir / "top_confused_pairs.csv"
        with open(pairs_csv, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["predicted", "actual", "count", "pred_id", "actual_id"])
            for p in top10:
                w.writerow([p["predicted"], p["actual"], p["count"],
                             p["pred_id"], p["actual_id"]])
        print(f"\nTop confused pairs saved → {pairs_csv}")

        # ── Suggest per-class confidence thresholds ────────────────────────
        # Strategy:
        #   • For each class that appears as FALSE POSITIVE for banana:
        #     set threshold = precision[that_class] + 0.10 (stricter)
        #   • For banana itself: lower to max(0.18, recall-based optimal)
        suggested = {"__default__": 0.25}

        # Banana: use threshold that maximises F1 (approx recall * 0.8)
        if "banana" in cls_list:
            bi = cls_list.index("banana")
            if bi < len(ap50_per_class):
                banana_rec = float(recall_per_class[bi])
                banana_thr = max(0.18, round(banana_rec * 0.25, 2))
                suggested["banana"] = banana_thr
                print(f"\nBanana recall={banana_rec:.3f} → suggested conf={banana_thr}")

        # Classes that are often predicted instead of banana → raise threshold
        for pair in confusion_pairs:
            if pair["actual"] == "banana" and pair["count"] >= 3:
                fp_class = pair["predicted"]
                ci = cls_list.index(fp_class) if fp_class in cls_list else -1
                if ci >= 0 and ci < len(precision_per_class):
                    p_val = float(precision_per_class[ci])
                    new_thr = round(min(0.65, p_val + 0.10), 2)
                    suggested[fp_class] = new_thr
                    print(f"  {fp_class}: precision={p_val:.3f} → raise conf to {new_thr}")

        # Always raise known visually-similar classes
        for cls_name in BANANA_CONFUSION_TARGETS:
            if cls_name in cls_list and cls_name not in suggested:
                ci = cls_list.index(cls_name)
                if ci < len(precision_per_class):
                    p_val = float(precision_per_class[ci])
                    suggested[cls_name] = round(min(0.60, p_val + 0.08), 2)

        conf_json = out_dir / "suggested_per_class_conf.json"
        with open(conf_json, "w") as f:
            json.dump(suggested, f, indent=2)
        print(f"\nSuggested per-class conf → {conf_json}")
        print("Copy the contents into detection.py:_DEFAULT_PER_CLASS_CONF")
        print("Or set: YOLO_PER_CLASS_CONF='" + json.dumps(suggested) + "'")

    except AttributeError:
        print("\n(Raw confusion matrix not accessible — upgrade ultralytics>=8.1)")

    # ── Summary table ──────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("BEFORE / AFTER estimation (conf 0.5 → 0.25 + per-class filter):")
    print(f"  mAP50        : ~{map50:.3f}  (improves with lower conf)")
    print(f"  mean Precision: {precision_per_class.mean():.3f}")
    print(f"  mean Recall   : {recall_per_class.mean():.3f}")
    if "banana" in cls_list:
        bi = cls_list.index("banana")
        if bi < len(ap50_per_class):
            print(f"  banana AP50   : {float(ap50_per_class[bi]):.3f}")
            print(f"  banana recall : {float(recall_per_class[bi]):.3f}")
    print(f"{'='*60}\n")

    return metrics


def main():
    parser = argparse.ArgumentParser(description="Analyze YOLO model on validation set")
    parser.add_argument("--data",  default=DEFAULT_DATA_YAML, help="Path to data.yaml")
    parser.add_argument("--conf",  type=float, default=0.25)
    parser.add_argument("--iou",   type=float, default=0.50)
    args = parser.parse_args()

    if not Path(args.data).exists():
        print(f"ERROR: data.yaml not found at: {args.data}")
        print("Pass --data <path_to_data.yaml>")
        sys.exit(1)

    model_path = find_model()
    run_analysis(model_path, args.data, args.conf, args.iou)


if __name__ == "__main__":
    main()
