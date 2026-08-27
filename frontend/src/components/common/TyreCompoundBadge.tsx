import React from 'react';
import { TYRE_COMPOUNDS, TYRE_COMPOUND_IDS } from '../../constants/f1';

export interface TyreCompoundBadgeProps {
  compound?: string | number;
  actualCompound?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export const TyreCompoundBadge: React.FC<TyreCompoundBadgeProps> = ({
  compound,
  actualCompound,
  className = 'tyre-badge-mini',
  style,
  title,
}) => {
  if (compound === undefined || compound === null || compound === '') return null;
  const str = String(compound).toUpperCase().trim();

  let label = str.charAt(0);
  let color = '#FFFFFF';
  let bg = 'rgba(255, 255, 255, 0.15)';

  if (str === String(TYRE_COMPOUND_IDS.INTERMEDIATE) || str.includes('INTER') || str === 'I') {
    label = 'I';
    color = '#2ed573';
    bg = 'rgba(46, 213, 115, 0.2)';
  } else if (str === String(TYRE_COMPOUND_IDS.SOFT) || str.includes('SOFT') || str === 'S') {
    label = 'S';
    color = '#ff4757';
    bg = 'rgba(255, 71, 87, 0.2)';
  } else if (str === String(TYRE_COMPOUND_IDS.MEDIUM) || str.includes('MEDIUM') || str === 'MED' || str === 'M') {
    label = 'M';
    color = '#ffd200';
    bg = 'rgba(255, 210, 0, 0.2)';
  } else if (str === String(TYRE_COMPOUND_IDS.HARD) || str.includes('HARD') || str === 'H') {
    label = 'H';
    color = '#FFFFFF';
    bg = 'rgba(255, 255, 255, 0.2)';
  } else if (str === String(TYRE_COMPOUND_IDS.WET) || str.includes('WET') || str === 'W') {
    label = 'W';
    color = '#1e90ff';
    bg = 'rgba(30, 144, 255, 0.2)';
  } else if (typeof compound === 'number' && TYRE_COMPOUNDS[compound]) {
    const meta = TYRE_COMPOUNDS[compound];
    label = meta.label;
    color = meta.color;
    bg = meta.bg;
  }

  const defaultTitle = actualCompound
    ? `Tyre: ${compound} (${actualCompound})`
    : `Tyre Compound: ${compound}`;

  return (
    <span
      className={`${className} mono`}
      style={{ color, backgroundColor: bg, borderColor: color, ...style }}
      title={title || defaultTitle}
    >
      {label}
    </span>
  );
};

