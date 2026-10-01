import { describe, it, expect } from 'vitest';
import { HUB_PANELS, isRaceControlLayout, sessionBestSectors, sessionFastestLap, theoreticalBest, trackPositions } from './raceControl';
import { makeLiveLap, makeLiveLapTimes } from '../test/wireFactories';
import { PIT_STATUS, RACE_CONTROL_LAYOUTS, RESULT_STATUS } from '../constants/f1';

describe('raceControl', () => {
  it('finds the session best sectors and adds them up', () => {
    const sectors = sessionBestSectors([
      makeLiveLapTimes({ BestSectorsMS: [28_000, 31_500, 0] }),
      undefined,
      makeLiveLapTimes({ BestSectorsMS: [28_100, 31_000, 26_000] }),
    ]);
    expect(sectors).toEqual([
      { time: 28_000, carIndex: 0 },
      { time: 31_000, carIndex: 2 },
      { time: 26_000, carIndex: 2 },
    ]);
    expect(theoreticalBest(sectors)).toBe(85_000);
    expect(theoreticalBest(sessionBestSectors([makeLiveLapTimes({ BestSectorsMS: [1, 2, 0] })]))).toBe(0);
    expect(sessionFastestLap([0, 86_000, 85_500])).toEqual({ time: 85_500, carIndex: 2 });
    expect(sessionFastestLap([])).toEqual({ time: 0, carIndex: -1 });
  });

  it('places running cars round the lap and in the pit lane', () => {
    const laps = [
      makeLiveLap({ CarPosition: 1, LapDistance: 2_500, ResultStatus: RESULT_STATUS.ACTIVE }),
      makeLiveLap({ CarPosition: 2, LapDistance: -100, ResultStatus: RESULT_STATUS.ACTIVE }),
      makeLiveLap({ CarPosition: 3, LapDistance: 100, ResultStatus: RESULT_STATUS.ACTIVE, PitStatus: PIT_STATUS.PITTING }),
      makeLiveLap({ CarPosition: 4, LapDistance: 900, ResultStatus: RESULT_STATUS.RETIRED }),
      makeLiveLap({ CarPosition: 0, ResultStatus: RESULT_STATUS.INACTIVE }),
    ];
    expect(trackPositions(laps, 5_000)).toEqual([
      { carIndex: 0, position: 1, fraction: 0.5, inPit: false },
      { carIndex: 1, position: 2, fraction: 0.98, inPit: false },
      { carIndex: 2, position: 3, fraction: 0.02, inPit: true },
    ]);
    expect(trackPositions(laps, 0)).toEqual([]);
  });

  it('knows its layouts', () => {
    expect(HUB_PANELS[RACE_CONTROL_LAYOUTS.RACE]).toEqual(['feed', 'pit']);
    expect(isRaceControlLayout('row')).toBe(true);
    expect(isRaceControlLayout('bogus')).toBe(false);
  });
});
