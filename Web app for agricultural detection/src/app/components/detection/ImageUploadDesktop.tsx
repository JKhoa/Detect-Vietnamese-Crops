import { useState, useRef, useCallback } from 'react';
import {
  Upload, ImageIcon, Zap, Download, RotateCcw,
  AlertCircle, Clock, Layers, Settings2
} from 'lucide-react';
import type { ImageDetectionResult } from '../../types';
import { detectImage } from '../../services/mockApi';
import BoundingBoxCanvas from './BoundingBoxCanvas';
import ProductMetadataCard from '../product/ProductMetadataCard';

type DetectMode = 'multi' | 'single';

export default function ImageUploadDesktop() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ImageDetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<DetectMode>('multi');
  const [selectedObj, setSelectedObj] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
    if (!allowed.includes(f.type)) {
      setError('Định dạng không hỗ trợ. Dùng JPG, PNG, WebP hoặc BMP.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File quá lớn. Giới hạn 20MB.');
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setSelectedObj(0);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

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
      setSelectedObj(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nhận diện thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setSelectedObj(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    if (!result || !previewUrl) return;
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `nongsan_${result.session_id}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Left: Upload + Preview ── */}
      <div className="flex-1 flex flex-col p-6 gap-4 overflow-auto min-w-0">
        {/* Settings bar */}
        <div className="bg-white rounded-xl border border-green-100 px-4 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Settings2 size={15} className="text-green-600" />
            <span style={{ fontWeight: 600, fontSize: '0.8rem' }} className="text-gray-700">
              Tham số inference
            </span>
          </div>
          <div className="flex items-center gap-5">
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
          {result && (
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Clock size={14} />
                <span style={{ fontSize: '0.75rem' }}>{result.inference_time_ms.toFixed(1)}ms</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500">
                <Layers size={14} />
                <span style={{ fontSize: '0.75rem' }}>{result.objects.length} đối tượng</span>
              </div>
            </div>
          )}
        </div>

        {/* Upload Area or Preview */}
        {!previewUrl ? (
          <div
            className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
              dragOver
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-green-400 hover:bg-green-50'
            }`}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center">
              <Upload size={36} className="text-green-500" />
            </div>
            <div className="text-center">
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }} className="text-gray-700">
                Kéo thả ảnh vào đây
              </p>
              <p className="text-gray-400 mt-1" style={{ fontSize: '0.875rem' }}>
                hoặc click để chọn file
              </p>
              <p className="text-gray-300 mt-2" style={{ fontSize: '0.75rem' }}>
                JPG, PNG, WebP, BMP · Tối đa 20MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        ) : (
          <div className="flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center relative min-h-0">
            {result ? (
              <BoundingBoxCanvas
                imageSrc={previewUrl}
                objects={result.objects}
                imageWidth={result.image_width}
                imageHeight={result.image_height}
              />
            ) : (
              <img
                src={previewUrl}
                className="max-w-full max-h-full object-contain"
                alt="Preview"
              />
            )}
            {loading && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-white" style={{ fontWeight: 500 }}>Đang phân tích...</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600">
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {file && !result && (
            <button
              onClick={handleDetect}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              style={{ fontWeight: 600 }}
            >
              <Zap size={18} />
              {loading ? 'Đang nhận diện...' : 'Bắt đầu nhận diện'}
            </button>
          )}
          {result && (
            <>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                style={{ fontWeight: 500 }}
              >
                <Download size={16} />
                Tải ảnh kết quả
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors"
                style={{ fontWeight: 500 }}
              >
                <RotateCcw size={16} />
                Ảnh mới
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Right: Results Panel ── */}
      <div className="w-96 bg-white border-l border-green-100 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-green-100">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-green-600" />
            <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800">
              Kết quả nhận diện
            </h2>
            {result && (
              <span className="ml-auto px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full" style={{ fontWeight: 600, fontSize: '0.75rem' }}>
                {result.objects.length} đối tượng
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300 p-6">
              <ImageIcon size={48} />
              <p className="text-center" style={{ fontSize: '0.875rem' }}>
                Upload ảnh và nhấn "Bắt đầu nhận diện" để xem kết quả
              </p>
            </div>
          )}

          {result && result.objects.length === 0 && (
            <div className="p-6 text-center text-gray-400">
              <AlertCircle size={40} className="mx-auto mb-3" />
              <p style={{ fontWeight: 500 }}>Không phát hiện nông sản nào</p>
              <p style={{ fontSize: '0.8rem' }} className="mt-1">
                Thử giảm ngưỡng Confidence
              </p>
            </div>
          )}

          {result && result.objects.length > 0 && (
            <>
              {/* Object selector tabs */}
              <div className="flex overflow-x-auto border-b border-gray-100 px-2 pt-2 gap-1">
                {result.objects.map((obj, i) => (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedObj(i)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-t-lg transition-colors ${
                      selectedObj === i
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                    }`}
                    style={{ fontSize: '0.75rem', fontWeight: 500 }}
                  >
                    #{i + 1} {obj.display_name || obj.class_name}
                  </button>
                ))}
              </div>

              <div className="p-4">
                <ProductMetadataCard
                  object={result.objects[selectedObj]}
                  compact={false}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
