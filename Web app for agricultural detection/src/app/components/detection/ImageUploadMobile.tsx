import { useState, useRef, useCallback } from 'react';
import { Upload, Zap, AlertCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import type { ImageDetectionResult } from '../../types';
import { detectImage } from '../../services/mockApi';
import BoundingBoxCanvas from './BoundingBoxCanvas';
import ProductMetadataCard from '../product/ProductMetadataCard';

type DetectMode = 'multi' | 'single';

export default function ImageUploadMobile() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ImageDetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DetectMode>('multi');
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
    if (!allowed.includes(f.type)) {
      setError('Định dạng không hỗ trợ.');
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }, []);

  const handleDetect = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const conf = mode === 'single' ? 0.10 : 0.20;
      const iou = 0.45;
      const maxDet = mode === 'single' ? 1 : 100;
      const res = await detectImage(file, conf, iou, maxDet);
      setResult(res);
    } catch {
      setError('Lỗi kết nối. Kiểm tra server backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Settings accordion */}
      <div className="bg-white border-b border-gray-100">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center gap-2 px-4 py-3 text-gray-700"
          style={{ fontSize: '0.8rem', fontWeight: 500 }}
        >
          <span>⚙️ Chế độ nhận diện</span>
          {showSettings ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
        </button>
        {showSettings && (
          <div className="px-4 pb-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-gray-700" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={mode === 'multi'}
                onChange={() => setMode('multi')}
                className="accent-green-600"
              />
              Nhận diện nhiều trái cây
            </label>
            <label className="flex items-center gap-2 text-gray-700" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={mode === 'single'}
                onChange={() => setMode('single')}
                className="accent-green-600"
              />
              Nhận diện 1 trái cây
            </label>
          </div>
        )}
      </div>

      {/* Upload zone */}
      {!previewUrl ? (
        <div
          className="mx-4 mt-4 border-2 border-dashed border-gray-200 rounded-2xl bg-white flex flex-col items-center justify-center gap-3 py-10 cursor-pointer active:bg-green-50"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
            <Upload size={28} className="text-green-500" />
          </div>
          <div className="text-center px-4">
            <p style={{ fontWeight: 600, fontSize: '0.95rem' }} className="text-gray-700">
              Chọn ảnh từ máy
            </p>
            <p className="text-gray-400 mt-1" style={{ fontSize: '0.8rem' }}>
              JPG, PNG, WebP · Tối đa 20MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <>
          {/* Image preview */}
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden bg-black relative" style={{ aspectRatio: '4/3' }}>
            {result ? (
              <BoundingBoxCanvas
                imageSrc={previewUrl}
                objects={result.objects}
                imageWidth={result.image_width}
                imageHeight={result.image_height}
              />
            ) : (
              <img src={previewUrl} className="w-full h-full object-contain" alt="Preview" />
            )}
            {loading && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-white" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Đang phân tích...</p>
              </div>
            )}
          </div>

          {/* Stats */}
          {result && (
            <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Đối tượng', value: result.objects.length },
                { label: 'Thời gian', value: `${result.inference_time_ms.toFixed(0)}ms` },
                { label: 'Loại riêng', value: new Set(result.objects.map(o => o.class_name)).size },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-xl border border-green-100 p-3 text-center">
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }} className="text-green-700">{s.value}</div>
                  <div style={{ fontSize: '0.62rem' }} className="text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600">
          <AlertCircle size={15} />
          <span style={{ fontSize: '0.8rem' }}>{error}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 mt-4 flex gap-3">
        {file && !result && !loading && (
          <button
            onClick={handleDetect}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white rounded-xl"
            style={{ fontWeight: 600 }}
          >
            <Zap size={18} />
            Nhận diện
          </button>
        )}
        {loading && (
          <div className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-green-100 rounded-xl text-green-700">
            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            Đang xử lý...
          </div>
        )}
        {result && (
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gray-200 text-gray-700 rounded-xl"
            style={{ fontWeight: 500 }}
          >
            <RotateCcw size={16} />
            Ảnh mới
          </button>
        )}
      </div>

      {/* Results list */}
      {result && result.objects.length > 0 && (
        <div className="px-4 mt-4 pb-4 space-y-3">
          <p style={{ fontWeight: 700, fontSize: '0.9rem' }} className="text-gray-800">
            Kết quả ({result.objects.length} đối tượng)
          </p>
          {result.objects.map((obj) => (
            <ProductMetadataCard key={obj.id} object={obj} compact />
          ))}
        </div>
      )}

      {result && result.objects.length === 0 && (
        <div className="mx-4 mt-4 p-6 bg-white rounded-2xl border border-gray-100 text-center text-gray-400">
          <AlertCircle size={36} className="mx-auto mb-2" />
          <p style={{ fontWeight: 500 }}>Không phát hiện nông sản</p>
          <p style={{ fontSize: '0.8rem' }} className="mt-1">Thử giảm ngưỡng Confidence</p>
        </div>
      )}
    </div>
  );
}
