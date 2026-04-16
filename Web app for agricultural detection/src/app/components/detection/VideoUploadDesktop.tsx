import { useState, useRef, useCallback } from 'react';
import {
  Upload, Video, Play, AlertCircle, RotateCcw,
  Clock, Layers, Film, BarChart2, Download
} from 'lucide-react';
import type { VideoDetectionResult, DetectionFrame } from '../../types';
import { detectVideo } from '../../services/mockApi';
import { getMetadata } from '../../data/metadata';

export default function VideoUploadDesktop() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VideoDetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [conf, setConf] = useState(0.5);
  const [selectedFrame, setSelectedFrame] = useState<DetectionFrame | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/avi', 'video/x-msvideo', 'video/webm'];
    if (!allowed.includes(f.type)) {
      setError('Định dạng không hỗ trợ. Dùng MP4, MOV, AVI hoặc WebM.');
      return;
    }
    if (f.size > 200 * 1024 * 1024) {
      setError('File quá lớn. Giới hạn 200MB.');
      return;
    }
    setError(null);
    setResult(null);
    setSelectedFrame(null);
    setFile(f);
  }, []);

  const handleDetect = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    try {
      const res = await detectVideo(file, setProgress, conf);
      setResult(res);
      const firstWithObjects = res.frames.find(f => f.objects.length > 0);
      setSelectedFrame(firstWithObjects || res.frames[0] || null);
    } catch {
      setError('Lỗi xử lý video. Kiểm tra backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setSelectedFrame(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uniqueClasses = result
    ? [...new Set(result.frames.flatMap(f => f.objects.map(o => o.class_name)))]
    : [];

  const framesWithObjects = result?.frames.filter(f => f.objects.length > 0) || [];

  const downloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detection_${result.session_id}.json`;
    a.click();
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Left: Upload + Controls ── */}
      <div className="flex-1 flex flex-col p-6 gap-4 overflow-auto min-w-0">
        {/* Settings */}
        <div className="bg-white rounded-xl border border-green-100 px-4 py-3 flex items-center gap-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Film size={15} className="text-green-600" />
            <span style={{ fontWeight: 600, fontSize: '0.8rem' }} className="text-gray-700">Cấu hình xử lý video</span>
          </div>
          <div className="flex items-center gap-3">
            <label style={{ fontSize: '0.75rem' }} className="text-gray-500">Conf</label>
            <input
              type="range" min={0.1} max={0.95} step={0.05}
              value={conf}
              onChange={e => setConf(+e.target.value)}
              className="w-24 accent-green-500"
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className="text-green-700 w-8">{conf.toFixed(2)}</span>
          </div>
          {result && (
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Layers size={14} className="text-gray-400" />
                <span style={{ fontSize: '0.75rem' }}>{result.total_frames} frames</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-gray-400" />
                <span style={{ fontSize: '0.75rem' }}>{result.duration_seconds.toFixed(1)}s</span>
              </div>
            </div>
          )}
        </div>

        {/* Upload or Progress */}
        {!file ? (
          <div
            className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
              dragOver ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-green-400'
            }`}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Video size={36} className="text-blue-500" />
            </div>
            <div className="text-center">
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }} className="text-gray-700">
                Kéo thả video vào đây
              </p>
              <p className="text-gray-400 mt-1" style={{ fontSize: '0.875rem' }}>
                hoặc click để chọn file
              </p>
              <p className="text-gray-300 mt-2" style={{ fontSize: '0.75rem' }}>
                MP4, MOV, AVI, WebM · Tối đa 200MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* File info */}
            <div className="bg-white rounded-xl border border-blue-100 p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Video size={24} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontWeight: 600 }} className="text-gray-800 truncate">{file.name}</p>
                <p style={{ fontSize: '0.75rem' }} className="text-gray-400 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                </p>
              </div>
              {!loading && (
                <button onClick={handleReset} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                  <RotateCcw size={16} />
                </button>
              )}
            </div>

            {/* Progress */}
            {loading && (
              <div className="bg-white rounded-xl border border-green-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontWeight: 600 }} className="text-gray-700">Đang xử lý video...</span>
                  <span style={{ fontWeight: 700 }} className="text-green-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="h-3 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p style={{ fontSize: '0.75rem' }} className="text-gray-400 mt-2">
                  Xử lý frame theo lô · YOLO detection · conf={conf.toFixed(2)}
                </p>
              </div>
            )}

            {/* Results summary */}
            {result && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Tổng frames', value: result.total_frames, icon: <Layers size={18} /> },
                  { label: 'Thời lượng', value: `${result.duration_seconds.toFixed(1)}s`, icon: <Clock size={18} /> },
                  { label: 'FPS gốc', value: result.fps, icon: <Play size={18} /> },
                  { label: 'Loại phát hiện', value: uniqueClasses.length, icon: <BarChart2 size={18} /> },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl border border-green-100 p-3 flex items-center gap-2">
                    <span className="text-green-500">{s.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800">{s.value}</div>
                      <div style={{ fontSize: '0.65rem' }} className="text-gray-400">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detected classes */}
            {result && uniqueClasses.length > 0 && (
              <div className="bg-white rounded-xl border border-green-100 p-4">
                <p style={{ fontWeight: 600, fontSize: '0.8rem' }} className="text-gray-700 mb-3">
                  Nông sản phát hiện được
                </p>
                <div className="flex flex-wrap gap-2">
                  {uniqueClasses.map(cls => {
                    const meta = getMetadata(cls);
                    return (
                      <span
                        key={cls}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: (meta?.color_tag || '#6b7280') + '20',
                          color: meta?.color_tag || '#6b7280',
                        }}
                      >
                        {meta?.emoji} {meta?.name_vi || cls}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />
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
        <div className="flex gap-3 flex-shrink-0">
          {file && !result && !loading && (
            <button
              onClick={handleDetect}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl"
              style={{ fontWeight: 600 }}
            >
              <Play size={18} />
              Bắt đầu xử lý video
            </button>
          )}
          {result && (
            <>
              <button
                onClick={downloadJSON}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                style={{ fontWeight: 500 }}
              >
                <Download size={16} />
                Tải JSON kết quả
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl"
                style={{ fontWeight: 500 }}
              >
                <RotateCcw size={16} />
                Video mới
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Right: Frame Timeline ── */}
      <div className="w-96 bg-white border-l border-green-100 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-green-100">
          <div className="flex items-center gap-2">
            <Film size={18} className="text-green-600" />
            <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800">Timeline khung hình</h2>
            {framesWithObjects.length > 0 && (
              <span className="ml-auto px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full" style={{ fontWeight: 600, fontSize: '0.75rem' }}>
                {framesWithObjects.length} frames
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!result && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
              <Film size={48} />
              <p style={{ fontSize: '0.875rem' }} className="text-center">
                Xử lý video để xem timeline các frame phát hiện
              </p>
            </div>
          )}

          {framesWithObjects.map((frame) => (
            <button
              key={frame.frame_index}
              onClick={() => setSelectedFrame(frame)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedFrame?.frame_index === frame.frame_index
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-100 hover:border-green-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontWeight: 600, fontSize: '0.8rem' }} className="text-gray-700">
                  Frame #{frame.frame_index}
                </span>
                <span style={{ fontSize: '0.72rem' }} className="text-gray-400">
                  {frame.timestamp.toFixed(2)}s
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {frame.objects.map((obj, i) => {
                  const meta = getMetadata(obj.class_name);
                  return (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded"
                      style={{ fontSize: '0.65rem' }}
                    >
                      {meta?.emoji} {meta?.name_vi || obj.class_name}
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span style={{ fontSize: '0.65rem' }} className="text-gray-400">
                  {frame.objects.length} đối tượng · {frame.inference_time_ms.toFixed(0)}ms
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Frame detail */}
        {selectedFrame && (
          <div className="border-t border-green-100 p-4 bg-green-50 max-h-48 overflow-y-auto">
            <p style={{ fontWeight: 600, fontSize: '0.78rem' }} className="text-green-800 mb-2">
              Frame {selectedFrame.frame_index} · {selectedFrame.objects.length} đối tượng
            </p>
            <div className="space-y-1">
              {selectedFrame.objects.map((obj, i) => {
                const meta = getMetadata(obj.class_name);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span style={{ fontSize: '0.7rem' }}>{meta?.emoji}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 500 }} className="text-gray-700">
                      {meta?.name_vi || obj.class_name}
                    </span>
                    <span
                      className="ml-auto px-1.5 py-0.5 rounded text-white"
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        background: obj.confidence >= 0.85 ? '#22c55e' : obj.confidence >= 0.65 ? '#f59e0b' : '#ef4444'
                      }}
                    >
                      {(obj.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
