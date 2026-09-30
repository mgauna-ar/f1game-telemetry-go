import { PIT_STATUS, RACE_CONTROL_LAYOUTS, RESULT_STATUS, type RaceControlLayout } from '../constants/f1';
import type { LapData, LapTimes } from '../types/telemetry';

/** A session best and the car that set it: time 0 and car -1 until someone sets it. */
export interface SessionBest {
  time: number;
  carIndex: number;
}

const NO_BEST: SessionBest = { time: 0, carIndex: -1 };

const fastest = (times: readonly (number | undefined)[]): SessionBest =>
  times.reduce<SessionBest>(
    (best, time, carIndex) => (time && time > 0 && (best.time === 0 || time < best.time) ? { time, carIndex } : best),
    NO_BEST
  );

/** The session's fastest S1, S2 and S3, from each car's best sectors in the session history. */
export function sessionBestSectors(lapTimes: readonly (LapTimes | undefined)[]): [SessionBest, SessionBest, SessionBest] {
  return [0, 1, 2].map((sector) => fastest(lapTimes.map((t) => t?.BestSectorsMS[sector]))) as [
    SessionBest,
    SessionBest,
    SessionBest,
  ];
}

/** The session's fastest lap, from each car's best lap. */
export const sessionFastestLap = (bestLapTimes: readonly number[]): SessionBest => fastest(bestLapTimes);

/** The session's best three sectors added up, or 0 until all three are set. */
export const theoreticalBest = (sectors: readonly SessionBest[]): number =>
  sectors.every((s) => s.time > 0) ? sectors.reduce((sum, s) => sum + s.time, 0) : 0;

/** One of the four Race Control hub panels. */
export type HubPanel = 'feed' | 'weather' | 'pit' | 'sectors';

/** The hub panels each layout shows, in order. */
export const HUB_PANELS: Record<RaceControlLayout, readonly HubPanel[]> = {
  [RACE_CONTROL_LAYOUTS.GRID]: ['feed', 'weather', 'pit', 'sectors'],
  [RACE_CONTROL_LAYOUTS.ROW]: ['feed', 'weather', 'pit', 'sectors'],
  [RACE_CONTROL_LAYOUTS.RACE]: ['feed', 'pit'],
  [RACE_CONTROL_LAYOUTS.TIMING]: ['sectors', 'feed'],
};

export const isRaceControlLayout = (value: unknown): value is RaceControlLayout =>
  Object.values(RACE_CONTROL_LAYOUTS).includes(value as RaceControlLayout);

/** A car on the track position strip. */
export interface TrackDot {
  carIndex: number;
  position: number;
  /** How far round the lap the car is, from 0 at the line to just under 1. */
  fraction: number;
  inPit: boolean;
}

const isRunning = (lap: LapData): boolean =>
  lap.ResultStatus === RESULT_STATUS.ACTIVE || lap.ResultStatus === RESULT_STATUS.FINISHED;

/**
 * Where each running car is round the lap, by lap distance over the track length. Empty until
 * the track length is known. A car before the line on its first lap (negative distance) is near 1.
 */
export function trackPositions(laps: readonly (LapData | undefined)[], trackLength: number): TrackDot[] {
  if (!(trackLength > 0)) return [];
  const dots: TrackDot[] = [];
  laps.forEach((lap, carIndex) => {
    if (!lap || lap.CarPosition <= 0 || !isRunning(lap)) return;
    const distance = ((lap.LapDistance % trackLength) + trackLength) % trackLength;
    dots.push({
      carIndex,
      position: lap.CarPosition,
      fraction: distance / trackLength,
      inPit: lap.PitStatus !== PIT_STATUS.NONE,
    });
  });
  return dots;
}
