import { useState, useRef, useCallback } from 'react';
import { Upload, Video, Play, AlertCircle, RotateCcw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { VideoDetectionResult } from '../../types';
import { detectVideo } from '../../services/mockApi';
import { getMetadata } from '../../data/metadata';

export default function VideoUploadMobile() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VideoDetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [conf, setConf] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/avi', 'video/x-msvideo', 'video/webm'];
    if (!allowed.includes(f.type)) {
      setError('Định dạng không hỗ trợ. Dùng MP4, MOV, AVI.');
      return;
    }
    setError(null);
    setResult(null);
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
    } catch {
      setError('Lỗi xử lý video.');
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `detection_${result.session_id}.json`;
    a.click();
  };

  const uniqueClasses = result
    ? [...new Set(result.frames.flatMap(f => f.objects.map(o => o.class_name)))]
    : [];

  const framesWithObjects = result?.frames.filter(f => f.objects.length > 0) || [];

  return (
    <div className="flex flex-col min-h-full">
      {/* Settings */}
      <div className="bg-white border-b border-gray-100">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center gap-2 px-4 py-3"
          style={{ fontSize: '0.8rem' }}
        >
          <span className="text-gray-600">⚙️ Conf: {conf.toFixed(2)}</span>
          {showSettings ? <ChevronUp size={14} className="ml-auto text-gray-400" /> : <ChevronDown size={14} className="ml-auto text-gray-400" />}
        </button>
        {showSettings && (
          <div className="px-4 pb-3 flex items-center gap-3">
            <label style={{ fontSize: '0.75rem' }} className="text-gray-500">Confidence</label>
            <input type="range" min={0.1} max={0.95} step={0.05} value={conf} onChange={e => setConf(+e.target.value)} className="flex-1 accent-green-500" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }} className="text-green-600">{conf.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Upload zone */}
      {!file ? (
        <div
          className="mx-4 mt-4 border-2 border-dashed border-gray-200 rounded-2xl bg-white flex flex-col items-center justify-center gap-3 py-10 cursor-pointer active:bg-blue-50"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
            <Video size={28} className="text-blue-500" />
          </div>
          <div className="text-center px-4">
            <p style={{ fontWeight: 600, fontSize: '0.95rem' }} className="text-gray-700">Chọn video</p>
            <p className="text-gray-400 mt-1" style={{ fontSize: '0.8rem' }}>MP4, MOV, AVI · Tối đa 200MB</p>
          </div>
          <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="mx-4 mt-4 bg-white rounded-2xl border border-blue-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Video size={20} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontWeight: 600, fontSize: '0.875rem' }} className="text-gray-800 truncate">{file.name}</p>
            <p style={{ fontSize: '0.72rem' }} className="text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          {!loading && (
            <button onClick={() => { setFile(null); setResult(null); setError(null); }} className="p-2 text-gray-400">
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      )}

      {/* Progress */}
      {loading && (
        <div className="mx-4 mt-4 bg-white rounded-2xl border border-green-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }} className="text-gray-700">Đang xử lý...</span>
            <span style={{ fontWeight: 700 }} className="text-green-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className="h-2.5 bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p style={{ fontSize: '0.7rem' }} className="text-gray-400 mt-2">Phân tích frame · conf={conf}</p>
        </div>
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
          <button onClick={handleDetect} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white rounded-xl" style={{ fontWeight: 600 }}>
            <Play size={18} />
            Xử lý video
          </button>
        )}
        {loading && (
          <div className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-green-100 rounded-xl text-green-700">
            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            Đang xử lý...
          </div>
        )}
        {!file && !loading && (
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-xl" style={{ fontWeight: 600 }}>
            <Upload size={18} />
            Chọn file
          </button>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="px-4 mt-4 pb-4 space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Tổng frames', value: result.total_frames },
              { label: 'Thời lượng', value: `${result.duration_seconds.toFixed(1)}s` },
              { label: 'FPS', value: result.fps },
              { label: 'Loại phát hiện', value: uniqueClasses.length },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-green-100 p-3 text-center">
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }} className="text-green-700">{s.value}</div>
                <div style={{ fontSize: '0.65rem' }} className="text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Detected classes */}
          {uniqueClasses.length > 0 && (
            <div className="bg-white rounded-xl border border-green-100 p-4">
              <p style={{ fontWeight: 600, fontSize: '0.85rem' }} className="text-gray-700 mb-2">Nông sản phát hiện</p>
              <div className="flex flex-wrap gap-1.5">
                {uniqueClasses.map(cls => {
                  const meta = getMetadata(cls);
                  return (
                    <span key={cls} className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg" style={{ fontSize: '0.72rem', fontWeight: 500 }}>
                      {meta?.emoji} {meta?.name_vi || cls}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Frame list */}
          {framesWithObjects.length > 0 && (
            <div className="bg-white rounded-xl border border-green-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p style={{ fontWeight: 600, fontSize: '0.85rem' }} className="text-gray-700">
                  Timeline ({framesWithObjects.length} frames có phát hiện)
                </p>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {framesWithObjects.map(frame => (
                  <div key={frame.frame_index} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '0.7rem', fontWeight: 600 }} className="text-gray-600">
                        Frame #{frame.frame_index}
                      </span>
                      <span style={{ fontSize: '0.65rem' }} className="text-gray-400">{frame.timestamp.toFixed(2)}s</span>
                      <span style={{ fontSize: '0.65rem' }} className="ml-auto text-gray-400">{frame.objects.length} obj</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {frame.objects.map((obj, i) => {
                        const meta = getMetadata(obj.class_name);
                        return (
                          <span key={i} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded" style={{ fontSize: '0.6rem' }}>
                            {meta?.emoji} {meta?.name_vi || obj.class_name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download */}
          <button onClick={downloadJSON} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl" style={{ fontWeight: 500 }}>
            <Download size={16} />
            Tải JSON kết quả
          </button>
        </div>
      )}
    </div>
  );
}
