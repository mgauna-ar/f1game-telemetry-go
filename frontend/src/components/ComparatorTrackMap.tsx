import React, { useRef, useEffect } from 'react';
import type { MergedTelemetryPoint, TrackTurn } from '../types/comparator';
import { TRACK_MAP_CONSTANTS } from '../constants/f1';
import { useI18n } from '../context/I18nContext';
import { canvasRgba, getCssVars, styleVars } from '../styles/theme';
import styles from './ComparatorTrackMap.module.css';

/** Canvas colours, read from the design tokens at the start of each draw. */
const TRACK_MAP_TOKENS = {
  slotA: '--f1-slot-a',
  slotB: '--f1-slot-b',
  track: '--chart-track',
  casing: '--chart-track-casing',
  sector1: '--f1-sector-1',
  sector2: '--f1-sector-2',
  sector3: '--f1-sector-3',
  cursor: '--chart-cursor',
  ring: '--chart-marker-ring',
  outline: '--chart-marker-outline',
  badge: '--bg-tooltip',
  muted: '--text-muted',
} as const;

interface ComparatorTrackMapProps {
  data: MergedTelemetryPoint[];
  turns?: TrackTurn[];
  activeDistance?: number | null;
  height?: number;
  sector1Distance?: number | null;
  sector2Distance?: number | null;
  onSelectDistance?: (distance: number) => void;
  /** The zoomed stretch in lap meters: the map frames it and dims the rest of the lap. */
  zoomRange?: [number, number] | null;
}

/** Track shown around a zoomed stretch, in lap meters on each side, so the corner keeps its context. */
const ZOOM_CONTEXT_METERS = 60;
/** How visible the lap outside a zoomed stretch stays. */
const OUTSIDE_ZOOM_ALPHA = 0.3;

export const ComparatorTrackMap: React.FC<ComparatorTrackMapProps> = ({
  data,
  turns = [],
  activeDistance,
  height = TRACK_MAP_CONSTANTS.DEFAULT_HEIGHT,
  sector1Distance,
  sector2Distance,
  onSelectDistance,
  zoomRange = null,
}) => {
  const { t } = useI18n();
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
      const colors = getCssVars(TRACK_MAP_TOKENS);
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
        ctx.fillStyle = colors.muted;
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('comparator.noCoordinateData'), rectWidth / 2, rectHeight / 2);
        return;
      }

      // Frame the zoomed stretch (with some track either side), else the whole lap
      const inZoom = (d: number) => zoomRange === null || (d >= zoomRange[0] && d <= zoomRange[1]);
      const zoomedPoints = zoomRange
        ? validPoints.filter(
            (p) => p.lap_distance >= zoomRange[0] - ZOOM_CONTEXT_METERS && p.lap_distance <= zoomRange[1] + ZOOM_CONTEXT_METERS
          )
        : validPoints;
      const framePoints = zoomedPoints.length >= 2 ? zoomedPoints : validPoints;

      // Compute bounding box
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      framePoints.forEach((p) => {
        if (p.worldX! < minX) minX = p.worldX!;
        if (p.worldX! > maxX) maxX = p.worldX!;
        if (p.worldZ! < minZ) minZ = p.worldZ!;
        if (p.worldZ! > maxZ) maxZ = p.worldZ!;
      });

      const rangeX = maxX - minX || 1;
      const rangeZ = maxZ - minZ || 1;
      const padding = TRACK_MAP_CONSTANTS.PADDING;

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
        return validPoints.reduce(
          (prev, curr) =>
            Math.abs(curr.lap_distance - targetDist) < Math.abs(prev.lap_distance - targetDist) ? curr : prev,
          validPoints[0]
        );
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
            segmentColors.push(colors.slotA);
          } else if (dDelta > 0.005) {
            segmentColors.push(colors.slotB);
          } else {
            segmentColors.push(colors.track);
          }
        } else {
          segmentColors.push(colors.track);
        }
      }

      // Draw subtle track line background shadow for depth
      ctx.lineWidth = TRACK_MAP_CONSTANTS.SHADOW_LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = colors.casing;
      ctx.beginPath();
      for (let i = 0; i < validPoints.length; i++) {
        const px = toCanvasX(validPoints[i].worldX!);
        const py = toCanvasY(validPoints[i].worldZ!);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      if (validPoints.length > 2) {
        ctx.closePath();
      }
      ctx.stroke();

      // Draw track line segments with speed delta colors
      ctx.lineWidth = TRACK_MAP_CONSTANTS.LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < validPoints.length - 1; i++) {
        const p1 = validPoints[i];
        const p2 = validPoints[i + 1];

        const x1 = toCanvasX(p1.worldX!);
        const y1 = toCanvasY(p1.worldZ!);
        const x2 = toCanvasX(p2.worldX!);
        const y2 = toCanvasY(p2.worldZ!);

        ctx.globalAlpha = inZoom(p1.lap_distance) && inZoom(p2.lap_distance) ? 1 : OUTSIDE_ZOOM_ALPHA;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = segmentColors[i];
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Connect final point back to start point to ensure complete closed circuit loop
      if (validPoints.length > 2) {
        const pLast = validPoints[validPoints.length - 1];
        const pFirst = validPoints[0];
        const xLast = toCanvasX(pLast.worldX!);
        const yLast = toCanvasY(pLast.worldZ!);
        const xFirst = toCanvasX(pFirst.worldX!);
        const yFirst = toCanvasY(pFirst.worldZ!);

        ctx.beginPath();
        ctx.moveTo(xLast, yLast);
        ctx.lineTo(xFirst, yFirst);
        ctx.globalAlpha = inZoom(pLast.lap_distance) && inZoom(pFirst.lap_distance) ? 1 : OUTSIDE_ZOOM_ALPHA;
        ctx.strokeStyle = segmentColors[segmentColors.length - 1] || colors.track;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Helper to draw clean perpendicular sector split boundary lines across track (no text)
      const drawSectorSplitMarker = (point: MergedTelemetryPoint, color: string) => {
        if (point.worldX === undefined || point.worldX === null || point.worldZ === undefined || point.worldZ === null)
          return;
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
        ctx.strokeStyle = colors.outline;
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
        ctx.strokeStyle = colors.ring;
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
      };

      // Helper to draw clean sector region badges at the middle of each sector (S1, S2, S3)
      const drawSectorRegionBadge = (point: MergedTelemetryPoint, label: string, color: string) => {
        if (point.worldX === undefined || point.worldX === null || point.worldZ === undefined || point.worldZ === null)
          return;
        const cx = toCanvasX(point.worldX);
        const cy = toCanvasY(point.worldZ);

        ctx.save();
        ctx.font = 'bold 9px Inter, sans-serif';
        const badgeW = 22;
        const badgeH = 15;
        const bx = cx - badgeW / 2;
        const by = cy - badgeH / 2;

        ctx.fillStyle = colors.badge;
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

      if (s0Point) drawSectorSplitMarker(s0Point, colors.sector1);
      if (s1Point) drawSectorSplitMarker(s1Point, colors.sector2);
      if (s2Point) drawSectorSplitMarker(s2Point, colors.sector3);

      if (s1MidPoint) drawSectorRegionBadge(s1MidPoint, 'S1', colors.sector1);
      if (s2MidPoint) drawSectorRegionBadge(s2MidPoint, 'S2', colors.sector2);
      if (s3MidPoint) drawSectorRegionBadge(s3MidPoint, 'S3', colors.sector3);

      // Use pre-computed track corner apex dots & interactive hover callout
      const detectedTurns = turns;
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
          Math.abs(turn.distance - activeDistance) < TRACK_MAP_CONSTANTS.APEX_NEAR_DISTANCE;

        turnHitboxesRef.current.push({
          turn,
          x: apexX,
          y: apexY,
          radius: TRACK_MAP_CONSTANTS.APEX_HOVER_RADIUS,
        });

        if (isNearHover) {
          // Highlighted apex aura
          ctx.save();
          ctx.beginPath();
          ctx.arc(apexX, apexY, 9, 0, Math.PI * 2);
          ctx.fillStyle = canvasRgba(ctx, colors.cursor, 0.4);
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
        ctx.fillStyle = isNearHover ? colors.cursor : canvasRgba(ctx, colors.ring, 0.85);
        ctx.strokeStyle = colors.outline;
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
        ctx.strokeStyle = canvasRgba(ctx, colors.cursor, 0.85);
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Badge Container
        ctx.font = 'bold 8.5px Inter, -apple-system, sans-serif';
        const textWidth = ctx.measureText(label).width;
        const badgeW = Math.max(22, textWidth + 10);
        const badgeH = 15;
        const bx = badgeX - badgeW / 2;
        const by = badgeY - badgeH / 2;

        ctx.fillStyle = colors.cursor;
        ctx.strokeStyle = colors.ring;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = colors.outline;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, badgeX, badgeY);
        ctx.restore();
      }

      // Draw Active Telemetry Cursor / Marker on track
      if (activeDistance !== undefined && activeDistance !== null) {
        const activePoint = findClosestPoint(activeDistance);
        if (
          activePoint &&
          activePoint.worldX !== undefined &&
          activePoint.worldX !== null &&
          activePoint.worldZ !== undefined &&
          activePoint.worldZ !== null
        ) {
          const cx = toCanvasX(activePoint.worldX);
          const cy = toCanvasY(activePoint.worldZ);

          // 1. Draw glowing aura on canvas
          ctx.beginPath();
          ctx.arc(cx, cy, 12, 0, Math.PI * 2);
          ctx.fillStyle = canvasRgba(ctx, colors.cursor, 0.4);
          ctx.fill();

          // 2. Draw outer ring
          ctx.beginPath();
          ctx.arc(cx, cy, 7, 0, Math.PI * 2);
          ctx.strokeStyle = colors.cursor;
          ctx.lineWidth = 2;
          ctx.stroke();

          // 3. Draw inner target dot
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = colors.ring;
          ctx.strokeStyle = colors.outline;
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
  }, [data, turns, activeDistance, height, sector1Distance, sector2Distance, zoomRange, t]);

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
      if (dist <= hb.radius + 4) {
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

    if (minCanvasDist < TRACK_MAP_CONSTANTS.CLICK_MAX_DISTANCE) {
      onSelectDistance(closestPoint.lap_distance);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectDistance) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if hovering near a turn apex dot
    for (const hb of turnHitboxesRef.current) {
      const dist = Math.hypot(hb.x - mouseX, hb.y - mouseY);
      if (dist <= hb.radius + 4) {
        onSelectDistance(hb.turn.distance);
        return;
      }
    }

    // Find closest point along track path
    const validPoints = validPointsRef.current;
    if (validPoints.length === 0) return;

    const { toX, toY } = toCanvasCoordsRef.current;
    let closestPoint = validPoints[0];
    let minCanvasDist = Infinity;

    for (const p of validPoints) {
      const px = toX(p.worldX!);
      const py = toY(p.worldZ!);
      const d = Math.hypot(px - mouseX, py - mouseY);
      if (d < minCanvasDist) {
        minCanvasDist = d;
        closestPoint = p;
      }
    }

    if (minCanvasDist < TRACK_MAP_CONSTANTS.CLICK_MAX_DISTANCE) {
      onSelectDistance(closestPoint.lap_distance);
    }
  };

  return (
    <div ref={containerRef} className={styles.wrapper} style={styleVars({ '--map-height': `${height}px` })}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        className={styles.canvas}
        data-selectable={onSelectDistance ? true : undefined}
      />

      <div ref={markerRef} className={styles.marker} />

      {/* Pace Gain Delta Legend */}
      <div className={`${styles.legend} ${styles.legendLeft}`}>
        <span className={styles.lapA}>{t('comparator.legend.lapAFaster')}</span>
        <span className={styles.lapB}>{t('comparator.legend.lapBFaster')}</span>
      </div>

      {/* Sector & Turn Legend */}
      <div className={`${styles.legend} ${styles.legendRight}`}>
        <span className={styles.apex}>{t('comparator.legend.apex')}</span>
        <span className={styles.s1}>{t('comparator.legend.s1')}</span>
        <span className={styles.s2}>{t('comparator.legend.s2')}</span>
        <span className={styles.s3}>{t('comparator.legend.s3')}</span>
      </div>
    </div>
  );
};
