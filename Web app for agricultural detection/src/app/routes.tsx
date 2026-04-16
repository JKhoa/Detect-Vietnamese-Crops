import { createBrowserRouter, Navigate } from 'react-router';
import AppShell from './layouts/AppShell';
import HomePage from './pages/HomePage';
import DetectionPage from './pages/DetectionPage';
import HistoryPage from './pages/HistoryPage';
import ArchitecturePage from './pages/ArchitecturePage';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 p-8">
      <span style={{ fontSize: '4rem' }}>🌿</span>
      <p style={{ fontWeight: 700, fontSize: '1.2rem' }} className="text-gray-700">
        Trang không tồn tại
      </p>
      <a href={import.meta.env.BASE_URL} className="text-green-600 hover:underline" style={{ fontSize: '0.875rem' }}>
        Về trang chủ
      </a>
    </div>
  );
}

export const router = createBrowserRouter(
  [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: HomePage },
      { path: 'detect', element: <Navigate to="/detect/camera" replace /> },
      { path: 'detect/:mode', Component: DetectionPage },
      { path: 'history', Component: HistoryPage },
      { path: 'history/:sessionId', Component: HistoryPage },
      { path: 'architecture', Component: ArchitecturePage },
      { path: '*', Component: NotFound },
    ],
  },
  ],
  { basename: import.meta.env.BASE_URL }
);