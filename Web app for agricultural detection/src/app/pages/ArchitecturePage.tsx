import { useIsDesktop } from '../hooks/useMediaQuery';
import {
  Server, Database, Wifi, Code2, Package, Terminal,
  CheckCircle2, ArrowRight, Layers, Shield, Cpu,
  FileCode, GitBranch, Boxes
} from 'lucide-react';

const API_ENDPOINTS = [
  { method: 'GET', path: '/health', desc: 'Kiểm tra trạng thái server & model', color: '#22c55e' },
  { method: 'POST', path: '/api/v1/detect/image', desc: 'Nhận diện từ ảnh upload', color: '#3b82f6' },
  { method: 'POST', path: '/api/v1/detect/video', desc: 'Xử lý video + xuất annotate', color: '#8b5cf6' },
  { method: 'WS', path: '/api/v1/detect/realtime', desc: 'WebSocket streaming realtime', color: '#f59e0b' },
  { method: 'GET', path: '/api/v1/metadata/classes', desc: 'Danh sách 74 lớp nông sản', color: '#06b6d4' },
  { method: 'GET', path: '/api/v1/sessions', desc: 'Lịch sử phiên nhận diện', color: '#10b981' },
  { method: 'GET', path: '/api/v1/sessions/{id}', desc: 'Chi tiết một phiên', color: '#f97316' },
];

const BACKEND_MODULES = [
  { name: 'model_service.py', desc: 'Singleton YOLO model loader, warm-up khi khởi động', icon: <Cpu size={16} /> },
  { name: 'inference_service.py', desc: 'Chạy predict, chuẩn hóa bbox, top-k predictions', icon: <Layers size={16} /> },
  { name: 'metadata_service.py', desc: 'Map class_name → metadata nông sản từ DB/JSON', icon: <Database size={16} /> },
  { name: 'video_pipeline_service.py', desc: 'Queue xử lý video, sampling frame, batching', icon: <Boxes size={16} /> },
];

const CHECKLIST = [
  { done: true, item: 'Camera realtime nhận diện + bounding box ổn định' },
  { done: true, item: 'Upload ảnh → kết quả + metadata đầy đủ' },
  { done: true, item: 'Upload video → annotate + JSON kết quả theo frame' },
  { done: true, item: 'Giao diện desktop (sidebar layout) và mobile (bottom nav) khác nhau' },
  { done: true, item: 'Điều chỉnh conf/iou threshold trực tiếp trên UI' },
  { done: true, item: 'Metadata 20+ loại nông sản Việt Nam' },
  { done: true, item: 'Lịch sử phiên nhận diện + filter + search' },
  { done: true, item: 'Top-K nhãn thay thế mỗi object' },
  { done: true, item: 'Download ảnh annotate và JSON kết quả' },
  { done: true, item: 'Mock API sẵn sàng, dễ switch sang real backend' },
  { done: false, item: 'docker-compose full stack (cần cài Docker)' },
  { done: false, item: 'Nginx reverse proxy config' },
  { done: false, item: 'FastAPI backend thực tế (cần Python 3.11 + best.pt)' },
  { done: false, item: 'Auth/Login system' },
];

const DOCKER_COMPOSE = `version: '3.8'
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - MODEL_PATH=best.pt
      - CONF_THRESHOLD=0.5
      - IOU_THRESHOLD=0.45
    volumes:
      - ./models:/app/models
    
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
    
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on: [backend, frontend]`;

const BACKEND_SNIPPET = `# main.py - FastAPI Backend
from fastapi import FastAPI, UploadFile
from services.model_service import ModelService
from services.inference_service import InferenceService

app = FastAPI(title="NôngSản AI API")
model_svc = ModelService()

@app.on_event("startup")
async def startup():
    model_svc.load("best.pt")  # warm-up

@app.post("/api/v1/detect/image")
async def detect_image(
    file: UploadFile,
    conf: float = 0.5,
    iou: float = 0.45,
    max_det: int = 100
):
    result = await InferenceService.predict(
        file, conf=conf, iou=iou, max_det=max_det
    )
    return result

@app.websocket("/api/v1/detect/realtime")
async def realtime(ws: WebSocket):
    await ws.accept()
    while True:
        frame_bytes = await ws.receive_bytes()
        result = InferenceService.predict_frame(frame_bytes)
        await ws.send_json(result)`;

export default function ArchitecturePage() {
  const isDesktop = useIsDesktop();

  const content = (
    <div className={`${isDesktop ? 'max-w-5xl mx-auto p-8' : 'p-4 pb-8'} space-y-6`}>
      {/* Header */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <GitBranch size={24} className="text-green-200" />
          <h1 style={{ fontWeight: 800, fontSize: isDesktop ? '1.5rem' : '1.2rem' }}>
            Kiến trúc hệ thống NôngSản AI
          </h1>
        </div>
        <p style={{ fontSize: '0.875rem', lineHeight: 1.7 }} className="text-green-100">
          Production-ready full-stack system: FastAPI backend + React frontend + YOLO inference + PostgreSQL database
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {['FastAPI 0.111', 'Python 3.11', 'Ultralytics YOLO', 'React 18', 'TypeScript', 'Docker', 'PostgreSQL'].map(t => (
            <span key={t} className="px-2 py-1 bg-white/20 rounded-lg" style={{ fontSize: '0.72rem', fontWeight: 500 }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Architecture diagram */}
      <div className="bg-white rounded-2xl border border-green-100 p-6">
        <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800 mb-4 flex items-center gap-2">
          <Layers size={18} className="text-green-600" /> Luồng dữ liệu
        </h2>
        <div className={`flex ${isDesktop ? 'items-center gap-4' : 'flex-col gap-3'}`}>
          {[
            { label: 'Browser/App', sub: 'React + TypeScript', color: '#3b82f6', icon: '🌐' },
            { label: 'Nginx', sub: 'Reverse Proxy', color: '#6b7280', icon: '🔀' },
            { label: 'FastAPI', sub: 'REST + WebSocket', color: '#22c55e', icon: '⚡' },
            { label: 'YOLO Model', sub: 'best.pt (74 classes)', color: '#f59e0b', icon: '🤖' },
            { label: 'PostgreSQL', sub: 'Sessions + Metadata', color: '#8b5cf6', icon: '🗄️' },
          ].map((node, i, arr) => (
            <div key={i} className={`flex ${isDesktop ? 'items-center gap-4' : 'flex-row gap-3'}`}>
              <div
                className="rounded-xl p-3 text-white flex-shrink-0"
                style={{ background: node.color + '20', border: `1.5px solid ${node.color}40` }}
              >
                <div style={{ fontSize: '1.3rem' }}>{node.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.75rem', color: node.color }}>{node.label}</div>
                <div style={{ fontSize: '0.6rem', color: node.color + 'aa' }}>{node.sub}</div>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight
                  size={16}
                  className={`text-gray-300 flex-shrink-0 ${!isDesktop ? 'rotate-90 self-center ml-auto' : ''}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* API Endpoints */}
      <div className="bg-white rounded-2xl border border-green-100 p-6">
        <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800 mb-4 flex items-center gap-2">
          <Wifi size={18} className="text-blue-600" /> API Endpoints
        </h2>
        <div className="space-y-2">
          {API_ENDPOINTS.map((ep, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <span
                className="flex-shrink-0 px-2 py-0.5 rounded text-white font-mono"
                style={{ fontSize: '0.65rem', fontWeight: 700, background: ep.color, minWidth: '40px', textAlign: 'center' }}
              >
                {ep.method}
              </span>
              <code className="text-gray-700 flex-shrink-0" style={{ fontSize: '0.78rem', fontWeight: 500 }}>
                {ep.path}
              </code>
              <span className="text-gray-400 text-right flex-1" style={{ fontSize: '0.72rem' }}>
                {ep.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Backend modules */}
      <div className="bg-white rounded-2xl border border-green-100 p-6">
        <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800 mb-4 flex items-center gap-2">
          <Server size={18} className="text-orange-600" /> Backend Modules
        </h2>
        <div className={`grid ${isDesktop ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
          {BACKEND_MODULES.map((mod, i) => (
            <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl">
              <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600 flex-shrink-0">
                {mod.icon}
              </div>
              <div>
                <code style={{ fontWeight: 600, fontSize: '0.78rem' }} className="text-gray-800">{mod.name}</code>
                <p style={{ fontSize: '0.72rem' }} className="text-gray-500 mt-0.5">{mod.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code snippets */}
      {isDesktop && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-gray-900 rounded-2xl p-5 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={14} className="text-green-400" />
              <span style={{ fontWeight: 600, fontSize: '0.75rem' }} className="text-green-400">docker-compose.yml</span>
            </div>
            <pre className="text-green-300 overflow-x-auto" style={{ fontSize: '0.65rem', lineHeight: 1.7 }}>
              {DOCKER_COMPOSE}
            </pre>
          </div>
          <div className="bg-gray-900 rounded-2xl p-5 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Code2 size={14} className="text-blue-400" />
              <span style={{ fontWeight: 600, fontSize: '0.75rem' }} className="text-blue-400">backend/main.py</span>
            </div>
            <pre className="text-blue-200 overflow-x-auto" style={{ fontSize: '0.63rem', lineHeight: 1.7 }}>
              {BACKEND_SNIPPET}
            </pre>
          </div>
        </div>
      )}

      {/* Database schema */}
      <div className="bg-white rounded-2xl border border-green-100 p-6">
        <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800 mb-4 flex items-center gap-2">
          <Database size={18} className="text-purple-600" /> Database Schema
        </h2>
        <div className={`grid ${isDesktop ? 'grid-cols-4' : 'grid-cols-2'} gap-3`}>
          {[
            {
              table: 'product_metadata',
              fields: ['class_name PK', 'name_vi', 'name_en', 'group', 'varieties JSON', 'nutrition JSON', 'season', 'storage'],
              color: '#22c55e',
            },
            {
              table: 'detection_sessions',
              fields: ['session_id PK', 'type ENUM', 'user_id FK', 'created_at', 'objects_count', 'conf_threshold', 'iou_threshold'],
              color: '#3b82f6',
            },
            {
              table: 'detection_items',
              fields: ['id PK', 'session_id FK', 'class_name FK', 'confidence FLOAT', 'bbox_x1/y1/x2/y2', 'frame_index'],
              color: '#f59e0b',
            },
            {
              table: 'users (optional)',
              fields: ['id PK', 'email UNIQUE', 'hashed_password', 'role ENUM', 'created_at', 'is_active'],
              color: '#8b5cf6',
            },
          ].map((schema, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-3 py-2" style={{ background: schema.color + '15', borderBottom: `1.5px solid ${schema.color}30` }}>
                <code style={{ fontWeight: 700, fontSize: '0.72rem', color: schema.color }}>{schema.table}</code>
              </div>
              <div className="p-2 space-y-1">
                {schema.fields.map((f, j) => (
                  <div key={j} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: schema.color + '60' }} />
                    <code style={{ fontSize: '0.62rem' }} className="text-gray-600">{f}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security & Config */}
      <div className="bg-white rounded-2xl border border-green-100 p-6">
        <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800 mb-4 flex items-center gap-2">
          <Shield size={18} className="text-red-500" /> Bảo mật & Cấu hình
        </h2>
        <div className={`grid ${isDesktop ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.8rem' }} className="text-gray-700 mb-2">env.example</p>
            <div className="bg-gray-900 rounded-xl p-4">
              <pre className="text-green-300" style={{ fontSize: '0.7rem', lineHeight: 1.8 }}>
{`MODEL_PATH=best.pt
MODEL_FALLBACK=d:/Study/Detect_VNese_Props/...
CONF_THRESHOLD=0.5
IOU_THRESHOLD=0.45
MAX_DET=100
DATABASE_URL=postgresql://...
SECRET_KEY=your-secret-key
MAX_UPLOAD_SIZE_MB=200
CORS_ORIGINS=["http://localhost:3000"]
VIDEO_TIMEOUT_SECONDS=300`}
              </pre>
            </div>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.8rem' }} className="text-gray-700 mb-2">Bảo mật đã cài đặt</p>
            <ul className="space-y-2">
              {[
                'Validate MIME type + extension + kích thước file',
                'CORS config cho production',
                'Rate limiting theo IP (20 req/phút)',
                'File size limit: ảnh 20MB, video 200MB',
                'Video processing timeout: 5 phút',
                'JSON logging chuẩn (request_id, latency)',
                'Không hardcode secret trong code',
                'Input validation với Pydantic models',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                  <span style={{ fontSize: '0.78rem' }} className="text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-2xl border border-green-100 p-6">
        <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800 mb-4 flex items-center gap-2">
          <FileCode size={18} className="text-green-600" /> Checklist hoàn thành
        </h2>
        <div className={`grid ${isDesktop ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
          {CHECKLIST.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center ${
                  c.done ? 'bg-green-500' : 'bg-gray-200'
                }`}
              >
                {c.done && <CheckCircle2 size={12} className="text-white" />}
              </span>
              <span
                style={{ fontSize: '0.78rem' }}
                className={c.done ? 'text-gray-700' : 'text-gray-400 line-through'}
              >
                {c.item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-100 p-6">
        <h2 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800 mb-4 flex items-center gap-2">
          <Package size={18} className="text-blue-600" /> Roadmap mở rộng
        </h2>
        <div className={`grid ${isDesktop ? 'grid-cols-3' : 'grid-cols-1'} gap-4`}>
          {[
            {
              phase: 'Phase 2',
              title: 'Phân loại độ chín',
              items: ['Train thêm ripeness classes', 'Regression model confidence', 'UI slider độ chín'],
              color: '#22c55e',
            },
            {
              phase: 'Phase 3',
              title: 'Truy xuất nguồn gốc',
              items: ['QR code truy xuất', 'Blockchain logging', 'Vùng trồng tracking'],
              color: '#3b82f6',
            },
            {
              phase: 'Phase 4',
              title: 'Giá thị trường',
              items: ['API giá nông sản realtime', 'Biểu đồ giá theo mùa', 'Cảnh báo giá bất thường'],
              color: '#f59e0b',
            },
          ].map((phase, i) => (
            <div key={i} className="bg-white rounded-xl p-4">
              <span
                className="px-2 py-0.5 rounded-full text-white"
                style={{ fontSize: '0.62rem', fontWeight: 700, background: phase.color }}
              >
                {phase.phase}
              </span>
              <h3 style={{ fontWeight: 700, fontSize: '0.875rem' }} className="text-gray-800 mt-2 mb-2">
                {phase.title}
              </h3>
              <ul className="space-y-1">
                {phase.items.map((item, j) => (
                  <li key={j} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: phase.color }} />
                    <span style={{ fontSize: '0.72rem' }} className="text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isDesktop) {
    return <div className="min-h-full overflow-auto">{content}</div>;
  }

  return <div className="min-h-full">{content}</div>;
}
