import { TIME_CONSTANTS } from '../constants/f1';
import type { LapData, LapTimes } from '../types/telemetry';

type TimingLap = Pick<LapData, 'LastLapTimeInMS'>;

/**
 * Each car's best completed lap so far. The game's own best from the session history wins, since
 * it leaves out invalid laps; before a car's history arrives, the lower of the best kept and the
 * last lap now reported. Returns `best` itself when nothing changed, so a store keeps its reference.
 */
export function mergeBestLaps(
  best: readonly number[],
  laps: readonly (TimingLap | undefined)[],
  lapTimes?: readonly (Pick<LapTimes, 'BestLapTimeInMS'> | undefined)[]
): number[] {
  let next: number[] | null = null;
  laps.forEach((lap, idx) => {
    const current = best[idx] ?? 0;
    const historyBest = lapTimes?.[idx]?.BestLapTimeInMS ?? 0;
    const last = lap?.LastLapTimeInMS ?? 0;
    const value = historyBest > 0 ? historyBest : last > 0 && (current === 0 || last < current) ? last : current;
    if (value !== current) {
      next ??= [...best];
      next[idx] = value;
    }
  });
  return next ?? (best as number[]);
}

/** The gap to the car in front, in ms (the packet splits it into minutes and ms). */
export const deltaToCarInFrontMs = (
  lap: Pick<LapData, 'DeltaToCarInFrontMinutesPart' | 'DeltaToCarInFrontMSPart'> | undefined
): number => (lap ? lap.DeltaToCarInFrontMinutesPart * TIME_CONSTANTS.MS_PER_MINUTE + lap.DeltaToCarInFrontMSPart : 0);

/** The index of the car running at a position, or -1. */
export const carAtPosition = (laps: readonly (Pick<LapData, 'CarPosition'> | undefined)[], position: number): number =>
  position > 0 ? laps.findIndex((lap) => lap?.CarPosition === position) : -1;
