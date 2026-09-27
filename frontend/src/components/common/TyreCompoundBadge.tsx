import React from 'react';
import { TYRE_COMPOUNDS, UNKNOWN_COMPOUND_COLOR, getVisualCompoundId } from '../../constants/f1';
import { alpha, styleVars } from '../../styles/theme';
import { cx } from '../ui/cx';
import styles from './TyreCompoundBadge.module.css';

export interface TyreCompoundBadgeProps {
  compound?: string | number;
  actualCompound?: string;
  /** `sm` (16px) in dense rows, `md` (22px) in tables. */
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

/** The compound's letter in a circle of its colour, as on the F1 broadcast. */
export const TyreCompoundBadge: React.FC<TyreCompoundBadgeProps> = ({
  compound,
  actualCompound,
  size = 'sm',
  className,
  title,
}) => {
  if (compound === undefined || compound === null || compound === '') return null;

  const compoundId = getVisualCompoundId(compound);
  const meta = compoundId !== undefined ? TYRE_COMPOUNDS[compoundId] : undefined;
  const label = meta?.label ?? String(compound).toUpperCase().trim().charAt(0);
  const color = meta?.color ?? UNKNOWN_COMPOUND_COLOR;
  const bg = meta?.bg ?? alpha(UNKNOWN_COMPOUND_COLOR, 0.18);

  const defaultTitle = actualCompound ? `Tyre: ${compound} (${actualCompound})` : `Tyre Compound: ${compound}`;

  return (
    <span
      className={cx(styles.badge, size === 'md' && styles.md, className)}
      style={styleVars({ '--tyre-color': color, '--tyre-bg': bg })}
      title={title || defaultTitle}
    >
      {label}
    </span>
  );
};
