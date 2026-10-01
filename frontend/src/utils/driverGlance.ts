import {
  GAP_TREND_STABLE_MS_PER_LAP,
  MAX_ERS_STORE_ENERGY_J,
  PIT_STATUS,
  RADIO_ALERT_CONSTANTS,
  SAFETY_CAR_STATUS,
  VEHICLE_FIA_FLAGS,
} from '../constants/f1';
import type { CarDamageData, CarStatusData, GapTrend, LapData, SessionData } from '../types/telemetry';
import { carAtPosition, deltaToCarInFrontMs } from './liveTiming';

/** Which way a gap is going, and whether that is good for the player. */
export interface GapTrendReading {
  direction: 'closing' | 'opening' | 'stable';
  /** Closing on the car ahead, or pulling away from the car behind. */
  good: boolean;
  /** Absolute change per lap in ms. */
  perLapMs: number;
}

export interface GapReading {
  carIndex: number;
  /** The gap in ms (always positive). */
  ms: number;
  /** Null until the race engineer has two lap ends with this car next to the player. */
  trend: GapTrendReading | null;
}

/**
 * Reads a gap trend for the car ahead or behind. A trend measured with another car (the order
 * changed since the last lap end) is ignored.
 */
export function readGapTrend(
  trend: GapTrend | null | undefined,
  carIndex: number,
  side: 'ahead' | 'behind'
): GapTrendReading | null {
  if (!trend || trend.CarIndex !== carIndex) return null;
  const change = trend.ChangePerLapMS;
  const perLapMs = Math.abs(change);
  if (perLapMs < GAP_TREND_STABLE_MS_PER_LAP) return { direction: 'stable', good: true, perLapMs };
  const direction = change < 0 ? 'closing' : 'opening';
  // Ahead: a shrinking gap is you catching them. Behind: a growing gap is you getting away.
  const good = side === 'ahead' ? direction === 'closing' : direction === 'opening';
  return { direction, good, perLapMs };
}

/** The gaps to the cars directly ahead of and behind the player, with the engineer's trends. */
export function playerGaps(
  laps: readonly LapData[],
  playerIdx: number,
  aheadTrend: GapTrend | null,
  behindTrend: GapTrend | null
): { ahead: GapReading | null; behind: GapReading | null } {
  const player = laps[playerIdx];
  if (!player?.CarPosition) return { ahead: null, behind: null };

  const aheadIdx = carAtPosition(laps, player.CarPosition - 1);
  const behindIdx = carAtPosition(laps, player.CarPosition + 1);
  const aheadMs = deltaToCarInFrontMs(player);
  const behindMs = behindIdx >= 0 ? deltaToCarInFrontMs(laps[behindIdx]) : 0;
  return {
    ahead:
      aheadIdx >= 0 && aheadMs > 0
        ? { carIndex: aheadIdx, ms: aheadMs, trend: readGapTrend(aheadTrend, aheadIdx, 'ahead') }
        : null,
    behind:
      behindIdx >= 0 && behindMs > 0
        ? { carIndex: behindIdx, ms: behindMs, trend: readGapTrend(behindTrend, behindIdx, 'behind') }
        : null,
  };
}

/** The flag the driver has to react to, most important first; null under green. */
export type DriverFlag = 'safetyCar' | 'virtualSafetyCar' | 'formationLap' | 'yellow' | 'blue' | null;

export function driverFlag(session: SessionData | null, carStatus: CarStatusData | undefined): DriverFlag {
  switch (session?.SafetyCarStatus) {
    case SAFETY_CAR_STATUS.FULL:
      return 'safetyCar';
    case SAFETY_CAR_STATUS.VIRTUAL:
      return 'virtualSafetyCar';
    case SAFETY_CAR_STATUS.FORMATION_LAP:
      return 'formationLap';
  }
  switch (carStatus?.VehicleFIAFlags) {
    case VEHICLE_FIA_FLAGS.YELLOW:
      return 'yellow';
    case VEHICLE_FIA_FLAGS.BLUE:
      return 'blue';
    default:
      return null;
  }
}

/** Something the driver should know about, with the locale key under `live.driver.warnings`. */
export interface DriverWarning {
  key: 'lapInvalid' | 'penalty' | 'driveThrough' | 'stopGo' | 'trackLimits' | 'wingDamage' | 'pitLane';
  count?: number;
  severity: 'danger' | 'warning' | 'info';
}

/** Wing damage from this percentage on is worth a glance. */
const WING_DAMAGE_WARN_PCT = 20;

export function driverWarnings(lap: LapData | undefined, damage: CarDamageData | undefined): DriverWarning[] {
  const warnings: DriverWarning[] = [];
  if (!lap) return warnings;
  if (lap.NumUnservedDriveThroughPens > 0) {
    warnings.push({ key: 'driveThrough', count: lap.NumUnservedDriveThroughPens, severity: 'danger' });
  }
  if (lap.NumUnservedStopGoPens > 0) {
    warnings.push({ key: 'stopGo', count: lap.NumUnservedStopGoPens, severity: 'danger' });
  }
  if (lap.Penalties > 0) warnings.push({ key: 'penalty', count: lap.Penalties, severity: 'danger' });
  if (lap.CurrentLapInvalid) warnings.push({ key: 'lapInvalid', severity: 'warning' });
  if (lap.CornerCuttingWarnings > 0) {
    warnings.push({ key: 'trackLimits', count: lap.CornerCuttingWarnings, severity: 'warning' });
  }
  const wing = Math.max(damage?.FrontLeftWingDamage ?? 0, damage?.FrontRightWingDamage ?? 0);
  if (wing >= WING_DAMAGE_WARN_PCT) warnings.push({ key: 'wingDamage', count: wing, severity: 'warning' });
  if (lap.PitStatus !== PIT_STATUS.NONE) warnings.push({ key: 'pitLane', severity: 'info' });
  return warnings;
}

/** The ERS store as a percentage of its capacity, 0–100. */
export const ersPercent = (status: CarStatusData | undefined): number | null =>
  status ? Math.min(100, Math.max(0, Math.round((status.ERSStoreEnergy / MAX_ERS_STORE_ENERGY_J) * 100))) : null;

/** A tyre's wear level for its colour, on the radio's warning and critical thresholds. */
export const tyreWearLevel = (wear: number): 'ok' | 'warning' | 'critical' =>
  wear >= RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_CRIT_PCT
    ? 'critical'
    : wear >= RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_WARN_PCT
      ? 'warning'
      : 'ok';

/** The app's gap formatters (utils/formatters), under the names the glance has used. */
export { formatGap as formatGlanceGap, formatSignedDelta } from './formatters';
