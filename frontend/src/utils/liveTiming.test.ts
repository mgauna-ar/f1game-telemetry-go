import { describe, it, expect } from 'vitest';
import { carAtPosition, deltaToCarInFrontMs, mergeBestLaps } from './liveTiming';
import { makeLiveLap } from '../test/wireFactories';

describe('liveTiming', () => {
  it('keeps each car’s best lap and the same array when nothing improved', () => {
    const best = mergeBestLaps([], [makeLiveLap({ LastLapTimeInMS: 91_000 }), makeLiveLap({ LastLapTimeInMS: 0 })]);
    expect(best).toEqual([91_000]);
    expect(mergeBestLaps(best, [makeLiveLap({ LastLapTimeInMS: 92_000 })])).toBe(best);
    expect(mergeBestLaps(best, [makeLiveLap({ LastLapTimeInMS: 90_500 })])).toEqual([90_500]);
  });

  it('prefers the game’s best lap from the session history, which leaves out invalid laps', () => {
    const laps = [makeLiveLap({ LastLapTimeInMS: 89_000 }), makeLiveLap({ LastLapTimeInMS: 90_000 })];
    const best = mergeBestLaps([], laps, [{ BestLapTimeInMS: 90_500 }, undefined]);
    expect(best).toEqual([90_500, 90_000]);
    expect(mergeBestLaps(best, laps, [{ BestLapTimeInMS: 90_500 }, undefined])).toBe(best);
  });

  it('reads the gap to the car in front and finds cars by position', () => {
    expect(deltaToCarInFrontMs(makeLiveLap({ DeltaToCarInFrontMinutesPart: 1, DeltaToCarInFrontMSPart: 2_345 }))).toBe(
      62_345
    );
    expect(deltaToCarInFrontMs(undefined)).toBe(0);
    const laps = [makeLiveLap({ CarPosition: 2 }), makeLiveLap({ CarPosition: 1 })];
    expect(carAtPosition(laps, 1)).toBe(1);
    expect(carAtPosition(laps, 3)).toBe(-1);
    expect(carAtPosition(laps, 0)).toBe(-1);
  });
});
