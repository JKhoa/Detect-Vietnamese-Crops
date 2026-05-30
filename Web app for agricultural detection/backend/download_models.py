"""Tải các model YOLO trái cây mã nguồn mở về thư mục backend/models/.

Chạy 1 lần sau khi clone repo:
    python download_models.py
"""

import sys
from pathlib import Path
from huggingface_hub import hf_hub_download

# Force UTF-8 stdout trên Windows
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

# (repo_id, filename, local_save_name)
# Mỗi target: (repo_id, filename, save_as).
# - yolov8s-oiv7.pt: bản lớn hơn của OIV7 (601-class) — nhiều trái cây quốc tế hơn primary.
# - yolov8s-world.pt: YOLO-World mở rộng (open-vocabulary, có thể tự thêm trái cây tiếng Việt).
TARGETS = [
    ("Ultralytics/YOLOv8", "yolov8x-oiv7.pt", "yolov8x-oiv7.pt"),
    ("Ultralytics/YOLOv8", "yolov8s-oiv7.pt", "yolov8s-oiv7.pt"),
]

# Nguồn URL dự phòng (GitHub release của Ultralytics — nếu HF chưa có).
DIRECT_URLS = {
    "yolov8x-oiv7.pt":
        "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8x-oiv7.pt",
    "yolov8s-oiv7.pt":
        "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8s-oiv7.pt",
}

def _download_direct(url: str, target: Path) -> None:
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as resp, open(target, "wb") as f:
        while True:
            chunk = resp.read(1 << 16)
            if not chunk: break
            f.write(chunk)


def main() -> None:
    for repo_id, filename, save_as in TARGETS:
        target = MODELS_DIR / save_as
        if target.exists():
            print(f"[skip] {save_as} đã tồn tại: {target}")
            continue
        print(f"[download] {repo_id}/{filename} -> {save_as}")
        ok = False
        try:
            path = hf_hub_download(repo_id=repo_id, filename=filename,
                                   local_dir=str(MODELS_DIR))
            src = Path(path)
            if src.name != save_as:
                src.rename(target)
            ok = True
            print(f"  OK (HF): {target}")
        except Exception as e:
            print(f"  HF failed: {e}")

        if not ok and save_as in DIRECT_URLS:
            try:
                print(f"  Fallback direct URL: {DIRECT_URLS[save_as]}")
                _download_direct(DIRECT_URLS[save_as], target)
                print(f"  OK (direct): {target}")
            except Exception as e:
                print(f"  Direct download failed: {e}")

    # Liệt kê models hiện có
    print("\n=== Danh sách models ===")
    for p in sorted(MODELS_DIR.glob("*.pt")):
        size_mb = p.stat().st_size / 1024 / 1024
        print(f"  {p.name:30s}  {size_mb:6.1f} MB")

if __name__ == "__main__":
    main()
