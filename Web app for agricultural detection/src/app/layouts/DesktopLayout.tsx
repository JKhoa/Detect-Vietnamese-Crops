import { NavLink, Outlet, useLocation } from 'react-router';
import {
  Home, Camera, ImageIcon, Video, History, Leaf, Activity,
  Settings, ChevronRight, ExternalLink, Cpu, GitBranch
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { checkHealth } from '../services/mockApi';

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

export default function DesktopLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState<{ status: string; model_loaded: boolean } | null>(null);

  useEffect(() => {
    checkHealth().then(setHealth).catch(() => null);
  }, []);

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
          {!collapsed && health && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                health.model_loaded ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  health.model_loaded ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <div>
                <p
                  style={{ fontSize: '0.7rem', fontWeight: 600 }}
                  className={health.model_loaded ? 'text-green-700' : 'text-red-700'}
                >
                  {health.model_loaded ? 'Mô hình sẵn sàng' : 'Mô hình chưa tải'}
                </p>
                <p style={{ fontSize: '0.62rem' }} className="text-gray-400">
                  YOLO · 74 lớp
                </p>
              </div>
            </div>
          )}
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50">
              <Cpu size={14} className="text-orange-500 flex-shrink-0" />
              <p style={{ fontSize: '0.7rem' }} className="text-orange-700">
                FastAPI Backend
              </p>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-orange-400 hover:text-orange-600"
              >
                <ExternalLink size={12} />
              </a>
            </div>
          )}
          {collapsed && (
            <button className="w-full flex justify-center p-2 rounded-xl hover:bg-green-50 text-gray-400">
              <Settings size={18} />
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