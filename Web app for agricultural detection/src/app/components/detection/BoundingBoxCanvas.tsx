import { useEffect, useRef } from 'react';
import type { DetectedObject } from '../../types';
import { PRODUCT_METADATA } from '../../data/metadata';

interface Props {
  imageSrc?: string;
  objects: DetectedObject[];
  imageWidth: number;
  imageHeight: number;
  className?: string;
}

const BOX_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#f97316', '#10b981', '#ef4444', '#84cc16',
];

export default function BoundingBoxCanvas({
  imageSrc,
  objects,
  imageWidth,
  imageHeight,
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (bgImage?: HTMLImageElement) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (bgImage) {
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      } else {
        // Dark background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const scaleX = canvas.width / imageWidth;
      const scaleY = canvas.height / imageHeight;

      objects.forEach((obj, i) => {
        const color = BOX_COLORS[i % BOX_COLORS.length];
        const { x1, y1, x2, y2 } = obj.bbox;
        const sx = x1 * scaleX;
        const sy = y1 * scaleY;
        const sw = (x2 - x1) * scaleX;
        const sh = (y2 - y1) * scaleY;

        // Box shadow glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        // Bounding box border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.shadowBlur = 0;

        // Corner decorations
        const cornerLen = Math.min(sw, sh) * 0.18;
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        // TL
        ctx.beginPath(); ctx.moveTo(sx, sy + cornerLen); ctx.lineTo(sx, sy); ctx.lineTo(sx + cornerLen, sy); ctx.stroke();
        // TR
        ctx.beginPath(); ctx.moveTo(sx + sw - cornerLen, sy); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + cornerLen); ctx.stroke();
        // BL
        ctx.beginPath(); ctx.moveTo(sx, sy + sh - cornerLen); ctx.lineTo(sx, sy + sh); ctx.lineTo(sx + cornerLen, sy + sh); ctx.stroke();
        // BR
        ctx.beginPath(); ctx.moveTo(sx + sw - cornerLen, sy + sh); ctx.lineTo(sx + sw, sy + sh); ctx.lineTo(sx + sw, sy + sh - cornerLen); ctx.stroke();

        // Semi-transparent fill
        ctx.fillStyle = color + '22';
        ctx.fillRect(sx, sy, sw, sh);

        // Label
        const meta = PRODUCT_METADATA[obj.class_name];
        const label = meta ? `${meta.emoji} ${meta.name_vi}` : obj.class_name;
        const confText = `${(obj.confidence * 100).toFixed(1)}%`;
        const fullLabel = `${label}  ${confText}`;

        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        const textW = ctx.measureText(fullLabel).width;
        const labelH = 22;
        const labelY = sy > labelH + 4 ? sy - labelH - 2 : sy + 2;

        // Label background
        ctx.fillStyle = color + 'dd';
        ctx.beginPath();
        ctx.roundRect(sx, labelY, textW + 12, labelH, 4);
        ctx.fill();

        // Label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(fullLabel, sx + 6, labelY + labelH - 6);
      });
    };

    if (imageSrc) {
      const img = new Image();
      img.onload = () => draw(img);
      img.src = imageSrc;
    } else {
      draw();
    }
  }, [imageSrc, objects, imageWidth, imageHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={imageWidth}
      height={imageHeight}
      className={`w-full h-full object-contain ${className}`}
      style={{ maxWidth: '100%', maxHeight: '100%' }}
    />
  );
}
