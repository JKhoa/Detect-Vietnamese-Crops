import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, CameraOff, RefreshCw, Sliders, Activity,
  AlertCircle, Wifi, WifiOff
} from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { RealtimeDetectionClient } from '../../services/mockApi';
import type { DetectedObject } from '../../types';
import { PRODUCT_METADATA } from '../../data/metadata';
import ProductMetadataCard from '../product/ProductMetadataCard';

const BOX_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#f97316', '#10b981', '#ef4444', '#84cc16',
];

export default function RealtimeCameraDesktop() {
  const { videoRef, isActive, facingMode, error, startCamera, stopCamera, switchCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<RealtimeDetectionClient | null>(null);
  const animRef = useRef<number>(0);

  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [conf, setConf] = useState(0.5);
  const [iou, setIou] = useState(0.45);
  const [connected, setConnected] = useState(false);
  const [selectedObj, setSelectedObj] = useState<DetectedObject | null>(null);
  const objectsRef = useRef<DetectedObject[]>([]);
  const videoSize = useRef({ w: 640, h: 480 });
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
      videoSize.current = { w, h };
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    objectsRef.current.forEach((obj, i) => {
      const color = BOX_COLORS[i % BOX_COLORS.length];
      const { x1, y1, x2, y2 } = obj.bbox;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.shadowBlur = 0;

      ctx.fillStyle = color + '25';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

      const meta = PRODUCT_METADATA[obj.class_name];
      const label = `${meta?.emoji || '🌿'} ${meta?.name_vi || obj.class_name} ${(obj.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 11px Inter, sans-serif';
      const tw = ctx.measureText(label).width;
      const lh = 18;
      const ly = y1 > lh + 2 ? y1 - lh - 1 : y1 + 2;
      ctx.fillStyle = color + 'dd';
      ctx.beginPath();
      ctx.roundRect(x1, ly, tw + 10, lh, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x1 + 5, ly + lh - 5);
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
    await startCamera(facingMode);
    const client = new RealtimeDetectionClient((data) => {
      // Filter by conf threshold on the received detection
      const filtered = data.objects.filter(o => o.confidence >= conf);
      objectsRef.current = filtered;
      setObjects([...filtered]);
      setFps(data.fps);
      setLatency(data.inference_time_ms);
    });
    clientRef.current = client;

    setTimeout(() => {
      client.connect(videoSize.current.w, videoSize.current.h);
      setConnected(true);

      // Capture a frame from the video element every 100ms (10fps) and send to backend
      captureIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        const currentClient = clientRef.current;
        if (!video || !currentClient || video.readyState < 2) return;

        const w = video.videoWidth || videoSize.current.w;
        const h = video.videoHeight || videoSize.current.h;

        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        offscreen.toBlob((blob) => {
          if (blob) currentClient.sendFrame(blob);
        }, 'image/jpeg', 0.75);
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
    setConnected(false);
    setSelectedObj(null);
  };

  // Update conf threshold live
  useEffect(() => {
    if (objectsRef.current.length > 0) {
      const filtered = objectsRef.current.filter(o => o.confidence >= conf);
      setObjects(filtered);
    }
  }, [conf]);

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Left: Video + Controls ── */}
      <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        {/* Controls bar */}
        <div className="bg-white rounded-xl border border-green-100 px-4 py-3 flex items-center gap-5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            {connected ? (
              <><Wifi size={14} className="text-green-500" /><span style={{ fontSize: '0.75rem', fontWeight: 600 }} className="text-green-600">Đang stream</span></>
            ) : (
              <><WifiOff size={14} className="text-gray-400" /><span style={{ fontSize: '0.75rem' }} className="text-gray-400">Chưa kết nối</span></>
            )}
          </div>
          {connected && (
            <>
              <div className="flex items-center gap-1.5">
                <Activity size={14} className="text-blue-500" />
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className="text-blue-600">{fps.toFixed(1)} FPS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: '0.75rem' }} className="text-gray-500">Latency:</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className={latency > 80 ? 'text-red-500' : 'text-green-600'}>
                  {latency.toFixed(0)}ms
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: '0.75rem' }} className="text-gray-500">Objects:</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className="text-gray-700">{objects.length}</span>
              </div>
            </>
          )}
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Sliders size={14} className="text-gray-400" />
              <span style={{ fontSize: '0.75rem' }} className="text-gray-500">Conf</span>
              <input
                type="range" min={0.1} max={0.95} step={0.05}
                value={conf}
                onChange={e => setConf(+e.target.value)}
                className="w-20 accent-green-500"
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className="text-green-700">{conf.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '0.75rem' }} className="text-gray-500">IoU</span>
              <input
                type="range" min={0.1} max={0.9} step={0.05}
                value={iou}
                onChange={e => setIou(+e.target.value)}
                className="w-20 accent-green-500"
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className="text-green-700">{iou.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Video area */}
        <div className="flex-1 bg-black rounded-2xl overflow-hidden relative min-h-0">
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
          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center">
                <Camera size={40} className="text-white/60" />
              </div>
              <p className="text-white/60" style={{ fontSize: '0.875rem' }}>
                Camera chưa được bật
              </p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
              <AlertCircle size={40} className="text-red-400" />
              <p className="text-red-300 text-center" style={{ fontSize: '0.875rem' }}>{error}</p>
            </div>
          )}
        </div>

        {/* Camera buttons */}
        <div className="flex gap-3 flex-shrink-0">
          {!isActive ? (
            <button
              onClick={handleStart}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
              style={{ fontWeight: 600 }}
            >
              <Camera size={18} />
              Bật camera & Nhận diện
            </button>
          ) : (
            <>
              <button
                onClick={handleStop}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
                style={{ fontWeight: 600 }}
              >
                <CameraOff size={18} />
                Dừng camera
              </button>
              <button
                onClick={switchCamera}
                className="flex items-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors"
              >
                <RefreshCw size={16} />
                Đổi camera
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Right: Detection Results ── */}
      <div className="w-96 bg-white border-l border-green-100 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-green-100">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-green-600" />
            <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800">Phát hiện realtime</h2>
            {objects.length > 0 && (
              <span className="ml-auto px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full animate-pulse" style={{ fontWeight: 600, fontSize: '0.75rem' }}>
                {objects.length} đối tượng
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!isActive && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
              <Camera size={48} />
              <p style={{ fontSize: '0.875rem' }} className="text-center">
                Bật camera để xem kết quả nhận diện realtime
              </p>
            </div>
          )}
          {isActive && objects.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
              <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full animate-spin" />
              <p style={{ fontSize: '0.875rem' }}>Đang tìm kiếm nông sản...</p>
            </div>
          )}
          {objects.map((obj) => (
            <div
              key={obj.id}
              className={`cursor-pointer rounded-xl transition-all ${
                selectedObj?.id === obj.id ? 'ring-2 ring-green-500' : ''
              }`}
              onClick={() => setSelectedObj(selectedObj?.id === obj.id ? null : obj)}
            >
              <ProductMetadataCard object={obj} compact={selectedObj?.id !== obj.id} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
