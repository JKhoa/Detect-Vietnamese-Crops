import { useState } from 'react';
import {
  Leaf, Globe, Calendar, MapPin, Heart, Package, ChefHat,
  Sun, TrendingUp, ChevronDown, ChevronUp, Star, Info
} from 'lucide-react';
import type { DetectedObject } from '../../types';
import { getMetadata } from '../../data/metadata';

interface Props {
  object: DetectedObject;
  compact?: boolean;
}

export default function ProductMetadataCard({ object, compact = false }: Props) {
  const [expanded, setExpanded] = useState(!compact);
  const meta = getMetadata(object.class_name);
  const confPct = (object.confidence * 100).toFixed(1);

  const confColor =
    object.confidence >= 0.85 ? '#22c55e'
    : object.confidence >= 0.65 ? '#f59e0b'
    : '#ef4444';

  const confLabel =
    object.confidence >= 0.85 ? 'Rất chắc chắn'
    : object.confidence >= 0.65 ? 'Khá chắc chắn'
    : 'Không chắc chắn';

  if (!meta) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-gray-400" />
          <span className="text-gray-600" style={{ fontSize: '0.875rem' }}>
            {object.class_name} — chưa có metadata
          </span>
          <span
            className="ml-auto px-2 py-0.5 rounded-full text-white"
            style={{ fontSize: '0.75rem', backgroundColor: confColor }}
          >
            {confPct}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-green-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ background: `linear-gradient(135deg, ${meta.color_tag}15, ${meta.color_tag}05)` }}
      >
        <span style={{ fontSize: '2rem' }}>{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 style={{ fontWeight: 700, fontSize: '1rem' }} className="text-gray-900">
              {meta.name_vi}
            </h3>
            <span className="text-gray-400" style={{ fontSize: '0.8rem' }}>
              {meta.name_en}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full"
              style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                background: meta.color_tag + '20',
                color: meta.color_tag,
              }}
            >
              {meta.group}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-white"
              style={{ fontSize: '0.65rem', fontWeight: 600, backgroundColor: confColor }}
            >
              {confLabel}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div style={{ fontWeight: 800, fontSize: '1.5rem', color: confColor }}>{confPct}%</div>
          <div style={{ fontSize: '0.6rem' }} className="text-gray-400">độ tin cậy</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="px-4 py-2 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${confPct}%`, backgroundColor: confColor }}
            />
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: confColor }}>{confPct}%</span>
        </div>
      </div>

      {/* Top-K alternatives */}
      {object.top_k && object.top_k.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <p style={{ fontSize: '0.7rem', fontWeight: 600 }} className="text-gray-500 mb-1.5">
            Top-3 nhãn gần nhất
          </p>
          <div className="flex flex-wrap gap-1.5">
            {object.top_k.slice(0, 3).map((k, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg"
              >
                <Star size={10} className="text-amber-400" />
                <span style={{ fontSize: '0.65rem' }} className="text-gray-700">
                  {k.class_name}
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600 }} className="text-gray-500">
                  {(k.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand toggle */}
      {compact && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 border-t border-gray-100 text-green-600 hover:bg-green-50 transition-colors"
          style={{ fontSize: '0.75rem', fontWeight: 600 }}
        >
          {expanded ? (
            <><ChevronUp size={14} /> Thu gọn</>
          ) : (
            <><ChevronDown size={14} /> Xem chi tiết</>
          )}
        </button>
      )}

      {/* Detailed Info */}
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="divide-y divide-gray-50">
            {/* Varieties */}
            <InfoRow icon={<Leaf size={14} />} label="Giống phổ biến" color="text-green-600">
              <div className="flex flex-wrap gap-1 mt-1">
                {meta.varieties.map((v, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded" style={{ fontSize: '0.65rem' }}>
                    {v}
                  </span>
                ))}
              </div>
            </InfoRow>

            {/* Season */}
            <InfoRow icon={<Calendar size={14} />} label="Mùa vụ" color="text-amber-600">
              <p style={{ fontSize: '0.78rem' }} className="text-gray-700 mt-0.5">{meta.season}</p>
            </InfoRow>

            {/* Regions */}
            <InfoRow icon={<MapPin size={14} />} label="Vùng trồng chính" color="text-blue-600">
              <p style={{ fontSize: '0.78rem' }} className="text-gray-700 mt-0.5">
                {meta.growing_regions.join(' • ')}
              </p>
            </InfoRow>

            {/* Characteristics */}
            <InfoRow icon={<Globe size={14} />} label="Đặc điểm nhận biết" color="text-purple-600">
              <ul className="mt-1 space-y-0.5">
                {meta.characteristics.map((c, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-purple-400 mt-1">•</span>
                    <span style={{ fontSize: '0.75rem' }} className="text-gray-700">{c}</span>
                  </li>
                ))}
              </ul>
            </InfoRow>

            {/* Nutrition */}
            <InfoRow icon={<Heart size={14} />} label="Giá trị dinh dưỡng" color="text-red-500">
              <div className="flex flex-wrap gap-1 mt-1">
                {meta.nutrition.map((n, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded" style={{ fontSize: '0.65rem' }}>
                    {n}
                  </span>
                ))}
              </div>
            </InfoRow>

            {/* Storage */}
            <InfoRow icon={<Package size={14} />} label="Bảo quản" color="text-indigo-600">
              <p style={{ fontSize: '0.78rem' }} className="text-gray-700 mt-0.5">{meta.storage}</p>
            </InfoRow>

            {/* Usage */}
            <InfoRow icon={<ChefHat size={14} />} label="Gợi ý chế biến" color="text-orange-600">
              <div className="flex flex-wrap gap-1 mt-1">
                {meta.usage_suggestions.map((u, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded" style={{ fontSize: '0.65rem' }}>
                    {u}
                  </span>
                ))}
              </div>
            </InfoRow>

            {/* Ripeness */}
            {meta.ripeness_indicators && (
              <InfoRow icon={<Sun size={14} />} label="Mức độ chín" color="text-yellow-600">
                <ul className="mt-1 space-y-0.5">
                  {meta.ripeness_indicators.map((r, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-yellow-400 mt-1">▸</span>
                      <span style={{ fontSize: '0.75rem' }} className="text-gray-700">{r}</span>
                    </li>
                  ))}
                </ul>
              </InfoRow>
            )}

            {/* Bbox info */}
            <InfoRow icon={<TrendingUp size={14} />} label="Thông tin bounding box" color="text-gray-500">
              <div className="mt-1 grid grid-cols-2 gap-1" style={{ fontSize: '0.65rem' }}>
                <span className="text-gray-500">x1: <b className="text-gray-700">{object.bbox.x1.toFixed(0)}px</b></span>
                <span className="text-gray-500">y1: <b className="text-gray-700">{object.bbox.y1.toFixed(0)}px</b></span>
                <span className="text-gray-500">x2: <b className="text-gray-700">{object.bbox.x2.toFixed(0)}px</b></span>
                <span className="text-gray-500">y2: <b className="text-gray-700">{object.bbox.y2.toFixed(0)}px</b></span>
                <span className="text-gray-500">w: <b className="text-gray-700">{(object.bbox.w_norm * 100).toFixed(1)}%</b></span>
                <span className="text-gray-500">h: <b className="text-gray-700">{(object.bbox.h_norm * 100).toFixed(1)}%</b></span>
              </div>
            </InfoRow>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon, label, color, children
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5">
      <div className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        <span style={{ fontWeight: 600, fontSize: '0.72rem' }} className="uppercase tracking-wide">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}
