import { PENALTY_TYPES, SAFETY_CAR_STATUS } from '../constants/f1';
import type { FeedEvent, ProgressionRow } from '../types/session';

/** A stretch of the race under the safety car or the virtual safety car, in the leader's laps. */
export interface RaceControlPeriod {
  kind: 'sc' | 'vsc';
  startLap: number;
  /** Null when the session ended before the period did. */
  endLap: number | null;
}

/**
 * The safety car and virtual safety car periods of a session, read from its stored SCAR rows
 * (the same rule as the server's `analytics.RaceControlPeriods`).
 */
export function raceControlPeriods(events: readonly FeedEvent[]): RaceControlPeriod[] {
  const periods: RaceControlPeriod[] = [];
  let open: RaceControlPeriod | null = null;
  for (const e of events) {
    if (e.eventCode !== 'SCAR' || e.safetyCarStatus === undefined) continue;
    if (e.safetyCarStatus === SAFETY_CAR_STATUS.FORMATION_LAP) continue;
    const lap = e.raceLap ?? 0;
    // A change of status ends the open period, including a VSC turning into a full SC
    if (open) {
      open.endLap = Math.max(lap, open.startLap);
      open = null;
    }
    const kind =
      e.safetyCarStatus === SAFETY_CAR_STATUS.FULL
        ? 'sc'
        : e.safetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL
          ? 'vsc'
          : null;
    if (kind) {
      open = { kind, startLap: lap, endLap: null };
      periods.push(open);
    }
  }
  return periods;
}

/** One row of the key-moments timeline. */
export interface KeyMoment {
  event: FeedEvent;
  /** The leader's lap when it happened (0 before the start). */
  lap: number;
  /** It's about your car. */
  mine: boolean;
}

/** Penalties that change a result; warnings, reminders and lap invalidations are left out unless they're yours. */
const SERIOUS_PENALTIES: ReadonlySet<number> = new Set([
  PENALTY_TYPES.DRIVE_THROUGH,
  PENALTY_TYPES.STOP_GO,
  PENALTY_TYPES.GRID_PENALTY,
  PENALTY_TYPES.TIME_PENALTY,
  PENALTY_TYPES.DISQUALIFIED,
]);

const isLapInvalidation = (type: number | undefined) =>
  type !== undefined && type >= PENALTY_TYPES.LAP_INVALIDATED_MIN && type <= PENALTY_TYPES.LAP_INVALIDATED_MAX;

/**
 * The moments worth telling from a session's race-control feed: the start and the flags, safety
 * cars, retirements, disqualifications and penalties that change a result, the fastest lap that
 * stood, and everything about your car (overtakes, pit stops, collisions and penalties).
 * Other cars' overtakes, pit stops and speed traps are left out.
 */
export function keyMoments(events: readonly FeedEvent[], playerCarIndex: number | null): KeyMoment[] {
  const isMe = (idx: number | undefined) => playerCarIndex !== null && idx === playerCarIndex;
  let lastFastestLap = -1;
  events.forEach((e, i) => {
    if (e.eventCode === 'FTLP') lastFastestLap = i;
  });

  const moments: KeyMoment[] = [];
  events.forEach((e, i) => {
    // An overtake or a collision is yours from either side; anything else only when it's about your car
    const mine = isMe(e.vehicleIdx) || ((e.eventCode === 'OVTK' || e.eventCode === 'COLL') && isMe(e.otherVehicleIdx));
    let keep = false;
    switch (e.eventCode) {
      case 'LGOT':
      case 'RDFL':
      case 'CHQF':
      case 'RCWN':
      case 'RTMT':
      case 'DSQ':
        keep = true;
        break;
      case 'SCAR':
        keep = e.safetyCarStatus !== SAFETY_CAR_STATUS.FORMATION_LAP;
        break;
      case 'PENA':
        keep =
          (e.penaltyType === undefined ? (e.penaltyTime ?? 0) > 0 : SERIOUS_PENALTIES.has(e.penaltyType)) ||
          (isMe(e.vehicleIdx) && !isLapInvalidation(e.penaltyType));
        break;
      case 'FTLP':
        keep = i === lastFastestLap || mine;
        break;
      case 'OVTK':
      case 'COLL':
      case 'TMPT':
      case 'DTSV':
      case 'SGSV':
        keep = mine;
        break;
    }
    if (keep) moments.push({ event: e, lap: e.raceLap ?? 0, mine });
  });
  return moments;
}

/** The moments grouped by lap, in order. */
export function momentsByLap(moments: readonly KeyMoment[]): Array<{ lap: number; moments: KeyMoment[] }> {
  const groups: Array<{ lap: number; moments: KeyMoment[] }> = [];
  for (const m of moments) {
    const last = groups[groups.length - 1];
    if (last && last.lap === m.lap) last.moments.push(m);
    else groups.push({ lap: m.lap, moments: [m] });
  }
  return groups;
}

/** A lap of your race against the field: your lap time and the field's median and fastest, in seconds. */
export interface FieldPaceRow {
  lapNumber: number;
  you: number | null;
  median: number | null;
  fastest: number | null;
}

export interface FieldPace {
  rows: FieldPaceRow[];
  /** Your average gap to the field's median over the laps both have a clean time for; negative is faster. */
  averageToMedian: number | null;
  /** How many laps that average covers. */
  comparedLaps: number;
}

/** The fewest clean times a lap needs for a field median. */
const MIN_FIELD_CARS = 3;

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Your lap times against the field's, from the server's lap pace rows. In and out laps and slow
 * laps (the server's outlier rule) are left out of everyone's times, and laps under the safety
 * car or VSC out of the average, so the comparison is about racing pace. A lap needs clean times
 * from at least a third of the field (and 3 cars) for a median.
 */
export function fieldPace(
  lapPace: readonly ProgressionRow[] | undefined,
  playerCarIndex: number,
  carIndices: readonly number[],
  neutralisedLaps: ReadonlySet<number> = new Set()
): FieldPace {
  const rows: FieldPaceRow[] = [];
  let sum = 0;
  let compared = 0;
  for (const row of lapPace ?? []) {
    const clean = (car: number): number | null => {
      const value = row[`driver_${car}`];
      return typeof value === 'number' && value > 0 && !row[`driver_${car}_is_outlier`] ? value : null;
    };
    const field = carIndices.map(clean).filter((v): v is number => v !== null);
    const you = clean(playerCarIndex);
    // A lap most of the field has no clean time for (a safety car the session didn't store) has
    // no field line: the few times left would make it spike
    const enough = field.length >= Math.max(MIN_FIELD_CARS, Math.ceil(carIndices.length / 3));
    const med = enough ? median(field) : null;
    rows.push({ lapNumber: row.lapNumber, you, median: med, fastest: enough ? Math.min(...field) : null });
    if (you !== null && med !== null && !neutralisedLaps.has(row.lapNumber)) {
      sum += you - med;
      compared++;
    }
  }
  return { rows, averageToMedian: compared ? sum / compared : null, comparedLaps: compared };
}

/** Every lap inside a safety car or VSC period, up to `lastLap` for a period still open at the end. */
export function neutralisedLaps(periods: readonly RaceControlPeriod[], lastLap: number): Set<number> {
  const laps = new Set<number>();
  for (const p of periods) {
    for (let lap = p.startLap; lap <= (p.endLap ?? lastLap); lap++) laps.add(lap);
  }
  return laps;
}
