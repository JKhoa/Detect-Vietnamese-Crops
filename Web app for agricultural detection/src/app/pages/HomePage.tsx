import { useNavigate } from 'react-router';
import { Camera, ImageIcon, Video, Leaf, ChevronRight, Zap, Shield, BarChart2 } from 'lucide-react';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { PRODUCT_METADATA } from '../data/metadata';

export default function HomePage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const allProducts = Object.values(PRODUCT_METADATA);

  const features = [
    {
      icon: <ImageIcon size={isDesktop ? 28 : 24} />,
      title: 'Upload Ảnh',
      desc: 'Tải lên ảnh JPG/PNG để phân tích chi tiết với thông tin metadata nông sản đầy đủ',
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      path: '/detect/image',
      badge: 'PHÂN TÍCH',
      badgeColor: 'bg-blue-500',
    },
    {
      icon: <Video size={isDesktop ? 28 : 24} />,
      title: 'Upload Video',
      desc: 'Xử lý video MP4/MOV, xuất video annotate và JSON kết quả theo từng frame',
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      path: '/detect/video',
      badge: 'VIDEO AI',
      badgeColor: 'bg-purple-500',
    },
  ];

  const techSpecs = [
    { label: 'Model', value: 'YOLOv8/v11' },
    { label: 'Input size', value: '640×640' },
    { label: 'Classes', value: '74 loại' },
    { label: 'Backend', value: 'FastAPI' },
    { label: 'Inference', value: '<100ms' },
    { label: 'Framework', value: 'Python 3.11' },
  ];

  if (isDesktop) {
    return (
      <div className="min-h-full p-8">
        {/* Hero Section */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl border border-green-100 p-10 mb-8 relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-green-50 rounded-full -translate-y-1/2 translate-x-1/4 opacity-50" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-50 rounded-full translate-y-1/3 -translate-x-1/4 opacity-50" />

            <div className="relative z-10 flex items-center gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Leaf size={28} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-gray-900" style={{ fontWeight: 800, fontSize: '1.8rem', lineHeight: 1.1 }}>
                      NôngSản AI
                    </h1>
                    <p className="text-green-500" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      Hệ thống nhận diện nông sản Việt Nam thông minh
                    </p>
                  </div>
                </div>

                <p className="text-gray-600 mb-6 max-w-xl" style={{ fontSize: '1rem', lineHeight: 1.7 }}>
                  Sử dụng mô hình <strong>YOLO</strong> được huấn luyện trên tập dữ liệu <strong>74 loại nông sản Việt Nam</strong>.
                  Hỗ trợ nhận diện realtime qua camera, upload ảnh và video với metadata chi tiết cho từng loại nông sản.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/detect/image')}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors shadow-sm"
                    style={{ fontWeight: 600 }}
                  >
                    <ImageIcon size={18} />
                    Thử ngay với Ảnh
                  </button>
                  <button
                    onClick={() => navigate('/detect/video')}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-green-200 hover:bg-green-50 text-green-700 rounded-xl transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Video size={18} />
                    Upload Video
                  </button>
                </div>
              </div>

              {/* Tech specs */}
              <div className="flex-shrink-0 w-72">
                <div className="bg-gray-50 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap size={16} className="text-green-500" />
                    <span style={{ fontWeight: 700, fontSize: '0.8rem' }} className="text-gray-700 uppercase tracking-wide">
                      Thông số kỹ thuật
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {techSpecs.map((s, i) => (
                      <div key={i} className="bg-white rounded-xl p-3 border border-gray-100">
                        <div style={{ fontWeight: 700, fontSize: '0.875rem' }} className="text-gray-900">{s.value}</div>
                        <div style={{ fontSize: '0.65rem' }} className="text-gray-400 mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-2 gap-5 mb-8">
            {features.map((f) => (
              <button
                key={f.path}
                onClick={() => navigate(f.path)}
                className="bg-white rounded-2xl border border-green-100 p-6 text-left hover:shadow-md hover:border-green-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 ${f.bg} rounded-2xl flex items-center justify-center ${f.color}`}>
                    {f.icon}
                  </div>
                  <span className={`px-2 py-0.5 ${f.badgeColor} text-white rounded-full`} style={{ fontSize: '0.6rem', fontWeight: 700 }}>
                    {f.badge}
                  </span>
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }} className="text-gray-800 mb-2">{f.title}</h3>
                <p style={{ fontSize: '0.82rem', lineHeight: 1.6 }} className="text-gray-500 mb-4">{f.desc}</p>
                <div className={`flex items-center gap-1 ${f.color} group-hover:gap-2 transition-all`} style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  Bắt đầu <ChevronRight size={14} />
                </div>
              </button>
            ))}
          </div>

          {/* Stats & Benefits */}
          <div className="grid grid-cols-2 gap-5 mb-8">
            <div className="bg-white rounded-2xl border border-green-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={18} className="text-green-600" />
                <h3 style={{ fontWeight: 700 }} className="text-gray-800">Chức năng hệ thống</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  '✅ Upload ảnh với bounding box + metadata',
                  '✅ Xử lý video theo lô frame',
                  '✅ Metadata 20+ loại nông sản Việt Nam',
                  '✅ Lịch sử phiên nhận diện',
                  '✅ Điều chỉnh conf/IoU threshold',
                  '✅ Tải kết quả JSON & ảnh annotate',
                ].map((item, i) => (
                  <li key={i} style={{ fontSize: '0.82rem' }} className="text-gray-600">{item}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-green-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={18} className="text-blue-600" />
                <h3 style={{ fontWeight: 700 }} className="text-gray-800">Metadata nông sản</h3>
              </div>
              <p style={{ fontSize: '0.82rem' }} className="text-gray-500 mb-3">
                Mỗi loại nông sản được nhận diện đi kèm thông tin:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Tên Việt/Anh', 'Giống phổ biến', 'Mùa vụ', 'Vùng trồng', 'Dinh dưỡng', 'Bảo quản', 'Chế biến', 'Độ chín', 'Top-K dự đoán'].map((t, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg" style={{ fontSize: '0.72rem' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Product Gallery */}
          <div className="bg-white rounded-2xl border border-green-100 p-6">
            <h3 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-800 mb-4">
              Danh sách nông sản được hỗ trợ ({allProducts.length}+ loại)
            </h3>
            <div className="flex flex-wrap gap-2">
              {allProducts.map((p) => (
                <span
                  key={p.class_name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border"
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    background: p.color_tag + '15',
                    borderColor: p.color_tag + '40',
                    color: p.color_tag,
                  }}
                >
                  {p.emoji} {p.name_vi}
                </span>
              ))}
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-gray-200 text-gray-400"
                style={{ fontSize: '0.78rem' }}
              >
                +54 loại khác...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile Layout ──
  return (
    <div className="p-4 pb-6 space-y-4">
      {/* Hero */}
      <div className="bg-white rounded-2xl border border-green-100 p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -translate-y-1/2 translate-x-1/4 opacity-60" />
        <div className="relative z-10">
          <p className="text-green-500 mb-2" style={{ fontSize: '0.78rem', fontWeight: 500 }}>
            Nhận diện nông sản Việt Nam
          </p>
          <h1 style={{ fontWeight: 800, fontSize: '1.4rem' }} className="text-gray-900 mb-2">
            NôngSản AI 🌿
          </h1>
          <p className="text-gray-500 mb-4" style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            Mô hình <strong>YOLO</strong> nhận diện <strong>74 loại</strong> nông sản Việt Nam.
            Hỗ trợ camera, ảnh và video.
          </p>
          <button
            onClick={() => navigate('/detect/image')}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl"
            style={{ fontWeight: 600 }}
          >
            <ImageIcon size={18} />
            Bắt đầu nhận diện
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="space-y-3">
        {features.map((f) => (
          <button
            key={f.path}
            onClick={() => navigate(f.path)}
            className="w-full bg-white rounded-2xl border border-green-100 p-4 flex items-center gap-4 text-left active:bg-green-50"
          >
            <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center ${f.color} flex-shrink-0`}>
              {f.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }} className="text-gray-800">{f.title}</h3>
                <span className={`px-1.5 py-0.5 ${f.badgeColor} text-white rounded`} style={{ fontSize: '0.55rem', fontWeight: 700 }}>
                  {f.badge}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', lineHeight: 1.5 }} className="text-gray-500 mt-0.5 line-clamp-2">{f.desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: '74', l: 'Loại nông sản' },
          { v: '<100ms', l: 'Inference' },
          { v: 'YOLO', l: 'AI Model' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-green-100 p-3 text-center">
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }} className="text-green-700">{s.v}</div>
            <div style={{ fontSize: '0.6rem' }} className="text-gray-400 mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Product list */}
      <div className="bg-white rounded-2xl border border-green-100 p-4">
        <p style={{ fontWeight: 700, fontSize: '0.875rem' }} className="text-gray-800 mb-3">
          Nông sản hỗ trợ
        </p>
        <div className="flex flex-wrap gap-1.5">
          {allProducts.slice(0, 12).map((p) => (
            <span
              key={p.class_name}
              className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{
                fontSize: '0.7rem',
                background: p.color_tag + '20',
                color: p.color_tag,
              }}
            >
              {p.emoji} {p.name_vi}
            </span>
          ))}
          <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-400" style={{ fontSize: '0.7rem' }}>
            +{allProducts.length - 12 + 54} khác
          </span>
        </div>
      </div>
    </div>
  );
}
