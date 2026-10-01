import { describe, it, expect } from 'vitest';
import {
  driverFlag,
  driverWarnings,
  ersPercent,
  formatGlanceGap,
  formatSignedDelta,
  playerGaps,
  readGapTrend,
  tyreWearLevel,
} from './driverGlance';
import { makeLiveCarDamage, makeLiveCarStatus, makeLiveLap, makeLiveSession } from '../test/wireFactories';
import { MAX_ERS_STORE_ENERGY_J, PIT_STATUS, SAFETY_CAR_STATUS, VEHICLE_FIA_FLAGS } from '../constants/f1';

describe('driverGlance', () => {
  it('reads gap trends as good or bad for the player, ignoring one measured with another car', () => {
    const trend = (ChangePerLapMS: number) => ({ CarIndex: 3, ChangePerLapMS, Laps: 3 });
    expect(readGapTrend(trend(-120), 3, 'ahead')).toEqual({ direction: 'closing', good: true, perLapMs: 120 });
    expect(readGapTrend(trend(-120), 3, 'behind')).toEqual({ direction: 'closing', good: false, perLapMs: 120 });
    expect(readGapTrend(trend(200), 3, 'ahead')).toMatchObject({ direction: 'opening', good: false });
    expect(readGapTrend(trend(200), 3, 'behind')).toMatchObject({ direction: 'opening', good: true });
    expect(readGapTrend(trend(30), 3, 'ahead')).toMatchObject({ direction: 'stable' });
    expect(readGapTrend(trend(-120), 5, 'ahead')).toBeNull();
    expect(readGapTrend(null, 3, 'ahead')).toBeNull();
  });

  it('finds the gaps to the cars either side of the player', () => {
    const laps = [
      makeLiveLap({ CarPosition: 2, DeltaToCarInFrontMSPart: 1_234 }),
      makeLiveLap({ CarPosition: 1 }),
      makeLiveLap({ CarPosition: 3, DeltaToCarInFrontMSPart: 800 }),
    ];
    const gaps = playerGaps(laps, 0, { CarIndex: 1, ChangePerLapMS: -100, Laps: 2 }, null);
    expect(gaps.ahead).toEqual({ carIndex: 1, ms: 1_234, trend: { direction: 'closing', good: true, perLapMs: 100 } });
    expect(gaps.behind).toEqual({ carIndex: 2, ms: 800, trend: null });
    expect(playerGaps(laps, 1, null, null).ahead).toBeNull();
    expect(playerGaps([], 0, null, null)).toEqual({ ahead: null, behind: null });
  });

  it('puts the safety car before the car’s own flag, and shows nothing under green', () => {
    const sc = makeLiveSession({ SafetyCarStatus: SAFETY_CAR_STATUS.FULL });
    const clear = makeLiveSession({ SafetyCarStatus: SAFETY_CAR_STATUS.CLEAR });
    expect(driverFlag(sc, makeLiveCarStatus({ VehicleFIAFlags: VEHICLE_FIA_FLAGS.BLUE }))).toBe('safetyCar');
    expect(driverFlag(makeLiveSession({ SafetyCarStatus: SAFETY_CAR_STATUS.VIRTUAL }), undefined)).toBe(
      'virtualSafetyCar'
    );
    expect(driverFlag(clear, makeLiveCarStatus({ VehicleFIAFlags: VEHICLE_FIA_FLAGS.BLUE }))).toBe('blue');
    expect(driverFlag(clear, makeLiveCarStatus({ VehicleFIAFlags: VEHICLE_FIA_FLAGS.YELLOW }))).toBe('yellow');
    expect(driverFlag(clear, makeLiveCarStatus({ VehicleFIAFlags: VEHICLE_FIA_FLAGS.GREEN }))).toBeNull();
    expect(driverFlag(null, undefined)).toBeNull();
  });

  it('lists penalties first, then lap, track limits, damage and pit lane', () => {
    const lap = makeLiveLap({
      NumUnservedDriveThroughPens: 1,
      Penalties: 5,
      CurrentLapInvalid: 1,
      CornerCuttingWarnings: 2,
      PitStatus: PIT_STATUS.PITTING,
    });
    expect(driverWarnings(lap, makeLiveCarDamage({ FrontLeftWingDamage: 30 })).map((w) => w.key)).toEqual([
      'driveThrough',
      'penalty',
      'lapInvalid',
      'trackLimits',
      'wingDamage',
      'pitLane',
    ]);
    expect(driverWarnings(makeLiveLap(), makeLiveCarDamage({ FrontLeftWingDamage: 5 }))).toEqual([]);
    expect(driverWarnings(undefined, undefined)).toEqual([]);
  });

  it('formats the glance figures', () => {
    expect(formatGlanceGap(1_234)).toBe('1.234');
    expect(formatGlanceGap(62_345)).toBe('1:02.345');
    expect(formatSignedDelta(236)).toBe('+0.236');
    expect(formatSignedDelta(-120)).toBe('−0.120');
    expect(ersPercent(makeLiveCarStatus({ ERSStoreEnergy: MAX_ERS_STORE_ENERGY_J / 2 }))).toBe(50);
    expect(ersPercent(undefined)).toBeNull();
    expect([tyreWearLevel(10), tyreWearLevel(45), tyreWearLevel(80)]).toEqual(['ok', 'warning', 'critical']);
  });
});
