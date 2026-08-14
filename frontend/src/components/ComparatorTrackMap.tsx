import React, { useRef, useEffect } from 'react';
import type { MergedTelemetryPoint } from '../utils/deltaCalculation';
import { detectTrackTurns, type TrackTurn } from '../utils/trackTurns';

interface ComparatorTrackMapProps {
  data: MergedTelemetryPoint[];
  activeDistance?: number | null;
  height?: number;
  sector1Distance?: number | null;
  sector2Distance?: number | null;
  onSelectDistance?: (distance: number) => void;
}

export const ComparatorTrackMap: React.FC<ComparatorTrackMapProps> = ({
  data,
  activeDistance,
  height = 360,
  sector1Distance,
  sector2Distance,
  onSelectDistance,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);

  // Store turn coordinate hitboxes for click handling
  const turnHitboxesRef = useRef<Array<{ turn: TrackTurn; x: number; y: number; radius: number }>>([]);
  const validPointsRef = useRef<MergedTelemetryPoint[]>([]);
  const toCanvasCoordsRef = useRef<{ toX: (x: number) => number; toY: (z: number) => number }>({
    toX: (x) => x,
    toY: (z) => z,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const rectWidth = rect.width > 0 ? rect.width : 300;
      const rectHeight = height;

      canvas.width = rectWidth * dpr;
      canvas.height = rectHeight * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, rectWidth, rectHeight);

      // Filter points with valid world coordinates
      const validPoints = data.filter(
        (p) => p.worldX !== undefined && p.worldZ !== undefined && (p.worldX !== 0 || p.worldZ !== 0)
      );
      validPointsRef.current = validPoints;

      if (validPoints.length < 2) {
        ctx.fillStyle = '#888';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No track coordinate telemetry available for this lap', rectWidth / 2, rectHeight / 2);
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
      const padding = 28;

      const availableW = rectWidth - padding * 2;
      const availableH = rectHeight - padding * 2;

      const scale = Math.min(availableW / rangeX, availableH / rangeZ);
      const offsetX = padding + (availableW - rangeX * scale) / 2;
      const offsetY = padding + (availableH - rangeZ * scale) / 2;

      const toCanvasX = (worldX: number) => offsetX + (worldX - minX) * scale;
      const toCanvasY = (worldZ: number) => offsetY + (worldZ - minZ) * scale;
      toCanvasCoordsRef.current = { toX: toCanvasX, toY: toCanvasY };

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

      // Pre-calculate segment pace gain colors matching the Time Delta graph slope
      const windowSize = 6;
      const segmentColors: string[] = [];

      for (let i = 0; i < validPoints.length; i++) {
        const idx1 = Math.max(0, i - windowSize);
        const idx2 = Math.min(validPoints.length - 1, i + windowSize);

        const deltaStart = validPoints[idx1].time_delta;
        const deltaEnd = validPoints[idx2].time_delta;

        if (deltaStart !== null && deltaEnd !== null) {
          const dDelta = deltaEnd - deltaStart;
          if (dDelta < -0.005) {
            segmentColors.push('#ff4757');
          } else if (dDelta > 0.005) {
            segmentColors.push('#00d2d3');
          } else {
            segmentColors.push('rgba(255, 255, 255, 0.45)');
          }
        } else {
          segmentColors.push('rgba(255, 255, 255, 0.45)');
        }
      }

      // Draw subtle track line background shadow for depth
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      for (let i = 0; i < validPoints.length; i++) {
        const px = toCanvasX(validPoints[i].worldX!);
        const py = toCanvasY(validPoints[i].worldZ!);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Draw track line segments with speed delta colors
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
        ctx.strokeStyle = segmentColors[i];
        ctx.stroke();
      }

      // Helper to draw clean perpendicular sector split boundary lines across track (no text)
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

        const lineLen = 10;
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

        // Marker dot on track line
        ctx.beginPath();
        ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
      };

      // Helper to draw clean sector region badges at the middle of each sector (S1, S2, S3)
      const drawSectorRegionBadge = (point: MergedTelemetryPoint, label: string, color: string) => {
        if (point.worldX === undefined || point.worldX === null || point.worldZ === undefined || point.worldZ === null) return;
        const cx = toCanvasX(point.worldX);
        const cy = toCanvasY(point.worldZ);

        ctx.save();
        ctx.font = 'bold 9px Inter, sans-serif';
        const badgeW = 22;
        const badgeH = 15;
        const bx = cx - badgeW / 2;
        const by = cy - badgeH / 2;

        ctx.fillStyle = 'rgba(10, 14, 22, 0.9)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy);
        ctx.restore();
      };

      if (s0Point) drawSectorSplitMarker(s0Point, '#f39c12');
      if (s1Point) drawSectorSplitMarker(s1Point, '#9b59b6');
      if (s2Point) drawSectorSplitMarker(s2Point, '#2ecc71');

      if (s1MidPoint) drawSectorRegionBadge(s1MidPoint, 'S1', '#f39c12');
      if (s2MidPoint) drawSectorRegionBadge(s2MidPoint, 'S2', '#9b59b6');
      if (s3MidPoint) drawSectorRegionBadge(s3MidPoint, 'S3', '#2ecc71');

      // Detect and draw clean track corner apex dots & interactive hover callout
      const detectedTurns = detectTrackTurns(validPoints);
      turnHitboxesRef.current = [];

      let activeHoverTurnItem: {
        turn: TrackTurn;
        apexX: number;
        apexY: number;
        badgeX: number;
        badgeY: number;
        label: string;
      } | null = null;

      // 1. Draw subtle minimalist Apex Dots on track for all turns
      for (const turn of detectedTurns) {
        const apexX = toCanvasX(turn.worldX);
        const apexY = toCanvasY(turn.worldZ);

        const isNearHover =
          activeDistance !== undefined &&
          activeDistance !== null &&
          Math.abs(turn.distance - activeDistance) < 40;

        turnHitboxesRef.current.push({
          turn,
          x: apexX,
          y: apexY,
          radius: 12,
        });

        if (isNearHover) {
          // Highlighted apex aura
          ctx.save();
          ctx.beginPath();
          ctx.arc(apexX, apexY, 9, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 210, 0, 0.4)';
          ctx.fill();
          ctx.restore();

          let label = turn.name;
          if (turn.speedA !== undefined && turn.speedB !== undefined) {
            label = `${turn.name} • ${turn.speedA} / ${turn.speedB} km/h`;
          }

          const baseOffset = 16;
          const badgeX = apexX + (turn.normalX || 0) * baseOffset;
          const badgeY = apexY + (turn.normalZ || 0) * baseOffset;

          activeHoverTurnItem = {
            turn,
            apexX,
            apexY,
            badgeX,
            badgeY,
            label,
          };
        }

        // Draw Apex Dot
        ctx.beginPath();
        ctx.arc(apexX, apexY, isNearHover ? 3.8 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = isNearHover ? '#ffd200' : 'rgba(255, 255, 255, 0.85)';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
      }

      // 2. Draw only the active turn callout badge (if hovered / scrubbed)
      if (activeHoverTurnItem) {
        const { apexX, apexY, badgeX, badgeY, label } = activeHoverTurnItem;

        ctx.save();
        // Subtle leader line
        ctx.beginPath();
        ctx.moveTo(apexX, apexY);
        ctx.lineTo(badgeX, badgeY);
        ctx.strokeStyle = 'rgba(255, 210, 0, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Badge Container
        ctx.font = 'bold 8.5px Inter, -apple-system, sans-serif';
        const textWidth = ctx.measureText(label).width;
        const badgeW = Math.max(22, textWidth + 10);
        const badgeH = 15;
        const bx = badgeX - badgeW / 2;
        const by = badgeY - badgeH / 2;

        ctx.fillStyle = '#ffd200';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, badgeX, badgeY);
        ctx.restore();
      }

      // Draw Active Telemetry Cursor / Marker on track
      if (activeDistance !== undefined && activeDistance !== null) {
        const activePoint = findClosestPoint(activeDistance);
        if (activePoint && activePoint.worldX !== undefined && activePoint.worldX !== null && activePoint.worldZ !== undefined && activePoint.worldZ !== null) {
          const cx = toCanvasX(activePoint.worldX);
          const cy = toCanvasY(activePoint.worldZ);

          // 1. Draw glowing aura on canvas
          ctx.beginPath();
          ctx.arc(cx, cy, 12, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 235, 59, 0.4)';
          ctx.fill();

          // 2. Draw outer ring
          ctx.beginPath();
          ctx.arc(cx, cy, 7, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffee58';
          ctx.lineWidth = 2;
          ctx.stroke();

          // 3. Draw inner target dot
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();

          // Update HTML overlay ref directly without React re-render delay
          if (markerRef.current) {
            markerRef.current.style.display = 'block';
            markerRef.current.style.left = `${cx}px`;
            markerRef.current.style.top = `${cy}px`;
          }
        } else if (markerRef.current) {
          markerRef.current.style.display = 'none';
        }
      } else if (markerRef.current) {
        markerRef.current.style.display = 'none';
      }
    };

    render();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        render();
      });
      observer.observe(container);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [data, activeDistance, height, sector1Distance, sector2Distance]);

  // Handle canvas click to jump to turn or track position
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectDistance) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 1. Check if clicked near a turn apex dot
    for (const hb of turnHitboxesRef.current) {
      const dist = Math.hypot(hb.x - clickX, hb.y - clickY);
      if (dist <= hb.radius) {
        onSelectDistance(hb.turn.distance);
        return;
      }
    }

    // 2. Otherwise find closest point along track path
    const validPoints = validPointsRef.current;
    if (validPoints.length === 0) return;

    const { toX, toY } = toCanvasCoordsRef.current;
    let closestPoint = validPoints[0];
    let minCanvasDist = Infinity;

    for (const p of validPoints) {
      const px = toX(p.worldX!);
      const py = toY(p.worldZ!);
      const d = Math.hypot(px - clickX, py - clickY);
      if (d < minCanvasDist) {
        minCanvasDist = d;
        closestPoint = p;
      }
    }

    if (minCanvasDist < 25) {
      onSelectDistance(closestPoint.lap_distance);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ width: '100%', height: '100%', display: 'block', cursor: onSelectDistance ? 'crosshair' : 'default' }}
      />

      <div
        ref={markerRef}
        className="map-hover-marker"
        style={{
          display: 'none',
          position: 'absolute',
          pointerEvents: 'none',
        }}
      />

      {/* Pace Gain Delta Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '6px',
          left: '6px',
          display: 'flex',
          gap: '6px',
          fontSize: '0.65rem',
          background: 'rgba(10, 14, 22, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '2px 6px',
          borderRadius: '4px',
          color: '#ccc',
          alignItems: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span style={{ color: '#ff4757', fontWeight: 'bold' }}>● Lap A Faster</span>
        <span style={{ color: '#00d2d3', fontWeight: 'bold' }}>● Lap B Faster</span>
      </div>

      {/* Sector & Turn Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '6px',
          right: '6px',
          display: 'flex',
          gap: '6px',
          fontSize: '0.65rem',
          background: 'rgba(10, 14, 22, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '2px 6px',
          borderRadius: '4px',
          color: '#ccc',
          alignItems: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span style={{ color: '#ffffff', fontWeight: 600 }}>● Apex</span>
        <span style={{ color: '#f39c12', fontWeight: 600 }}>● S1</span>
        <span style={{ color: '#9b59b6', fontWeight: 600 }}>● S2</span>
        <span style={{ color: '#2ecc71', fontWeight: 600 }}>● S3</span>
      </div>
    </div>
  );
};
