import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  History, Camera, ImageIcon, Video, Clock, Layers,
  RefreshCw, Filter, Search, ArrowRight, ChevronRight
} from 'lucide-react';
import type { DetectionSession } from '../types';
import { getSessions } from '../services/mockApi';
import { getMetadata } from '../data/metadata';
import { useIsDesktop } from '../hooks/useMediaQuery';

const TYPE_CONFIG = {
  image: { icon: <ImageIcon size={14} />, label: 'Ảnh', color: 'text-blue-600', bg: 'bg-blue-100' },
  video: { icon: <Video size={14} />, label: 'Video', color: 'text-purple-600', bg: 'bg-purple-100' },
  realtime: { icon: <Camera size={14} />, label: 'Camera', color: 'text-green-600', bg: 'bg-green-100' },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  return `${days} ngày trước`;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<DetectionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'realtime'>('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSessions();
      setSessions(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = sessions.filter(s => {
    const matchType = filter === 'all' || s.type === filter;
    const matchSearch = search === '' || s.unique_classes.some(c => {
      const meta = getMetadata(c);
      return meta?.name_vi.toLowerCase().includes(search.toLowerCase()) ||
             c.toLowerCase().includes(search.toLowerCase());
    });
    return matchType && matchSearch;
  });

  const SessionCard = ({ session }: { session: DetectionSession }) => {
    const tc = TYPE_CONFIG[session.type];
    return (
      <div
        className={`bg-white rounded-xl border border-gray-100 hover:border-green-200 transition-all cursor-pointer ${
          isDesktop ? 'p-5' : 'p-4'
        }`}
        onClick={() => navigate(`/history/${session.session_id}`)}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 ${tc.bg} rounded-xl flex items-center justify-center ${tc.color} flex-shrink-0`}>
            {tc.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }} className="text-gray-800">
                {tc.label} · {session.objects_count} đối tượng
              </span>
              {session.duration_seconds && (
                <span style={{ fontSize: '0.7rem' }} className="text-gray-400">
                  · {session.duration_seconds.toFixed(0)}s
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Clock size={12} className="text-gray-300" />
              <span style={{ fontSize: '0.72rem' }} className="text-gray-400">
                {formatRelativeTime(session.created_at)}
              </span>
            </div>
            {/* Classes */}
            <div className="flex flex-wrap gap-1 mt-2">
              {session.unique_classes.slice(0, isDesktop ? 6 : 4).map(cls => {
                const meta = getMetadata(cls);
                return (
                  <span
                    key={cls}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg"
                    style={{
                      fontSize: '0.65rem',
                      background: (meta?.color_tag || '#6b7280') + '20',
                      color: meta?.color_tag || '#6b7280',
                    }}
                  >
                    {meta?.emoji} {meta?.name_vi || cls}
                  </span>
                );
              })}
              {session.unique_classes.length > (isDesktop ? 6 : 4) && (
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-lg" style={{ fontSize: '0.65rem' }}>
                  +{session.unique_classes.length - (isDesktop ? 6 : 4)} khác
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />
        </div>
        {isDesktop && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-4">
            <span style={{ fontSize: '0.7rem' }} className="text-gray-400 font-mono">
              {session.session_id}
            </span>
            <div className="ml-auto flex items-center gap-1.5 text-green-600 hover:text-green-700" style={{ fontSize: '0.75rem', fontWeight: 500 }}>
              Xem chi tiết <ArrowRight size={12} />
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isDesktop) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <History size={20} className="text-green-600" />
              </div>
              <div>
                <h1 style={{ fontWeight: 700, fontSize: '1.3rem' }} className="text-gray-900">Lịch sử nhận diện</h1>
                <p style={{ fontSize: '0.8rem' }} className="text-gray-400">{sessions.length} phiên</p>
              </div>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-green-200 rounded-xl hover:bg-green-50 text-green-700 transition-colors"
              style={{ fontWeight: 500, fontSize: '0.875rem' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Tải lại
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-green-100 p-4 mb-6 flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                placeholder="Tìm theo tên nông sản..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 outline-none text-gray-700 placeholder:text-gray-300"
                style={{ fontSize: '0.875rem' }}
              />
            </div>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-1">
              <Filter size={14} className="text-gray-400 mr-1" />
              {(['all', 'image', 'video', 'realtime'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filter === t ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={{ fontSize: '0.75rem', fontWeight: filter === t ? 600 : 400 }}
                >
                  {t === 'all' ? 'Tất cả' : TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Tổng phiên', value: sessions.length, icon: <Layers size={18} className="text-green-500" /> },
              { label: 'Phiên ảnh', value: sessions.filter(s => s.type === 'image').length, icon: <ImageIcon size={18} className="text-blue-500" /> },
              { label: 'Phiên video', value: sessions.filter(s => s.type === 'video').length, icon: <Video size={18} className="text-purple-500" /> },
              { label: 'Phiên camera', value: sessions.filter(s => s.type === 'realtime').length, icon: <Camera size={18} className="text-orange-500" /> },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-green-100 p-4 flex items-center gap-3">
                {s.icon}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.4rem' }} className="text-gray-800">{s.value}</div>
                  <div style={{ fontSize: '0.7rem' }} className="text-gray-400">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Sessions list */}
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <RefreshCw size={20} className="animate-spin" />
              <span>Đang tải lịch sử...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-300">
              <History size={48} className="mx-auto mb-3" />
              <p style={{ fontWeight: 500 }}>Chưa có lịch sử nhận diện</p>
              <p style={{ fontSize: '0.875rem' }} className="mt-1">Bắt đầu nhận diện để tạo lịch sử</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(s => <SessionCard key={s.session_id} session={s} />)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Mobile ──
  return (
    <div className="flex flex-col min-h-full">
      {/* Search */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-gray-400" />
          <input
            type="text"
            placeholder="Tìm nông sản..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 outline-none bg-transparent text-gray-700 placeholder:text-gray-300"
            style={{ fontSize: '0.875rem' }}
          />
        </div>
        {/* Filter pills */}
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {(['all', 'image', 'video', 'realtime'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full transition-colors ${
                filter === t ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
              style={{ fontSize: '0.72rem', fontWeight: filter === t ? 600 : 400 }}
            >
              {t === 'all' ? 'Tất cả' : TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <RefreshCw size={18} className="animate-spin" />
            <span style={{ fontSize: '0.875rem' }}>Đang tải...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <History size={40} className="mx-auto mb-3" />
            <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>Chưa có lịch sử</p>
          </div>
        ) : (
          filtered.map(s => <SessionCard key={s.session_id} session={s} />)
        )}
      </div>

      {/* Refresh button */}
      <div className="p-4 bg-white border-t border-gray-100">
        <button
          onClick={load}
          className="w-full flex items-center justify-center gap-2 py-3 border border-green-200 rounded-xl text-green-700"
          style={{ fontWeight: 500, fontSize: '0.875rem' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Tải lại
        </button>
      </div>
    </div>
  );
}
