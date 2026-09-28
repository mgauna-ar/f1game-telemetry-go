import { getErsModeName } from '../../../constants/f1';
import type { MergedTelemetryPoint } from '../../../types/comparator';
import { storage } from '../../../utils/storage';
import { CHART_COLORS } from './chartDefaults';

/** The traces the strip charts can show, in their default order. */
export const STRIP_TRACE_IDS = [
  'delta',
  'speed',
  'throttle',
  'brake',
  'gear',
  'steering',
  'ersBattery',
  'ersMode',
  'aero',
] as const;

export type StripTraceId = (typeof STRIP_TRACE_IDS)[number];

type NumericKey = {
  [K in keyof MergedTelemetryPoint]-?: NonNullable<MergedTelemetryPoint[K]> extends number ? K : never;
}[keyof MergedTelemetryPoint];

/** One line of a strip: a lap's value, or both laps' difference. */
export interface StripLine {
  dataKey: NumericKey;
  /** Which lap it belongs to, for its colour and name; none for the delta. */
  slot?: 'a' | 'b';
  stroke: string;
}

export interface StripFormatContext {
  /** The packet format, for the ERS mode names. */
  packetFormat?: number | null;
  t: (key: string) => string;
}

export interface StripTrace {
  id: StripTraceId;
  /** Locale key of the strip's short name. */
  labelKey: string;
  lines: StripLine[];
  step?: boolean;
  domain: [number | 'auto', number | 'auto'];
  ticks?: number[];
  zeroLine?: boolean;
  /** A value as the strip's readout and axis show it. */
  format: (value: number, ctx: StripFormatContext) => string;
  /** A y-axis tick, when it should be shorter than `format`. */
  axis?: (value: number) => string;
}

const bothLaps = (a: NumericKey, b: NumericKey): StripLine[] => [
  { dataKey: a, slot: 'a', stroke: CHART_COLORS.SLOT_A },
  { dataKey: b, slot: 'b', stroke: CHART_COLORS.SLOT_B },
];

const percent = (v: number) => `${Math.round(v * 100)}%`;

export const STRIP_TRACES: Record<StripTraceId, StripTrace> = {
  delta: {
    id: 'delta',
    labelKey: 'comparator.strips.traces.delta',
    lines: [{ dataKey: 'time_delta', stroke: CHART_COLORS.DELTA }],
    domain: ['auto', 'auto'],
    zeroLine: true,
    format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(3)}s`,
    axis: (v) => v.toFixed(2),
  },
  speed: {
    id: 'speed',
    labelKey: 'comparator.strips.traces.speed',
    lines: bothLaps('speedA', 'speedB'),
    domain: ['auto', 'auto'],
    format: (v) => `${Math.round(v)}`,
  },
  throttle: {
    id: 'throttle',
    labelKey: 'comparator.strips.traces.throttle',
    lines: bothLaps('throttleA', 'throttleB'),
    domain: [0, 1],
    ticks: [0, 1],
    format: percent,
  },
  brake: {
    id: 'brake',
    labelKey: 'comparator.strips.traces.brake',
    lines: bothLaps('brakeA', 'brakeB'),
    domain: [0, 1],
    ticks: [0, 1],
    format: percent,
  },
  gear: {
    id: 'gear',
    labelKey: 'comparator.strips.traces.gear',
    lines: bothLaps('gearA', 'gearB'),
    step: true,
    domain: [1, 8],
    ticks: [2, 4, 6, 8],
    format: (v) => `${Math.round(v)}`,
  },
  steering: {
    id: 'steering',
    labelKey: 'comparator.strips.traces.steering',
    lines: bothLaps('steerA', 'steerB'),
    domain: [-1, 1],
    ticks: [-1, 0, 1],
    zeroLine: true,
    format: (v) => v.toFixed(2),
  },
  ersBattery: {
    id: 'ersBattery',
    labelKey: 'comparator.strips.traces.ersBattery',
    lines: bothLaps('ersBatteryA', 'ersBatteryB'),
    domain: [0, 100],
    ticks: [0, 50, 100],
    format: (v) => `${Math.round(v)}%`,
  },
  ersMode: {
    id: 'ersMode',
    labelKey: 'comparator.strips.traces.ersMode',
    lines: bothLaps('ersDeployModeA', 'ersDeployModeB'),
    step: true,
    domain: [0, 3],
    ticks: [0, 3],
    format: (v, { packetFormat }) => getErsModeName(Math.round(v), packetFormat),
    axis: String,
  },
  aero: {
    id: 'aero',
    labelKey: 'comparator.strips.traces.aero',
    lines: bothLaps('activeAeroA', 'activeAeroB'),
    step: true,
    domain: [0, 1],
    ticks: [0, 1],
    format: (v, { t }) =>
      t(Math.round(v) === 1 ? 'comparator.charts.activeAeroStraight' : 'comparator.charts.activeAeroCorner'),
    axis: String,
  },
};

/** Which strips show, top to bottom, and which are hidden: remembered per device. */
export interface StripLayout {
  order: StripTraceId[];
  hidden: StripTraceId[];
}

export const DEFAULT_STRIP_LAYOUT: StripLayout = { order: [...STRIP_TRACE_IDS], hidden: [] };

const isTraceId = (value: unknown): value is StripTraceId =>
  typeof value === 'string' && (STRIP_TRACE_IDS as readonly string[]).includes(value);

/**
 * A saved layout made safe to use: unknown ids dropped, duplicates removed, and traces it doesn't
 * mention (added since it was saved) appended in their default order.
 */
export function normalizeStripLayout(saved: unknown): StripLayout {
  const value = (saved ?? {}) as Partial<Record<keyof StripLayout, unknown>>;
  const order = Array.isArray(value.order) ? [...new Set(value.order.filter(isTraceId))] : [];
  for (const id of STRIP_TRACE_IDS) if (!order.includes(id)) order.push(id);
  const hidden = Array.isArray(value.hidden) ? [...new Set(value.hidden.filter(isTraceId))] : [];
  return { order, hidden };
}

export const loadStripLayout = (): StripLayout =>
  normalizeStripLayout(storage.get<unknown>('f1_comparator_strip_layout', DEFAULT_STRIP_LAYOUT));

export const saveStripLayout = (layout: StripLayout): void => storage.set('f1_comparator_strip_layout', layout);

/** Moves a trace one place up (-1) or down (+1) among the given visible traces. */
export function moveStripTrace(
  layout: StripLayout,
  id: StripTraceId,
  direction: -1 | 1,
  visible: StripTraceId[]
): StripLayout {
  const at = visible.indexOf(id);
  const neighbour = visible[at + direction];
  if (at < 0 || !neighbour) return layout;
  const order = [...layout.order];
  const i = order.indexOf(id);
  const j = order.indexOf(neighbour);
  [order[i], order[j]] = [order[j], order[i]];
  return { ...layout, order };
}

/** A drag shorter than this (in lap meters) is a click, not a zoom. */
export const MIN_DRAG_ZOOM_METERS = 20;

/** The zoom a drag from `start` to `end` makes, or null when it is too short to be one. */
export function dragZoomRange(start: number, end: number): [number, number] | null {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  return to - from >= MIN_DRAG_ZOOM_METERS ? [Math.round(from), Math.round(to)] : null;
}
