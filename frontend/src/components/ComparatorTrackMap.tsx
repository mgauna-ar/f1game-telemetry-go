import React, { useRef, useEffect, useState } from 'react';
import type { MergedTelemetryPoint } from '../utils/deltaCalculation';

interface ComparatorTrackMapProps {
  data: MergedTelemetryPoint[];
  activeDistance?: number | null;
  height?: number;
}

export const ComparatorTrackMap: React.FC<ComparatorTrackMapProps> = ({
  data,
  activeDistance,
  height = 240,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<'delta' | 'speed'>('delta');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Filter points with valid world coordinates
    const validPoints = data.filter(
      (p) => p.worldX !== undefined && p.worldZ !== undefined && (p.worldX !== 0 || p.worldZ !== 0)
    );

    if (validPoints.length < 2) {
      ctx.fillStyle = '#666';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No track coordinate telemetry available for this lap', rect.width / 2, rect.height / 2);
      return;
    }

    // Compute bounding box
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    validPoints.forEach((p) => {
      if (p.worldX! < minX) minX = p.worldX!;
      if (p.worldX! > maxX) maxX = p.worldX!;
      if (p.worldZ! < minZ) minZ = p.worldZ!;
      if (p.worldZ! > maxZ) maxZ = p.worldZ!;
    });

    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const padding = 20;

    const availableW = rect.width - padding * 2;
    const availableH = rect.height - padding * 2;

    const scale = Math.min(availableW / rangeX, availableH / rangeZ);
    const offsetX = padding + (availableW - rangeX * scale) / 2;
    const offsetY = padding + (availableH - rangeZ * scale) / 2;

    const toCanvasX = (worldX: number) => offsetX + (worldX - minX) * scale;
    const toCanvasY = (worldZ: number) => offsetY + (worldZ - minZ) * scale;

    // Draw track line segments with heatmap coloring
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < validPoints.length - 1; i++) {
      const p1 = validPoints[i];
      const p2 = validPoints[i + 1];

      const x1 = toCanvasX(p1.worldX!);
      const y1 = toCanvasY(p1.worldZ!);
      const x2 = toCanvasX(p2.worldX!);
      const y2 = toCanvasY(p2.worldZ!);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);

      if (heatmapMode === 'delta') {
        // Time Delta: Negative (Lap A faster) = Red/Coral (#ff4757), Positive (Lap B faster) = Cyan (#00d2d3)
        // Neutral = Grey/White
        const dt = p1.time_delta;
        if (dt < -0.05) {
          ctx.strokeStyle = '#ff4757'; // Lap A faster (Red)
        } else if (dt > 0.05) {
          ctx.strokeStyle = '#00d2d3'; // Lap B faster (Cyan)
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // Tied
        }
      } else {
        // Speed Heatmap (0 - 350 km/h)
        const speed = p1.speedA;
        const normSpeed = Math.min(1, Math.max(0, speed / 330));
        // Blue (slow) -> Green -> Yellow -> Red (fast)
        const hue = (1 - normSpeed) * 240; // 240 (blue) to 0 (red)
        ctx.strokeStyle = `hsl(${hue}, 90%, 55%)`;
      }

      ctx.stroke();
    }

    // If activeDistance is hovered, draw glowing crosshair marker
    if (activeDistance !== undefined && activeDistance !== null) {
      const activePoint = validPoints.reduce((prev, curr) =>
        Math.abs(curr.lap_distance - activeDistance) < Math.abs(prev.lap_distance - activeDistance)
          ? curr
          : prev
      , validPoints[0]);

      if (activePoint && activePoint.worldX !== undefined && activePoint.worldZ !== undefined) {
        const cx = toCanvasX(activePoint.worldX);
        const cy = toCanvasY(activePoint.worldZ);

        // Glow outer circle
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();

        // Inner solid marker
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }
    }
  }, [data, activeDistance, heatmapMode]);

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          gap: '4px',
          background: 'rgba(0,0,0,0.65)',
          padding: '3px',
          borderRadius: '6px',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <button
          type="button"
          onClick={() => setHeatmapMode('delta')}
          style={{
            background: heatmapMode === 'delta' ? 'rgba(255,255,255,0.2)' : 'transparent',
            border: 'none',
            color: heatmapMode === 'delta' ? '#fff' : '#aaa',
            fontSize: '0.7rem',
            padding: '2px 6px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Time Δ
        </button>
        <button
          type="button"
          onClick={() => setHeatmapMode('speed')}
          style={{
            background: heatmapMode === 'speed' ? 'rgba(255,255,255,0.2)' : 'transparent',
            border: 'none',
            color: heatmapMode === 'speed' ? '#fff' : '#aaa',
            fontSize: '0.7rem',
            padding: '2px 6px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Speed
        </button>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          display: 'flex',
          gap: '8px',
          fontSize: '0.7rem',
          background: 'rgba(0,0,0,0.6)',
          padding: '2px 8px',
          borderRadius: '4px',
          color: '#ccc',
        }}
      >
        {heatmapMode === 'delta' ? (
          <>
            <span style={{ color: '#ff4757', fontWeight: 'bold' }}>● Lap A Faster</span>
            <span style={{ color: '#00d2d3', fontWeight: 'bold' }}>● Lap B Faster</span>
          </>
        ) : (
          <span>Low Speed → High Speed</span>
        )}
      </div>
    </div>
  );
};
