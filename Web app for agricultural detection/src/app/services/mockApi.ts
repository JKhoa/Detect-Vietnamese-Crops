import type {
  ImageDetectionResult,
  VideoDetectionResult,
  DetectedObject,
  HealthCheckResponse,
  DetectionSession,
} from '../types';
import { CLASS_NAMES } from '../data/metadata';

// ── Environment ───────────────────────────────────────────────────────────────
const envApiBase   = import.meta.env.VITE_API_BASE_URL?.trim();
const envWsBase    = import.meta.env.VITE_WS_BASE_URL?.trim();
const GCV_API_KEY  = import.meta.env.VITE_GCV_API_KEY?.trim() || '';
const GCV_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

const isGitHubPages =
  typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

const API_BASE = (envApiBase && envApiBase.length > 0
  ? envApiBase
  : 'http://localhost:8000').replace(/\/$/, '');
const WS_BASE = (envWsBase && envWsBase.length > 0
  ? envWsBase
  : API_BASE.replace(/^http/i, 'ws')).replace(/\/$/, '');

// ── Mode detection ────────────────────────────────────────────────────────────
// USE_GCV  = true → gọi Google Cloud Vision API trực tiếp từ trình duyệt
//            (không cần backend Flask, hoạt động trên GitHub Pages)
// MOCK_MODE = true → dùng data giả lập
// Thứ tự ưu tiên: GCV > Real Backend > Mock
const USE_GCV   = GCV_API_KEY.length > 0;
const MOCK_MODE = !USE_GCV && (
  (isGitHubPages && !envApiBase) ||
  import.meta.env.VITE_MOCK_MODE === 'true'
);

// ── Startup log ───────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  const mode = USE_GCV
    ? '✓ GOOGLE CLOUD VISION (trực tiếp)'
    : MOCK_MODE
      ? '⚠ MOCK (demo data)'
      : '✓ Flask backend';
  console.info(
    `%c[NôngSản AI] API config`,
    'color:#16a34a;font-weight:bold',
    { mode, API_BASE, WS_BASE, isGitHubPages, USE_GCV, MOCK_MODE }
  );
}

export const BACKEND_INFO = {
  apiBase:     API_BASE,
  wsBase:      WS_BASE,
  docsUrl:     USE_GCV ? GCV_ENDPOINT : `${API_BASE}/health`,
  mockMode:    MOCK_MODE,
  useGCV:      USE_GCV,
  isGitHubPages,
};

export const getBackendConnectionHint = () => {
  if (USE_GCV) return 'Đang dùng Google Cloud Vision API.';
  if (MOCK_MODE) return 'Đang chạy chế độ demo (mock).';
  return `Không kết nối được backend tại ${API_BASE}.`;
};

// ─── GCV helpers ──────────────────────────────────────────────────────────────

// Ánh xạ tên GCV (tiếng Anh) → tên class Việt trong hệ thống
const GCV_TO_CLASS: Record<string, string> = {
  'Mango':             'xoai',
  'Pomelo':            'buoi',
  'Dragon fruit':      'thanh_long',
  'Dragonfruit':       'thanh_long',
  'Watermelon':        'dua_hau',
  'Banana':            'chuoi',
  'Orange':            'cam',
  'Tangerine':         'quit',
  'Mandarin orange':   'quit',
  'Mandarin':          'quit',
  'Guava':             'oi',
  'Longan':            'nhan',
  'Lychee':            'vai',
  'Litchi':            'vai',
  'Rambutan':          'chom_chom',
  'Durian':            'sau_rieng',
  'Jackfruit':         'mit',
  'Papaya':            'du_du',
  'Coconut':           'dua',
  'Lime':              'chanh',
  'Lemon':             'chanh',
  'Mangosteen':        'mang_cut',
  'Custard apple':     'na',
  'Sugar apple':       'na',
  'Tamarind':          'me',
  'Carambola':         'khe',
  'Star fruit':        'khe',
  'Starfruit':         'khe',
  'Tomato':            'ca_chua',
  'Sweet potato':      'khoai_lang',
  'Cantaloupe':        'dua_luoi',
  'Melon':             'dua_luoi',
  'Honeydew':          'dua_luoi',
  'Grapefruit':        'buoi',
  'Grape':             'nho',
  'Strawberry':        'dau',
  'Plum':              'man',
  'Peach':             'dao',
  'Apple':             'tao',
  'Pear':              'le',
  'Avocado':           'bo',
  'Passion fruit':     'chanh_day',
  'Soursop':           'mang_cau',
  'Pineapple':         'dua',
  'Pepper':            'ot',
  'Bell pepper':       'ot',
  'Chili pepper':      'ot',
  'Eggplant':          'ca_tim',
  'Bitter melon':      'kho_qua',
  'Squash':            'bi',
  'Pumpkin':           'bi_do',
  'Corn':              'ngo',
  'Cucumber':          'dua_chuot',
  'Taro':              'khoai_mon',
  'Sweet corn':        'ngo',
  'Potato':            'khoai_tay',
};

interface GCVVertex      { x?: number; y?: number }
interface GCVLocalized   { name: string; score: number; boundingPoly: { normalizedVertices: GCVVertex[] } }
interface GCVLabel        { description: string; score: number }
interface GCVResponse    {
  localizedObjectAnnotations?: GCVLocalized[];
  labelAnnotations?: GCVLabel[];
  error?: { code: number; message: string };
}
interface GCVAnnotateResult { responses: GCVResponse[] }

/** File/Blob → base64 string (không có prefix data:...;base64,) */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Lấy kích thước ảnh thực tế từ File */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = reject;
    img.src = url;
  });
}

/** POST base64 image lên GCV và trả về raw JSON */
async function gcvAnnotate(base64Image: string): Promise<GCVAnnotateResult> {
  const res = await fetch(`${GCV_ENDPOINT}?key=${GCV_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64Image },
        features: [
          { type: 'OBJECT_LOCALIZATION', maxResults: 50 },
          { type: 'LABEL_DETECTION',     maxResults: 20 },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GCV API lỗi ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}

/** Chuyển GCV response → DetectedObject[] */
function mapGCVToObjects(
  data: GCVAnnotateResult,
  imgW: number,
  imgH: number,
  confThreshold = 0.0,
): DetectedObject[] {
  const response = data.responses?.[0];
  if (!response || response.error) {
    if (response?.error) throw new Error(`GCV error: ${response.error.message}`);
    return [];
  }

  const extra = (response.labelAnnotations || []).slice(0, 3).map(la => ({
    class_name: GCV_TO_CLASS[la.description] || la.description.toLowerCase().replace(/\s+/g, '_'),
    class_id:   CLASS_NAMES.indexOf(GCV_TO_CLASS[la.description] || ''),
    confidence: Math.round(la.score * 10000) / 10000,
  }));

  return (response.localizedObjectAnnotations || [])
    .filter(loc => loc.score >= confThreshold)
    .map((loc, i) => {
      const className = GCV_TO_CLASS[loc.name] ?? loc.name.toLowerCase().replace(/\s+/g, '_');
      const classId   = CLASS_NAMES.indexOf(className);
      const verts     = loc.boundingPoly.normalizedVertices;
      const xs = verts.map(v => v.x ?? 0);
      const ys = verts.map(v => v.y ?? 0);
      const xMin = Math.min(...xs), xMax = Math.max(...xs);
      const yMin = Math.min(...ys), yMax = Math.max(...ys);

      return {
        id:          `obj_${i}_${Date.now()}`,
        class_id:    classId >= 0 ? classId : i,
        class_name:  className,
        confidence:  Math.round(loc.score * 10000) / 10000,
        bbox: {
          x1:     Math.round(xMin * imgW),
          y1:     Math.round(yMin * imgH),
          x2:     Math.round(xMax * imgW),
          y2:     Math.round(yMax * imgH),
          x_norm: Math.round(xMin  * 10000) / 10000,
          y_norm: Math.round(yMin  * 10000) / 10000,
          w_norm: Math.round((xMax - xMin) * 10000) / 10000,
          h_norm: Math.round((yMax - yMin) * 10000) / 10000,
        },
        top_k: [
          { class_name: className, class_id: classId >= 0 ? classId : 0, confidence: Math.round(loc.score * 10000) / 10000 },
          ...extra.slice(0, 2),
        ],
      } satisfies DetectedObject;
    });
}

// ─── Shared helpers (mock) ────────────────────────────────────────────────────
const sleep       = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;
const randomInt   = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const generateSessionId = () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const generateMockObjects = (count: number, imgW = 640, imgH = 640): DetectedObject[] =>
  Array.from({ length: count }, (_, i) => {
    const classIndex = randomInt(0, CLASS_NAMES.length - 1);
    const className  = CLASS_NAMES[classIndex];
    const x1 = randomInt(50, imgW - 200);
    const y1 = randomInt(50, imgH - 200);
    const x2 = Math.min(x1 + randomInt(80, 200), imgW);
    const y2 = Math.min(y1 + randomInt(80, 200), imgH);
    const conf = randomFloat(0.65, 0.99);
    return {
      id: `obj_${i}_${Date.now()}`,
      class_id: classIndex,
      class_name: className,
      confidence: conf,
      bbox: { x1, y1, x2, y2, x_norm: x1/imgW, y_norm: y1/imgH, w_norm:(x2-x1)/imgW, h_norm:(y2-y1)/imgH },
      top_k: Array.from({ length: 3 }, (_, j) => ({
        class_name:  CLASS_NAMES[(classIndex + j + 1) % CLASS_NAMES.length],
        class_id:    (classIndex + j + 1) % CLASS_NAMES.length,
        confidence:  conf - j * 0.15 - randomFloat(0, 0.05),
      })),
    };
  });

// ── Fetch helper (backend mode) ───────────────────────────────────────────────
async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (networkErr) {
    throw new Error(
      `Không kết nối được backend tại ${API_BASE}.\n` +
      `Kiểm tra: python backend/app.py đang chạy.\nChi tiết: ${networkErr}`
    );
  }
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch (_) { /* ignore */ }
    throw new Error(`Backend lỗi ${res.status} từ ${url}.\n${body ? `Server: ${body.slice(0, 200)}` : ''}`);
  }
  return res;
}

// Mock sessions
let mockSessions: DetectionSession[] = [
  { session_id: 'sess_demo_001', type: 'image',    created_at: new Date(Date.now() - 3600000 * 2).toISOString(), objects_count: 3,  unique_classes: ['xoai', 'chuoi', 'cam'] },
  { session_id: 'sess_demo_002', type: 'video',    created_at: new Date(Date.now() - 3600000 * 5).toISOString(), objects_count: 12, unique_classes: ['thanh_long', 'dua_hau', 'oi'], duration_seconds: 15 },
  { session_id: 'sess_demo_003', type: 'realtime', created_at: new Date(Date.now() - 86400000).toISOString(),    objects_count: 45, unique_classes: ['xoai', 'buoi', 'sau_rieng', 'vai'] },
];

// ─── API Functions ────────────────────────────────────────────────────────────

export const checkHealth = async (): Promise<HealthCheckResponse> => {
  if (USE_GCV) {
    return {
      status: 'healthy',
      model_loaded: true,
      model_path: 'Google Cloud Vision API',
      classes_count: Object.keys(GCV_TO_CLASS).length,
      version: '2.0.0',
      uptime_seconds: 0,
    };
  }
  if (!MOCK_MODE) {
    const res = await apiFetch(`${API_BASE}/health`);
    return res.json();
  }
  await sleep(300);
  return {
    status: 'healthy', model_loaded: true,
    model_path: 'mock', classes_count: 74,
    version: '1.0.0', uptime_seconds: 3600,
  };
};

export const detectImage = async (
  file: File,
  conf    = 0.25,
  iou     = 0.50,
  maxDet  = 100,
): Promise<ImageDetectionResult> => {
  // ── GCV mode ──────────────────────────────────────────────────────────────
  if (USE_GCV) {
    const t0      = Date.now();
    const dims    = await getImageDimensions(file);
    const base64  = await toBase64(file);
    const gcvData = await gcvAnnotate(base64);
    const objects = mapGCVToObjects(gcvData, dims.width, dims.height, conf).slice(0, maxDet);
    const result: ImageDetectionResult = {
      session_id:        generateSessionId(),
      image_width:       dims.width,
      image_height:      dims.height,
      objects,
      inference_time_ms: Date.now() - t0,
      created_at:        new Date().toISOString(),
    };
    mockSessions.unshift({
      session_id:     result.session_id,
      type:           'image',
      created_at:     result.created_at,
      objects_count:  result.objects.length,
      unique_classes: [...new Set(result.objects.map(o => o.class_name))],
    });
    return result;
  }

  // ── Real backend ───────────────────────────────────────────────────────────
  if (!MOCK_MODE) {
    const form = new FormData();
    form.append('file', file);
    form.append('conf', conf.toString());
    form.append('iou',  iou.toString());
    form.append('max_det', maxDet.toString());
    const res = await apiFetch(`${API_BASE}/api/v1/detect/image`, { method: 'POST', body: form });
    return res.json();
  }

  // ── Mock ───────────────────────────────────────────────────────────────────
  await sleep(1200 + Math.random() * 800);
  const objCount = randomInt(1, 5);
  const result: ImageDetectionResult = {
    session_id: generateSessionId(), image_width: 640, image_height: 640,
    objects: generateMockObjects(objCount),
    inference_time_ms: randomFloat(40, 120),
    created_at: new Date().toISOString(),
  };
  mockSessions.unshift({
    session_id: result.session_id, type: 'image', created_at: result.created_at,
    objects_count: result.objects.length,
    unique_classes: [...new Set(result.objects.map(o => o.class_name))],
  });
  return result;
};

export const detectImageUrl = async (
  _imageUrl: string,
  _conf = 0.5,
  _iou  = 0.45,
): Promise<ImageDetectionResult> => {
  await sleep(800);
  return {
    session_id: generateSessionId(), image_width: 640, image_height: 640,
    objects: generateMockObjects(randomInt(1, 4)),
    inference_time_ms: randomFloat(40, 120),
    created_at: new Date().toISOString(),
  };
};

export const detectVideo = async (
  file: File,
  onProgress: (pct: number) => void,
  conf = 0.25,
  iou  = 0.50,
): Promise<VideoDetectionResult> => {
  // ── GCV mode — xử lý từng frame trích từ video ────────────────────────────
  if (USE_GCV) {
    // GCV không hỗ trợ video trực tiếp → dùng backend nếu có, không thì mock
    // Với GitHub Pages thuần (không có backend), hiện thị thông báo
    if (isGitHubPages && !envApiBase) {
      await sleep(2000);
      onProgress(100);
      const frames = Array.from({ length: 5 }, (_, idx) => ({
        frame_index: idx * 30, timestamp: idx,
        objects: generateMockObjects(randomInt(1, 3)),
        inference_time_ms: randomFloat(200, 600),
      }));
      return {
        session_id: generateSessionId(), total_frames: 150, processed_frames: 5,
        fps: 5, duration_seconds: 5, frames,
        created_at: new Date().toISOString(),
      };
    }
    // Nếu có backend thật → chuyển cho backend xử lý
    const form = new FormData();
    form.append('file', file);
    form.append('conf', conf.toString());
    form.append('iou',  iou.toString());
    const res = await apiFetch(`${API_BASE}/api/v1/detect/video`, { method: 'POST', body: form });
    return res.json();
  }

  // ── Real backend ───────────────────────────────────────────────────────────
  if (!MOCK_MODE) {
    const form = new FormData();
    form.append('file', file);
    form.append('conf', conf.toString());
    form.append('iou',  iou.toString());
    const res = await apiFetch(`${API_BASE}/api/v1/detect/video`, { method: 'POST', body: form });
    return res.json();
  }

  // ── Mock ───────────────────────────────────────────────────────────────────
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
    session_id: generateSessionId(), total_frames: totalFrames,
    processed_frames: totalFrames, fps: 30,
    duration_seconds: totalFrames / 30, frames,
    created_at: new Date().toISOString(),
  };
  mockSessions.unshift({
    session_id: result.session_id, type: 'video', created_at: result.created_at,
    objects_count: frames.reduce((s, f) => s + f.objects.length, 0),
    unique_classes: [...new Set(frames.flatMap(f => f.objects.map(o => o.class_name)))],
    duration_seconds: result.duration_seconds,
  });
  return result;
};

export const getSessions = async (): Promise<DetectionSession[]> => {
  if (!MOCK_MODE && !USE_GCV) {
    const res = await fetch(`${API_BASE}/api/v1/sessions`);
    return res.json();
  }
  await sleep(300);
  return [...mockSessions];
};

export const getSession = async (sessionId: string) => {
  if (!MOCK_MODE && !USE_GCV) {
    const res = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}`);
    return res.json();
  }
  await sleep(200);
  return mockSessions.find(s => s.session_id === sessionId) || null;
};

export const getClasses = async (): Promise<{ classes: string[]; count: number }> => {
  if (!MOCK_MODE && !USE_GCV) {
    const res = await fetch(`${API_BASE}/api/v1/metadata/classes`);
    return res.json();
  }
  await sleep(200);
  return { classes: CLASS_NAMES, count: CLASS_NAMES.length };
};

// ─── RealtimeDetectionClient ──────────────────────────────────────────────────
export class RealtimeDetectionClient {
  private wsOrInterval: WebSocket | ReturnType<typeof setInterval> | null = null;
  private frameId  = 0;
  private gcvTimer: ReturnType<typeof setInterval> | null = null;
  private lastBlob: Blob | null = null;
  // canvas dimensions cho GCV mode
  private _canvasW = 640;
  private _canvasH = 480;

  constructor(
    private onFrame: (data: {
      frame_id: number;
      objects: DetectedObject[];
      inference_time_ms: number;
      fps: number;
    }) => void
  ) {}

  connect(canvasWidth = 640, canvasHeight = 480) {
    this._canvasW = canvasWidth;
    this._canvasH = canvasHeight;

    // ── GCV mode: HTTP polling mỗi 1.5s ──────────────────────────────────────
    if (USE_GCV) {
      this.gcvTimer = setInterval(async () => {
        if (!this.lastBlob) return;
        const blob = this.lastBlob;
        const fid  = this.frameId++;
        try {
          const t0     = Date.now();
          const base64 = await toBase64(blob);
          const data   = await gcvAnnotate(base64);
          const objects = mapGCVToObjects(data, this._canvasW, this._canvasH, 0.2);
          const ms     = Date.now() - t0;
          this.onFrame({ frame_id: fid, objects, inference_time_ms: ms, fps: Math.round(1000 / ms) });
        } catch (err) {
          console.warn('[GCV realtime]', err);
          this.onFrame({ frame_id: fid, objects: [], inference_time_ms: 0, fps: 0 });
        }
      }, 1500);
      return;
    }

    // ── Real backend WebSocket ────────────────────────────────────────────────
    if (!MOCK_MODE) {
      const ws = new WebSocket(`${WS_BASE}/api/v1/detect/realtime`);
      ws.binaryType = 'arraybuffer';
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data as string);
        if (data.type === 'connected') return;
        this.onFrame(data);
      };
      ws.onerror = (e) => console.error('[RealtimeDetectionClient] WS error', e);
      this.wsOrInterval = ws;
      return;
    }

    // ── Mock ──────────────────────────────────────────────────────────────────
    this.wsOrInterval = setInterval(() => {
      const objCount = Math.random() > 0.3 ? randomInt(0, 3) : 0;
      this.onFrame({
        frame_id: this.frameId++,
        objects: generateMockObjects(objCount, canvasWidth, canvasHeight),
        inference_time_ms: randomFloat(30, 90),
        fps: randomFloat(18, 30),
      });
    }, 200);
  }

  sendFrame(frame: Blob): boolean {
    if (USE_GCV) {
      this.lastBlob = frame;
      return true;
    }
    if (this.wsOrInterval instanceof WebSocket && this.wsOrInterval.readyState === WebSocket.OPEN) {
      this.wsOrInterval.send(frame);
      return true;
    }
    return false;
  }

  sendConfig(config: { model: string; conf?: number }) {
    if (this.wsOrInterval instanceof WebSocket && this.wsOrInterval.readyState === WebSocket.OPEN) {
      this.wsOrInterval.send(JSON.stringify({ type: 'config', ...config }));
    }
  }

  disconnect() {
    if (this.gcvTimer) { clearInterval(this.gcvTimer); this.gcvTimer = null; }
    if (this.wsOrInterval instanceof WebSocket) {
      this.wsOrInterval.close();
    } else if (this.wsOrInterval) {
      clearInterval(this.wsOrInterval as ReturnType<typeof setInterval>);
    }
    this.wsOrInterval = null;
    this.lastBlob     = null;
    this.frameId      = 0;
  }
}
