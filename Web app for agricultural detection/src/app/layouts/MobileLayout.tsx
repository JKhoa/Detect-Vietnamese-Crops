import { NavLink, Outlet, useLocation } from 'react-router';
import { Home, Camera, ImageIcon, Video, History, Leaf } from 'lucide-react';

interface BottomNavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const bottomNavItems: BottomNavItem[] = [
  { path: '/', label: 'Trang chủ', icon: <Home size={22} /> },
  { path: '/detect/image', label: 'Ảnh', icon: <ImageIcon size={22} /> },
  { path: '/detect/video', label: 'Video', icon: <Video size={22} /> },
  { path: '/history', label: 'Lịch sử', icon: <History size={22} /> },
];

export default function MobileLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    const { pathname } = location;
    if (pathname === '/') return 'NôngSản AI';
    if (pathname.includes('camera')) return 'Camera Realtime';
    if (pathname.includes('image')) return 'Nhận diện Ảnh';
    if (pathname.includes('video')) return 'Xử lý Video';
    if (pathname.includes('history')) return 'Lịch sử';
    if (pathname.includes('architecture')) return 'Kiến trúc hệ thống';
    return 'NôngSản AI';
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f0fdf4] overflow-hidden">
      {/* ── Top Header ── */}
      <header className="bg-white border-b border-green-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
          <Leaf size={15} className="text-white" />
        </div>
        <div>
          <h1 className="text-green-800 leading-none" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {getPageTitle()}
          </h1>
          <p className="text-green-400 mt-0.5" style={{ fontSize: '0.65rem' }}>
            Nhận diện nông sản Việt Nam
          </p>
        </div>
        <div className="ml-auto">
          <span
            className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full"
            style={{ fontSize: '0.6rem', fontWeight: 600 }}
          >
            74 lớp
          </span>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>

      {/* ── Bottom Navigation ── */}
      <nav className="bg-white border-t border-green-100 flex-shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex">
          {bottomNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 transition-colors relative"
              >
                <span
                  className={`transition-colors ${
                    active ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  style={{ fontSize: '0.6rem', fontWeight: active ? 600 : 400 }}
                  className={`transition-colors ${
                    active ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-500 rounded-full" />
                )}
              </NavLink>
            );
          })}
        </div>
        {/* iPhone safe area */}
        <div className="bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      </nav>
    </div>
  );
}