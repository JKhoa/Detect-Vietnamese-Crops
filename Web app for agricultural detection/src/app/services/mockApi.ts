import type {
  ImageDetectionResult,
  VideoDetectionResult,
  DetectedObject,
  HealthCheckResponse,
  DetectionSession,
} from '../types';
import { CLASS_NAMES } from '../data/metadata';

const API_BASE = 'http://localhost:8000';
// MOCK_MODE: true  → dùng dữ liệu giả (GitHub Pages, không có backend)
//            false → kết nối backend thật (local dev, set VITE_MOCK_MODE=false trong .env.local)
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE !== 'false';

// ─── Helpers ───────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const randomFloat = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const generateSessionId = () =>
  `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const generateMockObjects = (
  count: number,
  imgW = 640,
  imgH = 640
): DetectedObject[] => {
  return Array.from({ length: count }, (_, i) => {
    const classIndex = randomInt(0, CLASS_NAMES.length - 1);
    const className = CLASS_NAMES[classIndex];
    const x1 = randomInt(50, imgW - 200);
    const y1 = randomInt(50, imgH - 200);
    const x2 = x1 + randomInt(80, 200);
    const y2 = y1 + randomInt(80, 200);
    const conf = randomFloat(0.65, 0.99);
    const topK = Array.from({ length: 3 }, (_, j) => ({
      class_name: CLASS_NAMES[(classIndex + j + 1) % CLASS_NAMES.length],
      class_id: (classIndex + j + 1) % CLASS_NAMES.length,
      confidence: conf - j * 0.15 - randomFloat(0, 0.05),
    }));
    return {
      id: `obj_${i}_${Date.now()}`,
      class_id: classIndex,
      class_name: className,
      confidence: conf,
      bbox: {
        x1, y1, x2: Math.min(x2, imgW), y2: Math.min(y2, imgH),
        x_norm: x1 / imgW,
        y_norm: y1 / imgH,
        w_norm: (Math.min(x2, imgW) - x1) / imgW,
        h_norm: (Math.min(y2, imgH) - y1) / imgH,
      },
      top_k: topK,
    };
  });
};

// Mock sessions store
let mockSessions: DetectionSession[] = [
  {
    session_id: 'sess_demo_001',
    type: 'image',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    objects_count: 3,
    unique_classes: ['xoai', 'chuoi', 'cam'],
  },
  {
    session_id: 'sess_demo_002',
    type: 'video',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    objects_count: 12,
    unique_classes: ['thanh_long', 'dua_hau', 'oi'],
    duration_seconds: 15,
  },
  {
    session_id: 'sess_demo_003',
    type: 'realtime',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    objects_count: 45,
    unique_classes: ['xoai', 'buoi', 'sau_rieng', 'vai'],
  },
];

// ─── API Functions ──────────────────────────────────────────────────────────

export const checkHealth = async (): Promise<HealthCheckResponse> => {
  if (!MOCK_MODE) {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  }
  await sleep(300);
  return {
    status: 'healthy',
    model_loaded: true,
    model_path: 'best.pt',
    classes_count: 74,
    version: '1.0.0',
    uptime_seconds: 3600,
  };
};

export const detectImage = async (
  file: File,
  conf = 0.5,
  iou = 0.45,
  maxDet = 100
): Promise<ImageDetectionResult> => {
  if (!MOCK_MODE) {
    const form = new FormData();
    form.append('file', file);
    form.append('conf', conf.toString());
    form.append('iou', iou.toString());
    form.append('max_det', maxDet.toString());
    const res = await fetch(`${API_BASE}/api/v1/detect/image`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  }

  // Mock
  await sleep(1200 + Math.random() * 800);
  const objCount = randomInt(1, 5);
  const result: ImageDetectionResult = {
    session_id: generateSessionId(),
    image_width: 640,
    image_height: 640,
    objects: generateMockObjects(objCount),
    inference_time_ms: randomFloat(40, 120),
    created_at: new Date().toISOString(),
  };

  mockSessions.unshift({
    session_id: result.session_id,
    type: 'image',
    created_at: result.created_at,
    objects_count: result.objects.length,
    unique_classes: [...new Set(result.objects.map((o) => o.class_name))],
  });

  return result;
};

export const detectImageUrl = async (
  imageUrl: string,
  conf = 0.5,
  iou = 0.45
): Promise<ImageDetectionResult> => {
  await sleep(800);
  const result: ImageDetectionResult = {
    session_id: generateSessionId(),
    image_width: 640,
    image_height: 640,
    objects: generateMockObjects(randomInt(1, 4)),
    inference_time_ms: randomFloat(40, 120),
    created_at: new Date().toISOString(),
  };
  return result;
};

export const detectVideo = async (
  file: File,
  onProgress: (pct: number) => void,
  conf = 0.5,
  iou = 0.45
): Promise<VideoDetectionResult> => {
  if (!MOCK_MODE) {
    // Real: use SSE or polling
    const form = new FormData();
    form.append('file', file);
    form.append('conf', conf.toString());
    form.append('iou', iou.toString());
    const res = await fetch(`${API_BASE}/api/v1/detect/video`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  }

  // Mock progress simulation
  const totalFrames = randomInt(150, 300);
  for (let i = 0; i <= 100; i += randomInt(3, 8)) {
    await sleep(200 + Math.random() * 300);
    onProgress(Math.min(i, 98));
  }
  await sleep(400);
  onProgress(100);

  const frames = Array.from({ length: Math.min(totalFrames, 20) }, (_, idx) => ({
    frame_index: idx * Math.floor(totalFrames / 20),
    timestamp: (idx * Math.floor(totalFrames / 20)) / 30,
    objects: Math.random() > 0.3 ? generateMockObjects(randomInt(1, 3)) : [],
    inference_time_ms: randomFloat(30, 100),
  }));

  const result: VideoDetectionResult = {
    session_id: generateSessionId(),
    total_frames: totalFrames,
    processed_frames: totalFrames,
    fps: 30,
    duration_seconds: totalFrames / 30,
    frames,
    created_at: new Date().toISOString(),
  };

  mockSessions.unshift({
    session_id: result.session_id,
    type: 'video',
    created_at: result.created_at,
    objects_count: frames.reduce((s, f) => s + f.objects.length, 0),
    unique_classes: [
      ...new Set(frames.flatMap((f) => f.objects.map((o) => o.class_name))),
    ],
    duration_seconds: result.duration_seconds,
  });

  return result;
};

export const getSessions = async (): Promise<DetectionSession[]> => {
  if (!MOCK_MODE) {
    const res = await fetch(`${API_BASE}/api/v1/sessions`);
    return res.json();
  }
  await sleep(300);
  return [...mockSessions];
};

export const getSession = async (sessionId: string) => {
  if (!MOCK_MODE) {
    const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}`);
    return res.json();
  }
  await sleep(200);
  return mockSessions.find((s) => s.session_id === sessionId) || null;
};

export const getClasses = async (): Promise<{ classes: string[]; count: number }> => {
  if (!MOCK_MODE) {
    const res = await fetch(`${API_BASE}/api/v1/metadata/classes`);
    return res.json();
  }
  await sleep(200);
  return { classes: CLASS_NAMES, count: CLASS_NAMES.length };
};

// ─── WebSocket mock for realtime ────────────────────────────────────────────
export class RealtimeDetectionClient {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frameId = 0;
  private frameCallback: ((data: {
    frame_id: number;
    objects: DetectedObject[];
    inference_time_ms: number;
    fps: number;
  }) => void) | null = null;
  private ws: WebSocket | null = null;

  constructor(private onFrame: (data: {
    frame_id: number;
    objects: DetectedObject[];
    inference_time_ms: number;
    fps: number;
  }) => void) {
    this.frameCallback = onFrame;
  }

  connect(canvasWidth = 640, canvasHeight = 480) {
    if (!MOCK_MODE) {
      this.ws = new WebSocket(`ws://localhost:8000/api/v1/detect/realtime`);
      this.ws.binaryType = 'arraybuffer';
      this.ws.onmessage = (e) => {
        const data = JSON.parse(e.data as string);
        // Skip the initial handshake message from the server
        if (data.type === 'connected') return;
        this.onFrame(data);
      };
      this.ws.onerror = (e) => {
        console.error('[RealtimeDetectionClient] WebSocket error', e);
      };
      return;
    }

    // Mock: simulate detection every ~200ms
    this.interval = setInterval(() => {
      const objCount = Math.random() > 0.3 ? randomInt(0, 3) : 0;
      this.onFrame({
        frame_id: this.frameId++,
        objects: generateMockObjects(objCount, canvasWidth, canvasHeight),
        inference_time_ms: randomFloat(30, 90),
        fps: randomFloat(18, 30),
      });
    }, 200);
  }

  sendFrame(_frame: Blob) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(_frame);
    }
    // In mock mode, we generate results automatically
  }

  disconnect() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.frameId = 0;
  }
}
