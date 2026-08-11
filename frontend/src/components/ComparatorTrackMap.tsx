import React, { useRef, useEffect } from 'react';
import type { MergedTelemetryPoint } from '../utils/deltaCalculation';

interface ComparatorTrackMapProps {
  data: MergedTelemetryPoint[];
  activeDistance?: number | null;
  height?: number;
  sector1Distance?: number | null;
  sector2Distance?: number | null;
}

export const ComparatorTrackMap: React.FC<ComparatorTrackMapProps> = ({
  data,
  activeDistance,
  height = 240,
  sector1Distance,
  sector2Distance,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    const padding = 32;

    const availableW = rect.width - padding * 2;
    const availableH = rect.height - padding * 2;

    const scale = Math.min(availableW / rangeX, availableH / rangeZ);
    const offsetX = padding + (availableW - rangeX * scale) / 2;
    const offsetY = padding + (availableH - rangeZ * scale) / 2;

    const toCanvasX = (worldX: number) => offsetX + (worldX - minX) * scale;
    const toCanvasY = (worldZ: number) => offsetY + (worldZ - minZ) * scale;

    // Determine Sector Boundary distances (fallback to 1/3 and 2/3 of max distance)
    const maxDist = validPoints[validPoints.length - 1].lap_distance || 1;
    const s1TargetDist = sector1Distance && sector1Distance > 0 ? sector1Distance : maxDist / 3;
    const s2TargetDist = sector2Distance && sector2Distance > 0 ? sector2Distance : (maxDist * 2) / 3;

    const findClosestPoint = (targetDist: number) => {
      return validPoints.reduce((prev, curr) =>
        Math.abs(curr.lap_distance - targetDist) < Math.abs(prev.lap_distance - targetDist) ? curr : prev
      , validPoints[0]);
    };

    const s0Point = validPoints[0];
    const s1Point = findClosestPoint(s1TargetDist);
    const s2Point = findClosestPoint(s2TargetDist);

    const s1MidPoint = findClosestPoint(s1TargetDist / 2);
    const s2MidPoint = findClosestPoint((s1TargetDist + s2TargetDist) / 2);
    const s3MidPoint = findClosestPoint((s2TargetDist + maxDist) / 2);

    // Draw track line segments with pace delta coloring
    ctx.lineWidth = 3.5;
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

      // Pace / Segment Time Gain: Compare time spent between p1 and p2 for Lap A vs Lap B
      const segTimeA = (p2.timeA !== null && p1.timeA !== null) ? p2.timeA - p1.timeA : null;
      const segTimeB = (p2.timeB !== null && p1.timeB !== null) ? p2.timeB - p1.timeB : null;

      if (segTimeA !== null && segTimeB !== null && (segTimeA > 0 || segTimeB > 0)) {
        const diff = segTimeA - segTimeB; // Negative = Lap A gained time (faster)
        if (diff < -0.003) {
          ctx.strokeStyle = '#ff4757'; // Lap A faster on this segment (Red)
        } else if (diff > 0.003) {
          ctx.strokeStyle = '#00d2d3'; // Lap B faster on this segment (Cyan)
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; // Equal pace
        }
      } else {
        // Fallback to cumulative delta if segment delta unavailable
        const dt = p1.time_delta;
        if (dt !== null && dt < -0.05) ctx.strokeStyle = '#ff4757';
        else if (dt !== null && dt > 0.05) ctx.strokeStyle = '#00d2d3';
        else ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      }

      ctx.stroke();
    }

    // Helper to draw clean sector region badges (S1, S2, S3)
    const drawSectorRegionLabel = (point: MergedTelemetryPoint, label: string) => {
      if (point.worldX === undefined || point.worldX === null || point.worldZ === undefined || point.worldZ === null) return;
      const cx = toCanvasX(point.worldX);
      const cy = toCanvasY(point.worldZ);

      ctx.font = 'bold 9px Inter, sans-serif';
      const badgeW = 18;
      const badgeH = 13;
      const bx = cx - badgeW / 2;
      const by = cy - badgeH / 2;

      ctx.fillStyle = 'rgba(15, 15, 20, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, badgeW, badgeH, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);
    };

    // Helper to draw clean perpendicular sector split lines across track
    const drawSectorSplitMarker = (point: MergedTelemetryPoint, color: string) => {
      if (point.worldX === undefined || point.worldX === null || point.worldZ === undefined || point.worldZ === null) return;
      const cx = toCanvasX(point.worldX);
      const cy = toCanvasY(point.worldZ);

      const idx = validPoints.indexOf(point);
      const pPrev = validPoints[Math.max(0, idx - 1)];
      const pNext = validPoints[Math.min(validPoints.length - 1, idx + 1)];

      const xPrev = toCanvasX(pPrev.worldX ?? 0);
      const yPrev = toCanvasY(pPrev.worldZ ?? 0);
      const xNext = toCanvasX(pNext.worldX ?? 0);
      const yNext = toCanvasY(pNext.worldZ ?? 0);

      const dx = xNext - xPrev;
      const dy = yNext - yPrev;
      const len = Math.hypot(dx, dy) || 1;

      const nx = -dy / len;
      const ny = dx / len;

      const lineLen = 9;
      const xA = cx - nx * lineLen;
      const yA = cy - ny * lineLen;
      const xB = cx + nx * lineLen;
      const yB = cy + ny * lineLen;

      ctx.beginPath();
      ctx.moveTo(xA, yA);
      ctx.lineTo(xB, yB);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'butt';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(xA, yA);
      ctx.lineTo(xB, yB);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'butt';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    };

    // Draw Sector Region Labels (S1, S2, S3)
    if (s1MidPoint) drawSectorRegionLabel(s1MidPoint, 'S1');
    if (s2MidPoint) drawSectorRegionLabel(s2MidPoint, 'S2');
    if (s3MidPoint) drawSectorRegionLabel(s3MidPoint, 'S3');

    // Draw Sector Split Lines (SF, S1 Split, S2 Split)
    if (s0Point) drawSectorSplitMarker(s0Point, '#2ecc71');
    if (s1Point) drawSectorSplitMarker(s1Point, '#f39c12');
    if (s2Point) drawSectorSplitMarker(s2Point, '#9b59b6');

    // If activeDistance is hovered, draw glowing crosshair marker
    if (activeDistance !== undefined && activeDistance !== null) {
      const activePoint = findClosestPoint(activeDistance);

      if (activePoint && activePoint.worldX !== undefined && activePoint.worldX !== null && activePoint.worldZ !== undefined && activePoint.worldZ !== null) {
        const cx = toCanvasX(activePoint.worldX);
        const cy = toCanvasY(activePoint.worldZ);

        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }
    }
  }, [data, activeDistance, sector1Distance, sector2Distance]);

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* Pace Delta Legend Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '6px',
          left: '6px',
          display: 'flex',
          gap: '6px',
          fontSize: '0.68rem',
          background: 'rgba(0,0,0,0.7)',
          padding: '2px 6px',
          borderRadius: '4px',
          color: '#ccc',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#ff4757', fontWeight: 'bold' }}>● Lap A Faster</span>
        <span style={{ color: '#00d2d3', fontWeight: 'bold' }}>● Lap B Faster</span>
      </div>

      {/* Sector Legend Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '6px',
          right: '6px',
          display: 'flex',
          gap: '6px',
          fontSize: '0.68rem',
          background: 'rgba(0,0,0,0.7)',
          padding: '2px 6px',
          borderRadius: '4px',
          color: '#ccc',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#2ecc71', fontWeight: 600 }}>● SF</span>
        <span style={{ color: '#f39c12', fontWeight: 600 }}>● S1 Split</span>
        <span style={{ color: '#9b59b6', fontWeight: 600 }}>● S2 Split</span>
      </div>
    </div>
  );
};
