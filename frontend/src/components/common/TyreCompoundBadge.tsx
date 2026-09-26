import React from 'react';
import { TYRE_COMPOUNDS, UNKNOWN_COMPOUND_COLOR, getVisualCompoundId } from '../../constants/f1';
import { alpha } from '../../styles/theme';

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

  const compoundId = getVisualCompoundId(compound);
  const meta = compoundId !== undefined ? TYRE_COMPOUNDS[compoundId] : undefined;
  const label = meta?.label ?? String(compound).toUpperCase().trim().charAt(0);
  const color = meta?.color ?? UNKNOWN_COMPOUND_COLOR;
  const bg = meta?.bg ?? alpha(UNKNOWN_COMPOUND_COLOR, 0.18);

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
