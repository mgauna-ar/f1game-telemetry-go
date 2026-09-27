import { describe, expect, it } from 'vitest';
import type { FeedEvent } from '../types/session';
import { fieldPace, keyMoments, momentsByLap, neutralisedLaps, raceControlPeriods } from './raceStory';

const sc = (status: number, raceLap: number): FeedEvent => ({
  eventCode: 'SCAR',
  type: 'flag',
  severity: 'warning',
  safetyCarStatus: status,
  raceLap,
});

describe('raceControlPeriods', () => {
  it('reads the SC and VSC periods, a VSC turning into an SC, and one still open at the end', () => {
    expect(raceControlPeriods([sc(3, 0), sc(0, 1), sc(2, 8), sc(1, 9), sc(0, 12), sc(2, 40)])).toEqual([
      { kind: 'vsc', startLap: 8, endLap: 9 },
      { kind: 'sc', startLap: 9, endLap: 12 },
      { kind: 'vsc', startLap: 40, endLap: null },
    ]);
    expect(raceControlPeriods([])).toEqual([]);
  });

  it('lists the laps they cover', () => {
    expect([
      ...neutralisedLaps(
        [
          { kind: 'sc', startLap: 3, endLap: 4 },
          { kind: 'vsc', startLap: 9, endLap: null },
        ],
        10
      ),
    ]).toEqual([3, 4, 9, 10]);
  });
});

describe('keyMoments', () => {
  const events: FeedEvent[] = [
    { eventCode: 'LGOT', type: 'general', severity: 'success', raceLap: 1 },
    { eventCode: 'OVTK', type: 'overtake', severity: 'info', vehicleIdx: 5, otherVehicleIdx: 6, raceLap: 2 },
    { eventCode: 'OVTK', type: 'overtake', severity: 'info', vehicleIdx: 3, otherVehicleIdx: 6, raceLap: 2 },
    { eventCode: 'TMPT', type: 'pit', severity: 'warning', vehicleIdx: 4, raceLap: 5 },
    { eventCode: 'TMPT', type: 'pit', severity: 'warning', vehicleIdx: 3, raceLap: 6 },
    { eventCode: 'FTLP', type: 'fastest_lap', severity: 'purple', vehicleIdx: 7, raceLap: 7 },
    { eventCode: 'PENA', type: 'penalty', severity: 'warning', vehicleIdx: 8, penaltyType: 5, raceLap: 8 },
    // A rival's drive-through for blocking you is not yours
    {
      eventCode: 'PENA',
      type: 'penalty',
      severity: 'warning',
      vehicleIdx: 8,
      otherVehicleIdx: 3,
      penaltyType: 0,
      raceLap: 8,
    },
    { eventCode: 'PENA', type: 'penalty', severity: 'warning', vehicleIdx: 3, penaltyType: 5, raceLap: 8 },
    { eventCode: 'PENA', type: 'penalty', severity: 'warning', vehicleIdx: 3, penaltyType: 10, raceLap: 8 },
    {
      eventCode: 'PENA',
      type: 'penalty',
      severity: 'warning',
      vehicleIdx: 9,
      penaltyType: 4,
      penaltyTime: 5,
      raceLap: 9,
    },
    sc(1, 10),
    { eventCode: 'SPTP', type: 'speed_trap', severity: 'success', vehicleIdx: 3, raceLap: 11 },
    { eventCode: 'FTLP', type: 'fastest_lap', severity: 'purple', vehicleIdx: 2, raceLap: 20 },
  ];

  it('keeps the race story and everything about your car', () => {
    const moments = keyMoments(events, 3);
    expect(moments.map((m) => `${m.lap}:${m.event.eventCode}${m.mine ? '*' : ''}`)).toEqual([
      '1:LGOT',
      '2:OVTK*', // your overtake; the other one is left out
      '6:TMPT*', // your pit stop; car 4's is left out
      '8:PENA', // a rival's drive-through
      '8:PENA*', // your warning; a rival's warning and your lap invalidation are left out
      '9:PENA', // a time penalty
      '10:SCAR',
      '20:FTLP', // only the fastest lap that stood
    ]);
  });

  it('groups moments by lap', () => {
    const groups = momentsByLap(keyMoments(events, null));
    expect(groups.map((g) => [g.lap, g.moments.length])).toEqual([
      [1, 1],
      [8, 1],
      [9, 1],
      [10, 1],
      [20, 1],
    ]);
  });
});

describe('fieldPace', () => {
  const rows = [
    { lapNumber: 1, driver_0: 90, driver_1: 91, driver_2: 92 },
    { lapNumber: 2, driver_0: 89, driver_1: 90, driver_2: 120, driver_2_is_outlier: true },
    { lapNumber: 3, driver_0: 110, driver_1: 111, driver_2: 112 },
    { lapNumber: 4, driver_0: 88.5, driver_1: 89.5, driver_2: 90.5 },
  ];

  it('compares your laps with the field median, leaving out outliers and neutralised laps', () => {
    const pace = fieldPace(rows, 0, [0, 1, 2], new Set([3]));
    expect(pace.rows[0]).toEqual({ lapNumber: 1, you: 90, median: 91, fastest: 90 });
    // Lap 2 has two clean times of three cars: too few for a median
    expect(pace.rows[1]).toEqual({ lapNumber: 2, you: 89, median: null, fastest: null });
    // Laps 1 and 4 count (lap 3 is neutralised): −1 each
    expect(pace.comparedLaps).toBe(2);
    expect(pace.averageToMedian).toBeCloseTo(-1);
  });

  it('has no average without laps to compare', () => {
    expect(fieldPace([], 0, [0]).averageToMedian).toBeNull();
  });
});

describe('fieldPace on a lap most of the field has no clean time for', () => {
  it('leaves the field line out instead of letting a few times make it spike', () => {
    const cars = [0, 1, 2, 3, 4, 5];
    const row = (lap: number, slow: boolean) => ({
      lapNumber: lap,
      ...Object.fromEntries(
        cars.flatMap((c) => [
          [`driver_${c}`, slow ? 110 + c : 90 + c],
          [`driver_${c}_is_outlier`, slow && c < 4],
        ])
      ),
    });
    const pace = fieldPace([row(1, false), row(2, true)], 0, cars);
    expect(pace.rows[0].median).toBe(92.5);
    // Only cars 4 and 5 have a clean time on lap 2
    expect(pace.rows[1]).toEqual({ lapNumber: 2, you: null, median: null, fastest: null });
  });
});
