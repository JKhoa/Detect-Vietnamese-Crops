"""
build_mosaic_dataset.py â€” Sinh dataset augmented vá»›i Mosaic + MixUp + Copy-Paste.

Váº¤N Äá»€ GIáº¢I QUYáº¾T:
  Model Ä‘ang train chá»‰ nhÃ¬n tháº¥y "1 object / áº£nh" â†’ há»c lá»‡ch â†’ á»Ÿ inference khi cÃ³ nhiá»u
  loáº¡i nÃ´ng sáº£n trong cÃ¹ng áº£nh, model chá»‰ predict 1 rá»“i "bá» qua" cÃ¡c object cÃ²n láº¡i.

GIáº¢I PHÃP:
  TrÆ°á»›c khi train, sinh sáºµn N áº£nh tá»•ng há»£p, má»—i áº£nh chá»©a 2-4 loáº¡i nÃ´ng sáº£n khÃ¡c nhau.
  Model buá»™c pháº£i há»c cÃ¡ch predict nhiá»u bbox Ä‘á»“ng thá»i.

INPUT (YOLO format):
  <src_root>/images/train/*.jpg
  <src_root>/labels/train/*.txt   # má»—i dÃ²ng: class_id cx cy w h (normalized 0-1)

OUTPUT:
  <dst_root>/images/train/mosaic_<i>.jpg
  <dst_root>/labels/train/mosaic_<i>.txt
  <dst_root>/images/train/mixup_<i>.jpg   (náº¿u --mixup > 0)
  <dst_root>/labels/train/mixup_<i>.txt
  <dst_root>/images/train/cp_<i>.jpg      (copy-paste augmentation)
  <dst_root>/labels/train/cp_<i>.txt

USAGE:
  python build_mosaic_dataset.py \
    --src "c:/Users/Admin/Downloads/Study/Study/Detect_VNese_Props/dataset" \
    --dst "c:/Users/Admin/Downloads/Study/Study/Detect_VNese_Props/dataset_aug" \
    --num-mosaic 2000 --num-mixup 500 --num-copypaste 1500 --img-size 640

Sau khi sinh xong, gá»™p vÃ o data.yaml:
  path: dataset_aug
  train: images/train         # bao gá»“m cáº£ áº£nh gá»‘c náº¿u copy sang
  val:   images/val
"""

import argparse
import random
import shutil
from pathlib import Path
from typing import List, Tuple

import cv2
import numpy as np

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# I/O helpers
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def load_pair(img_path: Path, label_path: Path) -> Tuple[np.ndarray, List[List[float]]]:
    """Äá»c image + YOLO labels. Tráº£ vá» (BGR image, [[cls, cx, cy, w, h], ...])."""
    img = cv2.imread(str(img_path))
    if img is None:
        return None, []
    labels: List[List[float]] = []
    if label_path.exists():
        for line in label_path.read_text().splitlines():
            parts = line.strip().split()
            if len(parts) >= 5:
                labels.append([float(p) for p in parts[:5]])
    return img, labels


def save_pair(img: np.ndarray, labels: List[List[float]],
              img_path: Path, label_path: Path) -> None:
    cv2.imwrite(str(img_path), img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    lines = []
    for lb in labels:
        cls = int(lb[0])
        cx, cy, w, h = lb[1:5]
        # Clip vá» [0, 1]
        cx = max(0.0, min(1.0, cx))
        cy = max(0.0, min(1.0, cy))
        w  = max(0.0, min(1.0, w))
        h  = max(0.0, min(1.0, h))
        if w <= 0.005 or h <= 0.005:
            continue  # bbox quÃ¡ nhá» â†’ bá»
        lines.append(f"{cls} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
    label_path.write_text("\n".join(lines))


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# AUGMENTATION 1: MOSAIC (4 áº£nh ghÃ©p thÃ nh 2x2)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def make_mosaic(samples: List[Tuple[np.ndarray, List[List[float]]]],
                size: int = 640) -> Tuple[np.ndarray, List[List[float]]]:
    """GhÃ©p 4 áº£nh thÃ nh 1 áº£nh 2x2 vá»›i tÃ¢m ngáº«u nhiÃªn â†’ tá»· lá»‡ 4 quadrant khÃ¡c nhau."""
    assert len(samples) == 4
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)  # gray padding (YOLO chuáº©n)

    # TÃ¢m mosaic ngáº«u nhiÃªn trong [0.3*size, 0.7*size] â†’ 4 quadrant kÃ­ch thÆ°á»›c khÃ¡c nhau
    xc = int(random.uniform(0.3, 0.7) * size)
    yc = int(random.uniform(0.3, 0.7) * size)

    new_labels: List[List[float]] = []

    for idx, (img, labels) in enumerate(samples):
        h0, w0 = img.shape[:2]
        # XÃ¡c Ä‘á»‹nh quadrant placement
        if idx == 0:  # top-left
            x1, y1, x2, y2 = 0, 0, xc, yc
        elif idx == 1:  # top-right
            x1, y1, x2, y2 = xc, 0, size, yc
        elif idx == 2:  # bottom-left
            x1, y1, x2, y2 = 0, yc, xc, size
        else:  # bottom-right
            x1, y1, x2, y2 = xc, yc, size, size

        tw, th = x2 - x1, y2 - y1
        # Resize giá»¯ tá»· lá»‡, pad náº¿u cáº§n
        r = min(tw / w0, th / h0)
        nw, nh = int(w0 * r), int(h0 * r)
        img_rs = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)
        # DÃ¡n vÃ o canvas (cÄƒn giá»¯a quadrant)
        dx = (tw - nw) // 2
        dy = (th - nh) // 2
        canvas[y1 + dy:y1 + dy + nh, x1 + dx:x1 + dx + nw] = img_rs

        # Update labels
        for cls, cx, cy, w, h in labels:
            # cx, cy, w, h Ä‘ang lÃ  tá»· lá»‡ theo (w0, h0) â†’ chuyá»ƒn sang pixel trong quadrant
            abs_cx = cx * nw + x1 + dx
            abs_cy = cy * nh + y1 + dy
            abs_w  = w * nw
            abs_h  = h * nh
            # Chuáº©n hÃ³a láº¡i theo canvas size
            new_labels.append([
                cls,
                abs_cx / size,
                abs_cy / size,
                abs_w / size,
                abs_h / size,
            ])

    return canvas, new_labels


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# AUGMENTATION 2: MIXUP (alpha-blend 2 áº£nh â†’ nhÃ£n gá»™p)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def make_mixup(sample_a: Tuple[np.ndarray, List[List[float]]],
               sample_b: Tuple[np.ndarray, List[List[float]]],
               size: int = 640,
               alpha: float = 0.5) -> Tuple[np.ndarray, List[List[float]]]:
    """Alpha-blend 2 áº£nh. Label = union cá»§a cáº£ 2. alpha ~ Beta(8,8) â‰ˆ 0.5."""
    img_a, labels_a = sample_a
    img_b, labels_b = sample_b

    # Resize cáº£ 2 vá» cÃ¹ng size
    img_a = cv2.resize(img_a, (size, size))
    img_b = cv2.resize(img_b, (size, size))

    lam = np.random.beta(8.0, 8.0)  # ~0.5
    blended = (img_a.astype(np.float32) * lam +
               img_b.astype(np.float32) * (1 - lam)).astype(np.uint8)

    # Labels chuyá»ƒn vá» Ä‘Ã£ chuáº©n hÃ³a sáºµn (YOLO format) â†’ chá»‰ viá»‡c gá»™p
    new_labels = list(labels_a) + list(labels_b)
    return blended, new_labels


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# AUGMENTATION 3: COPY-PASTE (crop instance tá»« áº£nh nguá»“n, dÃ¡n lÃªn áº£nh ná»n khÃ¡c)
# ÄÃ¢y lÃ  augmentation quan trá»ng nháº¥t Ä‘á»ƒ giáº£i "bá» sÃ³t khi chá»“ng chÃ©o"
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def make_copy_paste(
    background: Tuple[np.ndarray, List[List[float]]],
    instances: List[Tuple[np.ndarray, List[float]]],  # (crop, bbox_in_crop=[0,0,1,1])
    size: int = 640,
    n_paste: int = 3,
) -> Tuple[np.ndarray, List[List[float]]]:
    """
    DÃ¡n n_paste instances (Ä‘Ã£ crop sáºµn) lÃªn background á»Ÿ vá»‹ trÃ­ ngáº«u nhiÃªn,
    vá»›i scale ngáº«u nhiÃªn. áº¢nh ná»n GIá»® NGUYÃŠN labels + THÃŠM labels má»›i.
    """
    bg_img, bg_labels = background
    bg_img = cv2.resize(bg_img, (size, size))
    new_labels = list(bg_labels)

    for crop_img, crop_cls in instances[:n_paste]:
        ch, cw = crop_img.shape[:2]
        # Scale ngáº«u nhiÃªn 15-40% kÃ­ch thÆ°á»›c canvas
        target_w = int(random.uniform(0.15, 0.40) * size)
        scale    = target_w / cw
        new_w    = int(cw * scale)
        new_h    = int(ch * scale)
        if new_w > size * 0.8:
            new_w = int(size * 0.8)
            new_h = int(new_w * (ch / cw))
        if new_h > size * 0.8:
            new_h = int(size * 0.8)
            new_w = int(new_h * (cw / ch))
            
        if new_w < 20 or new_h < 20 or size <= new_w or size <= new_h:
            continue
        crop_rs = cv2.resize(crop_img, (new_w, new_h))

        # Chá»n vá»‹ trÃ­ dÃ¡n ngáº«u nhiÃªn (cho phÃ©p chá»“ng lÃªn object cÃ³ sáºµn â€” Ä‘Ã¢y lÃ  Ä‘iá»ƒm máº¥u chá»‘t)
        x = random.randint(0, size - new_w)
        y = random.randint(0, size - new_h)

        # Simple paste (khÃ´ng alpha) â€” náº¿u muá»‘n mÆ°á»£t hÆ¡n dÃ¹ng seamlessClone
        bg_img[y:y + new_h, x:x + new_w] = crop_rs

        # ThÃªm label YOLO (normalize)
        cx = (x + new_w / 2) / size
        cy = (y + new_h / 2) / size
        w  = new_w / size
        h  = new_h / size
        new_labels.append([crop_cls, cx, cy, w, h])

    return bg_img, new_labels


def extract_instances(
    pairs: List[Tuple[Path, Path]],
    max_instances: int = 500,
    min_box_frac: float = 0.05,
) -> List[Tuple[np.ndarray, float]]:
    """TrÃ­ch xuáº¥t crop tá»« dataset theo bbox. DÃ¹ng cho copy-paste."""
    instances: List[Tuple[np.ndarray, float]] = []
    random.shuffle(pairs)
    for img_p, lbl_p in pairs:
        if len(instances) >= max_instances:
            break
        img, labels = load_pair(img_p, lbl_p)
        if img is None:
            continue
        h, w = img.shape[:2]
        for cls, cx, cy, bw, bh in labels:
            if bw < min_box_frac or bh < min_box_frac:
                continue  # bbox quÃ¡ nhá» â†’ crop khÃ´ng Ä‘á»§ chi tiáº¿t
            x1 = max(0, int((cx - bw / 2) * w))
            y1 = max(0, int((cy - bh / 2) * h))
            x2 = min(w, int((cx + bw / 2) * w))
            y2 = min(h, int((cy + bh / 2) * h))
            if x2 - x1 < 30 or y2 - y1 < 30:
                continue
            crop = img[y1:y2, x1:x2].copy()
            instances.append((crop, cls))
            if len(instances) >= max_instances:
                break
    return instances


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Main
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="Dataset gá»‘c (chá»©a images/, labels/)")
    ap.add_argument("--dst", required=True, help="Dataset Ä‘Ã­ch")
    ap.add_argument("--split", default="train", help="train / val")
    ap.add_argument("--img-size", type=int, default=640)
    ap.add_argument("--num-mosaic",    type=int, default=2000)
    ap.add_argument("--num-mixup",     type=int, default=500)
    ap.add_argument("--num-copypaste", type=int, default=1500)
    ap.add_argument("--copy-orig", action="store_true",
                    help="Copy áº£nh gá»‘c sang dst Ä‘á»ƒ gá»™p vá»›i augmented")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)

    src_img_dir = Path(args.src) / args.split / "images"
    src_lbl_dir = Path(args.src) / args.split / "labels"
    dst_img_dir = Path(args.dst) / args.split / "images"
    dst_lbl_dir = Path(args.dst) / args.split / "labels"
    dst_img_dir.mkdir(parents=True, exist_ok=True)
    dst_lbl_dir.mkdir(parents=True, exist_ok=True)

    # Liá»‡t kÃª cáº·p (image, label)
    pairs: List[Tuple[Path, Path]] = []
    for img_p in sorted(list(src_img_dir.glob("*.jpg")) +
                        list(src_img_dir.glob("*.png")) +
                        list(src_img_dir.glob("*.jpeg"))):
        lbl_p = src_lbl_dir / (img_p.stem + ".txt")
        pairs.append((img_p, lbl_p))

    if len(pairs) < 4:
        raise RuntimeError(f"Cáº§n Ã­t nháº¥t 4 áº£nh, tÃ¬m tháº¥y {len(pairs)} táº¡i {src_img_dir}")

    print(f"[build] Found {len(pairs)} source pairs")

    # Copy áº£nh gá»‘c náº¿u yÃªu cáº§u
    if args.copy_orig:
        print(f"[build] Copying original {len(pairs)} pairs to dst...")
        for img_p, lbl_p in pairs:
            shutil.copy2(img_p, dst_img_dir / img_p.name)
            if lbl_p.exists():
                shutil.copy2(lbl_p, dst_lbl_dir / lbl_p.name)

    # â”€â”€ Mosaic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print(f"[build] Generating {args.num_mosaic} MOSAIC images...")
    for i in range(args.num_mosaic):
        samples = [load_pair(*random.choice(pairs)) for _ in range(4)]
        samples = [(img, lbl) for img, lbl in samples if img is not None]
        if len(samples) < 4:
            continue
        canvas, labels = make_mosaic(samples, size=args.img_size)
        save_pair(canvas, labels,
                  dst_img_dir / f"mosaic_{i:06d}.jpg",
                  dst_lbl_dir / f"mosaic_{i:06d}.txt")
        if (i + 1) % 200 == 0:
            print(f"  mosaic {i + 1}/{args.num_mosaic}")

    # â”€â”€ MixUp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print(f"[build] Generating {args.num_mixup} MIXUP images...")
    for i in range(args.num_mixup):
        a = load_pair(*random.choice(pairs))
        b = load_pair(*random.choice(pairs))
        if a[0] is None or b[0] is None:
            continue
        img, labels = make_mixup(a, b, size=args.img_size)
        save_pair(img, labels,
                  dst_img_dir / f"mixup_{i:06d}.jpg",
                  dst_lbl_dir / f"mixup_{i:06d}.txt")
        if (i + 1) % 100 == 0:
            print(f"  mixup {i + 1}/{args.num_mixup}")

    # â”€â”€ Copy-Paste (QUAN TRá»ŒNG NHáº¤T cho chá»“ng chÃ©o) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print(f"[build] Extracting instances for copy-paste...")
    instances = extract_instances(pairs, max_instances=1500)
    print(f"[build] Extracted {len(instances)} instances")

    print(f"[build] Generating {args.num_copypaste} COPY-PASTE images...")
    for i in range(args.num_copypaste):
        bg = load_pair(*random.choice(pairs))
        if bg[0] is None or len(instances) < 3:
            continue
        sampled = random.sample(instances, min(random.randint(2, 4), len(instances)))
        img, labels = make_copy_paste(bg, sampled, size=args.img_size)
        save_pair(img, labels,
                  dst_img_dir / f"cp_{i:06d}.jpg",
                  dst_lbl_dir / f"cp_{i:06d}.txt")
        if (i + 1) % 200 == 0:
            print(f"  copy-paste {i + 1}/{args.num_copypaste}")

    # Summary
    total_imgs  = len(list(dst_img_dir.glob("*.jpg")))
    total_lbls  = len(list(dst_lbl_dir.glob("*.txt")))
    print(f"\n[build] DONE. {total_imgs} images + {total_lbls} labels at {args.dst}")


if __name__ == "__main__":
    main()

