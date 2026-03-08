# 🚀 YOLO Training Automation - Hướng Dẫn Sử Dụng

## 📋 Tổng Quan

Hệ thống huấn luyện YOLO tự động hóa hoàn toàn cho bộ dữ liệu nông sản Việt Nam với 74 loại cây trồng.

## 🎯 Tính Năng Chính

### ✅ Tự Động Hóa Hoàn Toàn
- ✓ Tự động kiểm tra và tạo môi trường ảo (.venv)
- ✓ Tự động cài đặt dependencies thiếu
- ✓ Tự động phát hiện và sửa lỗi import
- ✓ Tự động retry khi gặp lỗi tạm thời

### 💾 Quản Lý Checkpoint Thông Minh
- ✓ Tự động phát hiện checkpoint gần nhất để resume
- ✓ Lưu checkpoint mỗi 3 epochs
- ✓ Rotation tự động: Chỉ giữ 3 checkpoint mới nhất
- ✓ Xóa checkpoint cũ để tiết kiệm dung lượng

### 📊 Giám Sát Tiến Độ
- ✓ Log chi tiết theo thời gian thực
- ✓ Báo cáo sau mỗi epoch: loss, thời gian, đường dẫn output
- ✓ Early stopping tự động (10 epochs không cải thiện)

### 🛑 Dừng An Toàn (Graceful Stop)
- ✓ Hỗ trợ Ctrl+C để dừng
- ✓ Hỗ trợ stop flag file
- ✓ Tự động lưu checkpoint trước khi thoát
- ✓ Resume chính xác từ điểm dừng

## 📁 Cấu Trúc Files

```
d:\Study\Detect_VNese_Props\
├── START_TRAINING.ps1              # Script khởi động nhanh (PowerShell)
├── launch_training.py              # Launcher tự động hóa
├── train_vn_yolo26.py             # Script huấn luyện chính
├── stop.flag                       # File cờ để dừng training (tạo khi cần)
│
├── ultralytics\                    # Thư mục ultralytics
│   ├── .venv\                     # Môi trường ảo (tự động tạo)
│   └── runs\detect\               # Kết quả training
│       └── train\                 # Run mới nhất
│           ├── weights\
│           │   ├── best.pt       # Model tốt nhất
│           │   └── last.pt       # Checkpoint mới nhất
│           └── checkpoints\       # Checkpoints rotation
│               ├── checkpoint_epoch_3.pt
│               ├── checkpoint_epoch_6.pt
│               └── checkpoint_epoch_9.pt
│
└── 100_crops_plants_object_detection_25k_image_dataset\
    └── leaflogic_vn\
        └── data.yaml              # Cấu hình dataset
```

## 🚀 Cách Sử Dụng

### Phương Án 1: Quick Start (Khuyến Nghị)

**Windows PowerShell:**
```powershell
cd d:\Study\Detect_VNese_Props
.\START_TRAINING.ps1
```

### Phương Án 2: Chạy Trực Tiếp

```bash
python d:\Study\Detect_VNese_Props\launch_training.py
```

## ⚙️ Cấu Hình

### Thay Đổi Tham Số Huấn Luyện

Mở file `train_vn_yolo26.py` và chỉnh sửa class `TrainingConfig`:

```python
class TrainingConfig:
    # Model size: yolo11n.pt (nano), yolo11s.pt (small), yolo11m.pt (medium)
    MODEL_SIZE = "yolo11n.pt"
    
    # Số epochs
    EPOCHS = 100
    
    # Batch size (tùy vào GPU)
    BATCH_SIZE = 16
    
    # Image size
    IMAGE_SIZE = 640
    
    # Early stopping patience
    PATIENCE = 10
    
    # Checkpoint interval (mỗi bao nhiêu epochs lưu 1 lần)
    CHECKPOINT_INTERVAL = 3
    
    # Số checkpoint tối đa giữ lại
    MAX_CHECKPOINTS = 3
```

## 🛑 Dừng Training An Toàn

### Cách 1: Ctrl+C
Nhấn `Ctrl+C` trong terminal, training sẽ:
1. Hoàn thành epoch hiện tại
2. Lưu checkpoint `last.pt`
3. Thoát an toàn

### Cách 2: Stop Flag
Tạo file `stop.flag` trong thư mục gốc:
```powershell
New-Item -Path "d:\Study\Detect_VNese_Props\stop.flag" -ItemType File
```

Training sẽ phát hiện và dừng an toàn tại checkpoint tiếp theo.

## 🔄 Resume Training

Khi chạy lại launcher, script sẽ:
1. Tự động phát hiện checkpoint gần nhất
2. Hỏi có muốn resume không
3. Nếu YES: Tiếp tục từ epoch đã dừng
4. Nếu NO: Bắt đầu training mới

## 📊 Xem Kết Quả

### Trong Quá Trình Training
Log hiển thị theo thời gian thực:
```
================================================================================
📊 EPOCH 5/100 SUMMARY
================================================================================
⏱ Time Elapsed: 0h 15m
📉 Train Loss: 2.3456
📉 Val Loss: 2.1234
💾 Output Directory: d:\Study\Detect_VNese_Props\ultralytics\runs\detect\train
================================================================================
```

### Sau Khi Hoàn Thành
Kết quả lưu tại: `ultralytics\runs\detect\train\`
- `weights\best.pt` - Model tốt nhất
- `weights\last.pt` - Checkpoint mới nhất
- `results.csv` - Metrics chi tiết
- `confusion_matrix.png` - Ma trận nhầm lẫn
- `results.png` - Biểu đồ training

## 🐛 Xử Lý Lỗi

### Lỗi: "No module named 'xxx'"
Launcher sẽ tự động phát hiện và cài đặt package thiếu. Nếu không được:
```bash
d:\Study\Detect_VNese_Props\ultralytics\.venv\Scripts\activate
pip install xxx
```

### Lỗi: CUDA Out of Memory
Giảm `BATCH_SIZE` trong `TrainingConfig`:
```python
BATCH_SIZE = 8  # hoặc 4
```

### Lỗi: data.yaml not found
Kiểm tra đường dẫn trong `TrainingConfig`:
```python
DATA_YAML = r"d:\Study\Detect_VNese_Props\100_crops_plants_object_detection_25k_image_dataset\leaflogic_vn\data.yaml"
```

## 📈 Monitor Training với TensorBoard

```bash
# Kích hoạt venv
d:\Study\Detect_VNese_Props\ultralytics\.venv\Scripts\activate

# Chạy TensorBoard
tensorboard --logdir=d:\Study\Detect_VNese_Props\ultralytics\runs\detect

# Mở browser: http://localhost:6006
```

## 💡 Tips & Best Practices

1. **GPU Memory**: Bắt đầu với `BATCH_SIZE=16`, giảm nếu OOM
2. **Checkpoint Rotation**: Mặc định giữ 3 checkpoints, tăng nếu cần
3. **Early Stopping**: Patience=10 epochs, tăng nếu loss dao động
4. **Resume Training**: Luôn resume từ checkpoint khi bị gián đoạn
5. **Backup**: Sao lưu `best.pt` sau mỗi training run quan trọng

## 🔧 Troubleshooting

### Training chậm?
- Giảm `IMAGE_SIZE` xuống 416
- Tăng `BATCH_SIZE` nếu GPU còn RAM
- Sử dụng model nhỏ hơn (nano thay vì small)

### Validation Loss không giảm?
- Tăng `PATIENCE` lên 15-20 epochs
- Kiểm tra data augmentation
- Thử learning rate khác

### Checkpoint bị lỗi?
- Xóa thư mục `runs/detect/train`
- Chạy lại từ đầu với model pretrained

## 📞 Support

Nếu gặp vấn đề, kiểm tra:
1. Log chi tiết trong terminal
2. File `results.csv` trong thư mục output
3. GPU memory với `nvidia-smi`

## 📝 Dataset Info

- **Classes**: 74 loại cây trồng nông sản Việt Nam
- **Training images**: ~12,966
- **Validation images**: ~3,677
- **Test images**: ~1,828

---

**Happy Training! 🎉**
