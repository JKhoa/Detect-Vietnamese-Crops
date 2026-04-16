import { NavLink, Outlet, useLocation } from 'react-router';
import {
  Home, Camera, ImageIcon, Video, History, Leaf, Activity,
  Settings, ChevronRight, ExternalLink, Cpu, GitBranch,
  AlertTriangle, RefreshCw
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { checkHealth, BACKEND_INFO } from '../services/mockApi';
const USE_GCV = BACKEND_INFO.useGCV;

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Trang chủ', icon: <Home size={20} />, description: 'Giới thiệu hệ thống' },
  { path: '/detect/camera', label: 'Camera Realtime', icon: <Camera size={20} />, description: 'Nhận diện qua camera' },
  { path: '/detect/image', label: 'Upload Ảnh', icon: <ImageIcon size={20} />, description: 'Nhận diện từ ảnh' },
  { path: '/detect/video', label: 'Upload Video', icon: <Video size={20} />, description: 'Xử lý video' },
  { path: '/history', label: 'Lịch sử', icon: <History size={20} />, description: 'Lịch sử nhận diện' },
  { path: '/architecture', label: 'Kiến trúc', icon: <GitBranch size={20} />, description: 'API & hướng dẫn' },
];

interface HealthState {
  status: string;
  model_loaded: boolean;
  classes_count?: number;
  model_path?: string;
  class_sample?: string[];
}

export default function DesktopLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [checking, setChecking] = useState(false);

  const doHealthCheck = useCallback(() => {
    setChecking(true);
    setHealthError(false);
    checkHealth()
      .then((h) => { setHealth(h as HealthState); setHealthError(false); })
      .catch(() => setHealthError(true))
      .finally(() => setChecking(false));
  }, []);

  // GCV mode: không cần health check backend — set healthy ngay lập tức
  useEffect(() => {
    if (USE_GCV) {
      setHealth({ status: 'ok', model_loaded: true, classes_count: 74 });
      return;
    }
    doHealthCheck();
    const timer = setInterval(doHealthCheck, 30_000);
    return () => clearInterval(timer);
  }, [doHealthCheck]);

  const modelBasename = health?.model_path
    ? health.model_path.split(/[\\/]/).pop()
    : null;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#f0fdf4] overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={`flex flex-col bg-white border-r border-green-100 shadow-sm transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-green-100">
          <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow">
            <Leaf size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-green-800 leading-tight" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                NôngSản AI
              </p>
              <p className="text-green-400" style={{ fontSize: '0.65rem' }}>
                Nhận diện thông minh
              </p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1 rounded-lg hover:bg-green-50 text-green-400 hover:text-green-600 transition-colors"
          >
            <ChevronRight
              size={16}
              className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                isActive(item.path)
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <div className="overflow-hidden">
                  <p style={{ fontWeight: 500, fontSize: '0.875rem' }} className="truncate">{item.label}</p>
                  <p
                    style={{ fontSize: '0.7rem' }}
                    className={`truncate ${isActive(item.path) ? 'text-green-200' : 'text-gray-400 group-hover:text-green-500'}`}
                  >
                    {item.description}
                  </p>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status & Footer */}
        <div className="border-t border-green-100 px-3 py-3 space-y-2">
          {!collapsed && (
            <>
              {/* Model status */}
              {health && !healthError ? (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                  health.model_loaded ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    health.model_loaded ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: '0.7rem', fontWeight: 600 }}
                       className={health.model_loaded ? 'text-green-700' : 'text-red-700'}>
                      {health.model_loaded ? 'Mô hình sẵn sàng' : 'Mô hình chưa tải'}
                    </p>
                    <p style={{ fontSize: '0.62rem' }} className="text-gray-400 truncate">
                      {USE_GCV ? 'Cloud Vision API' : `YOLO · ${health.classes_count ?? 74} lớp${modelBasename ? ` · ${modelBasename}` : ''}`}
                    </p>
                  </div>
                  <button onClick={doHealthCheck} title="Kiểm tra lại"
                    className="text-gray-300 hover:text-green-500 flex-shrink-0">
                    <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
                  </button>
                </div>
              ) : healthError && !BACKEND_INFO.mockMode && !USE_GCV ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50">
                  <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: '0.7rem', fontWeight: 600 }} className="text-red-700">
                      Backend không phản hồi
                    </p>
                    <p style={{ fontSize: '0.62rem' }} className="text-red-400 truncate"
                       title={BACKEND_INFO.apiBase}>
                      {BACKEND_INFO.apiBase}
                    </p>
                  </div>
                  <button onClick={doHealthCheck} title="Thử lại"
                    className="text-red-300 hover:text-red-500 flex-shrink-0">
                    <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
                  </button>
                </div>
              ) : null}

              {/* Mode indicator */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                BACKEND_INFO.mockMode ? 'bg-orange-50' : 'bg-green-50'
              }`}>
                <Cpu size={14} className={BACKEND_INFO.mockMode ? 'text-orange-500' : 'text-green-500'} />
                <p style={{ fontSize: '0.7rem' }}
                   className={BACKEND_INFO.mockMode ? 'text-orange-700' : 'text-green-700'}>
                  {BACKEND_INFO.mockMode ? '⚠ Demo Mock Mode' : '✓ Đang hoạt động'}
                </p>
              </div>
            </>
          )}

          {collapsed && (
            <button
              onClick={doHealthCheck}
              className={`w-full flex justify-center p-2 rounded-xl transition-colors ${
                healthError && !BACKEND_INFO.mockMode && !USE_GCV
                  ? 'text-red-400 hover:bg-red-50'
                  : 'text-gray-400 hover:bg-green-50'
              }`}
              title={healthError && !USE_GCV ? 'Backend lỗi — click để thử lại' : 'Trạng thái hệ thống'}
            >
              {healthError && !BACKEND_INFO.mockMode && !USE_GCV
                ? <AlertTriangle size={18} />
                : <Settings size={18} />}
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-green-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-500" style={{ fontSize: '0.8rem' }}>
            <Activity size={14} className="text-green-500" />
            <span>Hệ thống nhận diện nông sản Việt Nam</span>
            <span className="text-green-300">•</span>
            <span className="text-green-600" style={{ fontWeight: 500 }}>v1.0.0</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 bg-green-100 text-green-700 rounded-full"
              style={{ fontSize: '0.72rem', fontWeight: 600 }}
            >
              YOLO Detection
            </span>
            <span
              className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full"
              style={{ fontSize: '0.72rem', fontWeight: 600 }}
            >
              74 Loại nông sản
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}