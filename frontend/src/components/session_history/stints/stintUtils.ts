import { TYRE_COMPOUNDS, TYRE_COMPOUND_IDS } from '../../../constants/f1';
import type { DriverStanding, DriverStint } from '../../../types/session';

export interface DriverStintData {
  driver: DriverStanding;
  stints: DriverStint[];
  strategyString: string;
  totalStints: number;
  totalPits: number;
}

export const compactTooltipProps = {
  contentStyle: {
    backgroundColor: 'rgba(10, 14, 23, 0.92)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '0.8rem',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
  },
  itemStyle: {
    padding: '2px 0',
    fontSize: '0.75rem',
  },
  labelStyle: {
    color: '#cbd5e1',
    fontWeight: 700,
    marginBottom: '4px',
  },
};

export const getCompoundColor = (compound?: string): string => {
  if (!compound) return '#A0A0A0';
  const str = compound.toUpperCase().trim();
  if (str === String(TYRE_COMPOUND_IDS.INTERMEDIATE) || str.includes('INTER') || str === 'I') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.INTERMEDIATE]?.color || '#33cc66';
  }
  if (str === String(TYRE_COMPOUND_IDS.SOFT) || str.includes('SOFT') || str === 'S') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.SOFT]?.color || '#ff3366';
  }
  if (str === String(TYRE_COMPOUND_IDS.MEDIUM) || str.includes('MEDIUM') || str === 'MED' || str === 'M') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.MEDIUM]?.color || '#ffd700';
  }
  if (str === String(TYRE_COMPOUND_IDS.HARD) || str.includes('HARD') || str === 'H') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.HARD]?.color || '#ffffff';
  }
  if (str === String(TYRE_COMPOUND_IDS.WET) || str.includes('WET') || str === 'W') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.WET]?.color || '#3399ff';
  }
  return '#A0A0A0';
};
