import type { Lap } from '../types/session';

export interface TyreStintSummary {
  compound: string;
  actualCompound?: string;
  count: number;
  stintId: number;
}

/**
 * Sorts candidate laps by quality:
 * 1. Viable filter: lap_time_ms > 0 and (is_valid or sector1_ms > 0)
 * 2. Valid laps take priority over invalid laps
 * 3. Fastest lap_time_ms
 * 4. Completeness score (has_telemetry + sector1_ms > 0)
 */
export function sortLapsByQuality(laps: Lap[]): Lap[] {
  return laps
    .filter((l) => l.lap_time_ms > 0 && (l.is_valid || (l.sector1_ms ?? 0) > 0))
    .slice()
    .sort((a, b) => {
      const aValid = a.is_valid ? 1 : 0;
      const bValid = b.is_valid ? 1 : 0;
      if (aValid !== bValid) return bValid - aValid;
      if (a.lap_time_ms !== b.lap_time_ms) return a.lap_time_ms - b.lap_time_ms;
      const scoreA = (a.has_telemetry ? 10 : 0) + ((a.sector1_ms ?? 0) > 0 ? 5 : 0);
      const scoreB = (b.has_telemetry ? 10 : 0) + ((b.sector1_ms ?? 0) > 0 ? 5 : 0);
      return scoreB - scoreA;
    });
}

/**
 * Groups driver laps into tyre stints by compound changes and stint identifiers.
 * Laps are sorted by lap_number before grouping.
 */
export function groupLapsIntoStints(driverLaps: Lap[]): TyreStintSummary[] {
  if (!driverLaps || driverLaps.length === 0) return [];

  const sortedLaps = [...driverLaps].sort((a, b) => a.lap_number - b.lap_number);
  const stints: TyreStintSummary[] = [];
  let currentStint: TyreStintSummary | null = null;

  sortedLaps.forEach((lap) => {
    const raw = lap.tyre_compound?.trim();
    if (!raw) return;

    const lapStint = lap.stint && lap.stint > 0 ? lap.stint : 0;
    const isNewStint =
      !currentStint ||
      (lapStint > 0 && currentStint.stintId > 0 && lapStint !== currentStint.stintId) ||
      currentStint.compound.toUpperCase() !== raw.toUpperCase();

    if (isNewStint || !currentStint) {
      currentStint = {
        compound: raw,
        actualCompound: lap.actual_compound,
        count: 1,
        stintId: lapStint,
      };
      stints.push(currentStint);
    } else {
      currentStint.count += 1;
      if (!currentStint.actualCompound && lap.actual_compound) {
        currentStint.actualCompound = lap.actual_compound;
      }
    }
  });

  return stints;
}

/**
 * Formats a list of tyre stints into a readable debrief string.
 * Example: "SOFT (15L) ➔ MEDIUM (20L)"
 */
export function formatStintsText(stints: TyreStintSummary[]): string {
  if (!stints || stints.length === 0) return 'No stint data';
  return stints.map((s) => `${s.compound} (${s.count}L)`).join(' ➔ ');
}
