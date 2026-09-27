import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, EyeOff, Plus, RotateCcw } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '../../../context/I18nContext';
import type { MergedTelemetryPoint } from '../../../types/comparator';
import { Button, IconButton } from '../../ui/Button';
import { CHART_COLORS, type RechartsMouseMoveState } from './chartDefaults';
import {
  DEFAULT_STRIP_LAYOUT,
  dragZoomRange,
  STRIP_TRACES,
  loadStripLayout,
  moveStripTrace,
  saveStripLayout,
  type StripLayout,
  type StripTraceId,
} from './stripTraces';
import styles from './StripCharts.module.css';

export interface StripChartsProps {
  chartData: MergedTelemetryPoint[];
  nameA: string;
  nameB: string;
  formatA?: number | null;
  formatB?: number | null;
  /** The traces this comparison has data for, in no particular order. */
  available: StripTraceId[];
  sector1Distance: number | null;
  sector2Distance: number | null;
  hoverDistance: number | null;
  onMouseMove: (state: RechartsMouseMoveState<MergedTelemetryPoint> | null) => void;
  onHoverDistanceChange: (dist: number | null) => void;
  onZoomDomainChange: (domain: [number, number] | null) => void;
}

/** The lap distance a chart event points at, if any. */
const labelDistance = (state: unknown): number | null => {
  const label = (state as RechartsMouseMoveState | null)?.activeLabel;
  const num = Number(label);
  return label !== undefined && label !== null && Number.isFinite(num) ? num : null;
};

/** The point closest to a distance, in points sorted by distance. */
function pointAt(points: MergedTelemetryPoint[], distance: number | null): MergedTelemetryPoint | null {
  if (distance === null || points.length === 0) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].lap_distance < distance) lo = mid + 1;
    else hi = mid;
  }
  const prev = points[Math.max(0, lo - 1)];
  return Math.abs(prev.lap_distance - distance) < Math.abs(points[lo].lap_distance - distance) ? prev : points[lo];
}

/**
 * The compact view of the comparison: one strip per trace on one shared distance axis, with the
 * values under the cursor beside each strip instead of tooltips. Drag across any strip to zoom;
 * strips move up and down or hide, and the layout is remembered on this device.
 */
export const StripCharts: React.FC<StripChartsProps> = ({
  chartData,
  nameA,
  nameB,
  formatA,
  formatB,
  available,
  sector1Distance,
  sector2Distance,
  hoverDistance,
  onMouseMove,
  onHoverDistanceChange,
  onZoomDomainChange,
}) => {
  const { t } = useI18n();
  const [layout, setLayout] = useState<StripLayout>(loadStripLayout);
  const updateLayout = (next: StripLayout) => {
    setLayout(next);
    saveStripLayout(next);
  };

  const visible = layout.order.filter((id) => available.includes(id) && !layout.hidden.includes(id));
  const hidden = layout.order.filter((id) => available.includes(id) && layout.hidden.includes(id));

  // Drag to zoom: from where the button went down to where it came up. A press before the chart
  // knows the pointer's position starts the drag at the first position it reports.
  type Drag = { start: number | null; end: number | null } | null;
  const [drag, setDragState] = useState<Drag>(null);
  const dragRef = useRef<Drag>(null);
  const setDrag = useCallback((next: Drag) => {
    dragRef.current = next;
    setDragState(next);
  }, []);
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    // A release outside the strips drops the drag
    const cancel = () => setDrag(null);
    window.addEventListener('mouseup', cancel);
    return () => window.removeEventListener('mouseup', cancel);
  }, [dragging, setDrag]);

  const handleMouseDown = useCallback(
    (state: unknown) => {
      const d = labelDistance(state);
      setDrag({ start: d, end: d });
    },
    [setDrag]
  );

  const handleMouseMove = useCallback(
    (state: unknown) => {
      onMouseMove(state as RechartsMouseMoveState<MergedTelemetryPoint>);
      const d = labelDistance(state);
      const prev = dragRef.current;
      if (d !== null && prev) setDrag({ start: prev.start ?? d, end: d });
    },
    [onMouseMove, setDrag]
  );

  const handleMouseUp = useCallback(() => {
    const prev = dragRef.current;
    setDrag(null);
    const range = prev?.start != null && prev.end != null ? dragZoomRange(prev.start, prev.end) : null;
    if (range) onZoomDomainChange(range);
  }, [onZoomDomainChange, setDrag]);

  const point = useMemo(() => pointAt(chartData, hoverDistance), [chartData, hoverDistance]);
  const lastVisible = visible[visible.length - 1];

  return (
    <div className={styles.wrap} data-dragging={dragging || undefined}>
      <p className={styles.hint}>{t('comparator.strips.dragHint')}</p>
      <ul className={styles.strips} aria-label={t('comparator.strips.label')}>
        {visible.map((id, index) => {
          const trace = STRIP_TRACES[id];
          const label = t(trace.labelKey);
          const isLast = id === lastVisible;
          return (
            <li key={id} className={styles.strip} data-axis={isLast || undefined} data-trace={id}>
              <div className={styles.side}>
                <div className={styles.name}>{label}</div>
                <dl className={styles.values}>
                  {trace.lines.map((line) => {
                    const value = point?.[line.dataKey];
                    const format = line.slot === 'b' ? formatB : formatA;
                    return (
                      <div key={line.dataKey} data-slot={line.slot}>
                        <dt className="sr-only">{line.slot ? (line.slot === 'a' ? nameA : nameB) : label}</dt>
                        <dd>
                          {typeof value === 'number' && Number.isFinite(value)
                            ? trace.format(value, { packetFormat: format, t })
                            : '—'}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <div className={styles.controls}>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label={t('comparator.strips.moveUp', { trace: label })}
                    disabled={index === 0}
                    onClick={() => updateLayout(moveStripTrace(layout, id, -1, visible))}
                  >
                    <ChevronUp size={12} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label={t('comparator.strips.moveDown', { trace: label })}
                    disabled={isLast}
                    onClick={() => updateLayout(moveStripTrace(layout, id, 1, visible))}
                  >
                    <ChevronDown size={12} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label={t('comparator.strips.hide', { trace: label })}
                    onClick={() => updateLayout({ ...layout, hidden: [...layout.hidden, id] })}
                  >
                    <EyeOff size={12} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>

              <div className={styles.chart} aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    syncId="comparatorStrips"
                    accessibilityLayer={false}
                    margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => onHoverDistanceChange(null)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.GRID_STROKE} vertical={false} />
                    <XAxis
                      dataKey="lap_distance"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      allowDataOverflow
                      hide={!isLast}
                      stroke={CHART_COLORS.AXIS_STROKE}
                      tick={{ fill: CHART_COLORS.AXIS_TICK, fontSize: 10 }}
                      unit="m"
                      height={20}
                    />
                    <YAxis
                      width={40}
                      domain={trace.domain}
                      ticks={trace.ticks}
                      allowDataOverflow={trace.domain[0] !== 'auto'}
                      stroke={CHART_COLORS.AXIS_STROKE}
                      tick={{ fill: CHART_COLORS.AXIS_TICK, fontSize: 9 }}
                      tickFormatter={(v: number) => (trace.axis ? trace.axis(v) : trace.format(v, { t }))}
                    />
                    {/* Hover state for the shared cursor; the values show beside the strip */}
                    <Tooltip content={() => null} cursor={false} isAnimationActive={false} />
                    {trace.zeroLine && <ReferenceLine y={0} stroke={CHART_COLORS.AXIS_STROKE} />}
                    {sector1Distance !== null && (
                      <ReferenceLine x={sector1Distance} stroke={CHART_COLORS.SECTOR_1} strokeDasharray="3 3" />
                    )}
                    {sector2Distance !== null && (
                      <ReferenceLine x={sector2Distance} stroke={CHART_COLORS.SECTOR_2} strokeDasharray="3 3" />
                    )}
                    {hoverDistance !== null && (
                      <ReferenceLine x={hoverDistance} stroke={CHART_COLORS.CURSOR} strokeWidth={1.5} />
                    )}
                    {drag?.start != null && drag.end != null && (
                      <ReferenceArea
                        x1={Math.min(drag.start, drag.end)}
                        x2={Math.max(drag.start, drag.end)}
                        fill={CHART_COLORS.CURSOR}
                        fillOpacity={0.15}
                        stroke={CHART_COLORS.CURSOR}
                        strokeOpacity={0.5}
                      />
                    )}
                    {trace.lines.map((line) => (
                      <Line
                        key={line.dataKey}
                        type={trace.step ? 'stepAfter' : 'monotone'}
                        dataKey={line.dataKey}
                        stroke={line.stroke}
                        strokeDasharray={line.slot === 'b' ? '4 3' : undefined}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </li>
          );
        })}
      </ul>

      {(hidden.length > 0 || layout.order.join() !== DEFAULT_STRIP_LAYOUT.order.join()) && (
        <div className={styles.footer}>
          {hidden.length > 0 && (
            <div className={styles.hidden} role="group" aria-label={t('comparator.strips.hiddenLabel')}>
              <span className={styles.hiddenLabel}>{t('comparator.strips.hiddenLabel')}</span>
              {hidden.map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant="ghost"
                  icon={<Plus size={12} aria-hidden="true" />}
                  onClick={() => updateLayout({ ...layout, hidden: layout.hidden.filter((h) => h !== id) })}
                >
                  {t(STRIP_TRACES[id].labelKey)}
                </Button>
              ))}
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={12} aria-hidden="true" />}
            onClick={() => updateLayout(DEFAULT_STRIP_LAYOUT)}
          >
            {t('comparator.strips.resetLayout')}
          </Button>
        </div>
      )}
    </div>
  );
};
