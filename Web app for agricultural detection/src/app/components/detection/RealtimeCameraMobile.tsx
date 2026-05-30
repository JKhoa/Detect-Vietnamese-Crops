import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { RealtimeDetectionClient } from '../../services/mockApi';
import type { DetectedObject } from '../../types';
import { PRODUCT_METADATA } from '../../data/metadata';
import ProductMetadataCard from '../product/ProductMetadataCard';

const BOX_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
];

export default function RealtimeCameraMobile() {
  const { videoRef, isActive, error, startCamera, stopCamera, switchCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<RealtimeDetectionClient | null>(null);
  const animRef = useRef<number>(0);
  const objectsRef = useRef<DetectedObject[]>([]);

  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [conf, setConf] = useState(0.3);
  const [modelTarget, setModelTarget] = useState('ensemble');
  const [showSettings, setShowSettings] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const isProcessingRef = useRef(false);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const drawDetections = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !isActive) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    objectsRef.current.forEach((obj, i) => {
      const color = BOX_COLORS[i % BOX_COLORS.length];
      const { x1, y1, x2, y2 } = obj.bbox;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = color + '20';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

      const meta = PRODUCT_METADATA[obj.class_name];
      const label = `${meta?.emoji || ''} ${meta?.name_vi || obj.class_name}`;
      ctx.font = 'bold 11px sans-serif';
      const tw = ctx.measureText(label).width;
      const ly = y1 > 20 ? y1 - 19 : y1 + 1;
      ctx.fillStyle = color + 'cc';
      ctx.fillRect(x1, ly, tw + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x1 + 4, ly + 13);
    });

    animRef.current = requestAnimationFrame(drawDetections);
  }, [isActive, videoRef]);

  useEffect(() => {
    if (isActive) {
      animRef.current = requestAnimationFrame(drawDetections);
    } else {
      cancelAnimationFrame(animRef.current);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isActive, drawDetections]);

  const handleStart = async () => {
    await startCamera('environment');
    const client = new RealtimeDetectionClient((data) => {
      isProcessingRef.current = false;
      const filtered = data.objects.filter(o => o.confidence >= conf);
      objectsRef.current = filtered;
      setObjects([...filtered]);
      setFps(data.fps);
      setLatency(data.inference_time_ms);
    });
    clientRef.current = client;
    setTimeout(() => {
      client.connect(640, 480);
      captureIntervalRef.current = setInterval(() => {
        if (isProcessingRef.current) return;
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        isProcessingRef.current = true;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          isProcessingRef.current = false;
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob && clientRef.current) {
            const sent = clientRef.current.sendFrame(blob);
            if (!sent) {
              isProcessingRef.current = false;
            } else {
              setTimeout(() => { isProcessingRef.current = false; }, 2000);
            }
          } else {
            isProcessingRef.current = false;
          }
        }, 'image/jpeg', 0.9);
      }, 100);
    }, 800);
  };

  const handleStop = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    clientRef.current?.disconnect();
    clientRef.current = null;
    stopCamera();
    setObjects([]);
    objectsRef.current = [];
  };

  useEffect(() => {
    if (clientRef.current) {
      clientRef.current.sendConfig({ model: modelTarget, conf });
    }
  }, [modelTarget, conf]);

  return (
    <div className="flex flex-col h-full">
      {/* Settings bar */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center gap-2 px-4 py-2.5"
          style={{ fontSize: '0.78rem' }}
        >
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className="text-gray-600">
            {isActive ? `🔴 Đang nhận diện · ${fps.toFixed(0)}FPS · ${latency.toFixed(0)}ms` : 'Camera chưa bật'}
          </span>
          <span className="ml-auto text-gray-500" style={{ fontSize: '0.7rem' }}>Conf: {conf.toFixed(2)}</span>
          {showSettings ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>
        {showSettings && (
          <div className="px-4 pb-3 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label style={{ fontSize: '0.75rem' }} className="text-gray-500">Mô hình</label>
              <select
                value={modelTarget}
                onChange={e => setModelTarget(e.target.value)}
                className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none"
              >
                <option value="ensemble">Kết hợp (Chuẩn)</option>
                <option value="primary">Nhanh (Cơ bản)</option>
                <option value="yolov8n">Nhanh (Nông sản)</option>
                <option value="yolov8s">Vừa (Nông sản)</option>
                <option value="yolov8x">Chính xác nhất</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label style={{ fontSize: '0.75rem' }} className="text-gray-500">Độ nhạy</label>
            <input
              type="range" min={0.1} max={0.95} step={0.05}
              value={conf}
              onChange={e => setConf(+e.target.value)}
              className="flex-1 accent-green-500"
            />
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }} className="text-green-600">{conf.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Camera viewport - fixed height on mobile */}
      <div className="relative bg-black flex-shrink-0" style={{ height: '55vw', maxHeight: '300px' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        {!isActive && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Camera size={32} className="text-white/40" />
            <p className="text-white/40" style={{ fontSize: '0.8rem' }}>Nhấn bật để bắt đầu</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-red-300 text-center" style={{ fontSize: '0.75rem' }}>{error}</p>
          </div>
        )}

        {/* Object count overlay */}
        {isActive && (
          <div className="absolute top-2 right-2 flex gap-2">
            <div className="bg-black/60 text-white px-2 py-1 rounded-lg" style={{ fontSize: '0.7rem', fontWeight: 600 }}>
              {objects.length} vật thể
            </div>
          </div>
        )}
      </div>

      {/* Camera controls */}
      <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        {!isActive ? (
          <button
            onClick={handleStart}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl"
            style={{ fontWeight: 600, fontSize: '0.9rem' }}
          >
            <Camera size={18} />
            Bật Camera
          </button>
        ) : (
          <>
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl"
              style={{ fontWeight: 600, fontSize: '0.9rem' }}
            >
              <CameraOff size={18} />
              Dừng
            </button>
            <button
              onClick={switchCamera}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl"
            >
              <RefreshCw size={18} />
            </button>
          </>
        )}
      </div>

      {/* Results panel */}
      <div className="flex-1 overflow-y-auto">
        {isActive && (
          <button
            onClick={() => setShowResults(!showResults)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100"
            style={{ fontSize: '0.8rem', fontWeight: 600 }}
          >
            <span className="text-gray-700">Kết quả nhận diện ({objects.length})</span>
            {showResults ? <ChevronUp size={14} className="ml-auto text-gray-400" /> : <ChevronDown size={14} className="ml-auto text-gray-400" />}
          </button>
        )}

        {showResults && (
          <div className="p-4 space-y-3">
            {isActive && objects.length === 0 && (
              <div className="flex flex-col items-center py-8 gap-2 text-gray-300">
                <div className="w-10 h-10 border-3 border-green-200 border-t-green-500 rounded-full animate-spin" />
                <p style={{ fontSize: '0.8rem' }}>Đang tìm kiếm...</p>
              </div>
            )}
            {objects.map((obj) => (
              <ProductMetadataCard key={obj.id} object={obj} compact />
            ))}
          </div>
        )}

        {!isActive && (
          <div className="flex flex-col items-center py-10 gap-3 text-gray-300 px-6">
            <Camera size={40} />
            <p className="text-center" style={{ fontSize: '0.875rem' }}>
              Bật camera để nhận diện nông sản theo thời gian thực
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
