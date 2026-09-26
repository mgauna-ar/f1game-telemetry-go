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
