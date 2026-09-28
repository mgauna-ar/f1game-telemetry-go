import type { MergedTelemetryPoint, TrackTurn, TurnContextInfo } from '../types/comparator';

export type { TrackTurn, TurnContextInfo };

/**
 * Returns contextual description of where the car / cursor is relative to turns
 */
export function getTurnContextAtDistance(turns: TrackTurn[], distance: number | null | undefined): TurnContextInfo {
  if (distance === null || distance === undefined || turns.length === 0) {
    return { turn: null, phase: 'straight', label: '' };
  }

  // 1. Check if inside turn apex/entry/exit zone
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const diff = distance - t.distance;

    // Apex zone: ±15 meters
    if (Math.abs(diff) <= 15) {
      return { turn: t, phase: 'apex', label: `${t.name} (Apex)` };
    }
    // Entry zone: -45m to -15m
    if (diff > -45 && diff < -15) {
      return { turn: t, phase: 'entry', label: `${t.name} (Entry)` };
    }
    // Exit zone: +15m to +45m
    if (diff > 15 && diff < 45) {
      return { turn: t, phase: 'exit', label: `${t.name} (Exit)` };
    }
  }

  // 2. If between turns, find which ones
  for (let i = 0; i < turns.length - 1; i++) {
    const t1 = turns[i];
    const t2 = turns[i + 1];
    if (distance >= t1.distance && distance <= t2.distance) {
      return { turn: null, phase: 'straight', label: `Straight (${t1.name} → ${t2.name})` };
    }
  }

  if (distance < turns[0].distance) {
    return { turn: null, phase: 'straight', label: `Main Straight (Start → ${turns[0].name})` };
  }

  const lastTurn = turns[turns.length - 1];
  return { turn: null, phase: 'straight', label: `Final Straight (${lastTurn.name} → Finish)` };
}

/** How far before its apex a corner's stretch starts at most, in meters (it also stops halfway to the previous apex). */
export const CORNER_APPROACH_MAX_METERS = 250;
/** How far after its apex a corner's stretch ends at most, in meters (it also stops halfway to the next apex). */
export const CORNER_EXIT_MAX_METERS = 150;
/** Brake pressure (0–1) from which the car counts as braking. */
export const CORNER_BRAKE_ON = 0.1;
/** Throttle (0–1) from which the car counts as back on the power after the slowest point. */
export const CORNER_THROTTLE_PICKUP = 0.5;

/** One lap's numbers through a corner. */
export interface CornerMetrics {
  /** The top speed on the way in (km/h). */
  entrySpeed: number | null;
  /** The slowest speed through the corner (km/h). */
  minSpeed: number | null;
  /** Where braking starts, in meters before the apex; null when the corner is taken without braking. */
  brakingBeforeApex: number | null;
  /** Where the throttle comes back after the slowest point, in meters from the apex (negative: before it). */
  throttleFromApex: number | null;
}

/** A corner of the lap comparison: its stretch of the lap and both laps' numbers through it. */
export interface CornerAnalysis {
  turn: TrackTurn;
  /** The corner's stretch in lap meters, [start, end]: the range the charts zoom to. */
  range: [number, number];
  a: CornerMetrics;
  b: CornerMetrics;
  /** Time lap A lost (+) or gained (−) on lap B through the corner, in seconds. */
  timeDelta: number | null;
}

type Slot = 'A' | 'B';

const EMPTY_METRICS: CornerMetrics = {
  entrySpeed: null,
  minSpeed: null,
  brakingBeforeApex: null,
  throttleFromApex: null,
};

function cornerMetrics(points: MergedTelemetryPoint[], apex: number, slot: Slot): CornerMetrics {
  const speed = (p: MergedTelemetryPoint) => (slot === 'A' ? p.speedA : p.speedB);
  const withSpeed = points.filter((p) => speed(p) !== null);
  if (withSpeed.length === 0) return EMPTY_METRICS;

  let entrySpeed: number | null = null;
  let slowest = withSpeed[0];
  for (const p of withSpeed) {
    const v = speed(p)!;
    if (p.lap_distance <= apex && (entrySpeed === null || v > entrySpeed)) entrySpeed = v;
    if (v < speed(slowest)!) slowest = p;
  }

  const brake = (p: MergedTelemetryPoint) => (slot === 'A' ? p.brakeA : p.brakeB) ?? 0;
  const brakingPoint = points.find((p) => p.lap_distance <= apex && brake(p) >= CORNER_BRAKE_ON);

  const throttle = (p: MergedTelemetryPoint) => (slot === 'A' ? p.throttleA : p.throttleB) ?? 0;
  const pickup = points.find((p) => p.lap_distance >= slowest.lap_distance && throttle(p) >= CORNER_THROTTLE_PICKUP);

  return {
    entrySpeed,
    minSpeed: speed(slowest),
    brakingBeforeApex: brakingPoint ? Math.round(apex - brakingPoint.lap_distance) : null,
    throttleFromApex: pickup ? Math.round(pickup.lap_distance - apex) : null,
  };
}

/** The time delta (A − B, seconds) at the first and last point of a stretch that have one. */
function deltaAcross(points: MergedTelemetryPoint[]): number | null {
  const first = points.find((p) => p.time_delta !== null);
  const last = [...points].reverse().find((p) => p.time_delta !== null);
  if (!first || !last || first === last) return null;
  return last.time_delta! - first.time_delta!;
}

/**
 * Where the time went, corner by corner: each detected turn gets the stretch from halfway to the
 * previous apex (at most `CORNER_APPROACH_MAX_METERS` before its own) to halfway to the next (at
 * most `CORNER_EXIT_MAX_METERS` after it), and for each lap the entry and minimum speed, the
 * braking point and the throttle pickup in it, plus the time lap A gained or lost there.
 */
export function analyzeCorners(points: MergedTelemetryPoint[], turns: TrackTurn[]): CornerAnalysis[] {
  if (points.length === 0 || turns.length === 0) return [];
  const lapEnd = points[points.length - 1].lap_distance;
  const ordered = [...turns].sort((x, y) => x.distance - y.distance);

  return ordered.map((turn, i) => {
    const first = i === 0;
    const last = i === ordered.length - 1;
    const start = Math.max(
      first ? 0 : (ordered[i - 1].distance + turn.distance) / 2,
      turn.distance - CORNER_APPROACH_MAX_METERS
    );
    const end = Math.min(
      last ? lapEnd : (turn.distance + ordered[i + 1].distance) / 2,
      turn.distance + CORNER_EXIT_MAX_METERS
    );
    const range: [number, number] = [Math.round(start), Math.round(end)];
    const inCorner = points.filter((p) => p.lap_distance >= range[0] && p.lap_distance <= range[1]);
    return {
      turn,
      range,
      a: cornerMetrics(inCorner, turn.distance, 'A'),
      b: cornerMetrics(inCorner, turn.distance, 'B'),
      timeDelta: deltaAcross(inCorner),
    };
  });
}
