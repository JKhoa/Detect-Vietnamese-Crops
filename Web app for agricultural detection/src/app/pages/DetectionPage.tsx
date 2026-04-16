import { useParams, useNavigate } from 'react-router';
import { Camera, ImageIcon, Video } from 'lucide-react';
import { useIsDesktop } from '../hooks/useMediaQuery';

// Desktop components
import RealtimeCameraDesktop from '../components/detection/RealtimeCameraDesktop';
import ImageUploadDesktop from '../components/detection/ImageUploadDesktop';
import VideoUploadDesktop from '../components/detection/VideoUploadDesktop';

// Mobile components
import RealtimeCameraMobile from '../components/detection/RealtimeCameraMobile';
import ImageUploadMobile from '../components/detection/ImageUploadMobile';
import VideoUploadMobile from '../components/detection/VideoUploadMobile';

type TabKey = 'camera' | 'image' | 'video';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; mobileLabel: string }[] = [
  { key: 'camera', label: 'Camera Realtime', mobileLabel: 'Camera', icon: <Camera size={16} /> },
  { key: 'image', label: 'Upload Ảnh', mobileLabel: 'Ảnh', icon: <ImageIcon size={16} /> },
  { key: 'video', label: 'Upload Video', mobileLabel: 'Video', icon: <Video size={16} /> },
];

export default function DetectionPage() {
  const { mode } = useParams<{ mode: TabKey }>();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const activeTab: TabKey = (mode as TabKey) || 'camera';

  const handleTab = (key: TabKey) => navigate(`/detect/${key}`);

  if (isDesktop) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="bg-white border-b border-green-100 px-6 flex gap-1 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-green-600 hover:bg-green-50'
              }`}
              style={{ fontWeight: activeTab === tab.key ? 600 : 400, fontSize: '0.875rem' }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'camera' && <RealtimeCameraDesktop />}
          {activeTab === 'image' && <ImageUploadDesktop />}
          {activeTab === 'video' && <VideoUploadDesktop />}
        </div>
      </div>
    );
  }

  // ── Mobile: No tab bar needed (navigation is in bottom nav) ──
  // Just render the active mode content
  return (
    <div className="h-full overflow-y-auto">
      {activeTab === 'camera' && <RealtimeCameraMobile />}
      {activeTab === 'image' && <ImageUploadMobile />}
      {activeTab === 'video' && <VideoUploadMobile />}
    </div>
  );
}
