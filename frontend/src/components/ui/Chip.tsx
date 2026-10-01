import React from 'react';
import { styleVars } from '../../styles/theme';
import { cx } from './cx';
import styles from './Chip.module.css';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** A toggle chip when set (sets `aria-pressed`); a plain action chip when left out. */
  pressed?: boolean;
  /** A colour of its own (a tag, a team): shown as a dot and used for the pressed tint. Cyan otherwise. */
  color?: string;
  /** Hide the colour dot and use `color` only for the pressed tint. */
  hideDot?: boolean;
  /** A count after the label, such as how many sessions carry a tag. */
  count?: React.ReactNode;
  icon?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

/** A small rounded filter or suggestion: the app's one chip, for quick filters, tags and drivers. */
export const Chip: React.FC<ChipProps> = ({
  pressed,
  color,
  hideDot = false,
  count,
  icon,
  type = 'button',
  className,
  style,
  children,
  ...rest
}) => (
  <button
    type={type}
    aria-pressed={pressed}
    className={cx(styles.chip, className)}
    style={color ? { ...style, ...styleVars({ '--chip-color': color }) } : style}
    {...rest}
  >
    {color && !hideDot && <span className={styles.dot} aria-hidden="true" />}
    {icon}
    <span className={styles.label}>{children}</span>
    {count !== undefined && count !== null && <span className={styles.count}>{count}</span>}
  </button>
);
