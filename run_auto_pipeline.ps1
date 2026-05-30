$ErrorActionPreference = "Stop"

$src = "C:\Users\Admin\Downloads\Study\machinelearningBT\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch"
$dst = "C:\Users\Admin\Downloads\Study\machinelearningBT\machinelearningBT\leaflogic object detection.v5i.yolov5pytorch_aug"

$python = "D:\Study\DETECT_VNESE_PROPS\Web app for agricultural detection\backend\.venv\Scripts\python.exe"
$yolo = "D:\Study\DETECT_VNESE_PROPS\Web app for agricultural detection\backend\.venv\Scripts\yolo.exe"

if (-Not (Test-Path $yolo)) {
    # Fallback yolo if not in backend folder
    $yolo = "C:\Users\Admin\Downloads\Study\Study\Detect_VNese_Props\ultralytics\.venv\Scripts\yolo.exe"
}

if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }

Write-Host "============================================="
Write-Host "BƯỚC 1: Data Augmentation (Mosaic, MixUp...)"
Write-Host "============================================="
$startTimeDate1 = Get-Date

& $python "D:\Study\DETECT_VNESE_PROPS\Web app for agricultural detection\backend\training\build_mosaic_dataset.py" --src $src --dst $dst --copy-orig --num-mosaic 3000 --num-mixup 800 --num-copypaste 3000
if ($LASTEXITCODE -ne 0) { throw "Error in Data Augmentation" }

$endTimeDate1 = Get-Date
$duration1 = ($endTimeDate1 - $startTimeDate1).TotalMinutes
Write-Host "[Xong] Data Augmentation mất $($duration1.ToString('N2')) phút."
Write-Host ""
Write-Host "============================================="
Write-Host "BƯỚC 2: Cập nhật thư mục train trong data.yaml"
Write-Host "============================================="

$yamlContent = Get-Content "$src\data.yaml" -Raw
$newYaml = $yamlContent -replace "path:[^\r\n]*", "path: $dst"
Set-Content -Path "$dst\data_aug.yaml" -Value $newYaml

Write-Host "[Xong] Đã tạo file $dst\data_aug.yaml trỏ tới dataset mới."
Write-Host ""
Write-Host "============================================="
Write-Host "BƯỚC 3: Bắt đầu Huấn luyện YOLO (Dự kiến 8-16 giờ)"
Write-Host "============================================="
$startTimeDate3 = Get-Date

& $python "D:\Study\DETECT_VNESE_PROPS\train_script.py"
if ($LASTEXITCODE -ne 0) { throw "Error in Training" }

$endTimeDate3 = Get-Date
$duration3 = ($endTimeDate3 - $startTimeDate3).TotalHours
Write-Host "[Xong] Huấn luyện mất $($duration3.ToString('N2')) giờ."
Write-Host ""
Write-Host "============================================="
Write-Host "BƯỚC 4: Val Model (Tính Recall & mAP)"
Write-Host "============================================="

# Validation done in Python script

Write-Host "[Xong] Đã kiểm tra Validation."
Write-Host ""
Write-Host "============================================="
Write-Host "BƯỚC 5: Update backend .env & hoàn tất"
Write-Host "============================================="

$envPath = "D:\Study\DETECT_VNESE_PROPS\Web app for agricultural detection\backend\.env"
$envContent = Get-Content $envPath -Raw
$envContent = $envContent -replace "(?m)^YOLO_MODEL_PATH=.*", "YOLO_MODEL_PATH=D:\Study\DETECT_VNESE_PROPS\runs\detect\crowded_v1\weights\best.pt"
Set-Content -Path $envPath -Value $envContent

Write-Host "====== MỌI THỨ HOÀN TẤT. VUI LÒNG KHỞI ĐỘNG LẠI BACKEND ======"



