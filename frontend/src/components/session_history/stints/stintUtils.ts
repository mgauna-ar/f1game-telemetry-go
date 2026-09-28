import { TYRE_COMPOUNDS, UNKNOWN_COMPOUND_COLOR, getVisualCompoundId } from '../../../constants/f1';
import { CHART_TOOLTIP_CONTENT_STYLE, cssVar } from '../../../styles/theme';
import type { DriverStanding, DriverStint } from '../../../types/session';

export interface DriverStintData {
  driver: DriverStanding;
  stints: DriverStint[];
  strategyString: string;
  totalStints: number;
  totalPits: number;
}

/** Recharts tooltip props for the session history charts (lap charts and stints). */
export const compactTooltipProps = {
  contentStyle: {
    ...CHART_TOOLTIP_CONTENT_STYLE,
    padding: '8px 12px',
    fontSize: '0.8rem',
  },
  itemStyle: {
    padding: '2px 0',
    fontSize: '0.75rem',
  },
  labelStyle: {
    color: cssVar('--text-body'),
    fontWeight: 700,
    marginBottom: '4px',
  },
};

export const getCompoundColor = (compound?: string): string => {
  const compoundId = getVisualCompoundId(compound);
  return compoundId !== undefined ? TYRE_COMPOUNDS[compoundId].color : UNKNOWN_COMPOUND_COLOR;
};

/** The degradation_data key of a stint's lap times (`driver_{carIndex}_stint_{index}`). */
export const stintKey = (carIndex: number, stintIndex: number) => `driver_${carIndex}_stint_${stintIndex}`;

/** Every stint key of the given drivers. */
export const stintKeysOf = (drivers: readonly DriverStintData[], pick: (carIndex: number) => boolean) => {
  const keys: Record<string, boolean> = {};
  for (const d of drivers) {
    const car = d.driver.participant.car_index;
    if (!pick(car)) continue;
    for (const s of d.stints) keys[stintKey(car, s.stintIndex)] = true;
  }
  return keys;
};

/** A stint's excluded laps as "L1 out-lap, L9–10 safety car", runs of the same reason joined. */
export function describeExcludedLaps(
  stint: Pick<DriverStint, 'excludedLaps'>,
  reasonLabel: (reason: string) => string,
  lapPrefix = 'L'
): string {
  const runs: Array<{ start: number; end: number; reason: string }> = [];
  for (const { lap_number: lap, reason } of stint.excludedLaps) {
    const last = runs[runs.length - 1];
    if (last && last.reason === reason && last.end === lap - 1) last.end = lap;
    else runs.push({ start: lap, end: lap, reason });
  }
  return runs
    .map((r) => `${lapPrefix}${r.start === r.end ? r.start : `${r.start}–${r.end}`} ${reasonLabel(r.reason)}`)
    .join(', ');
}
