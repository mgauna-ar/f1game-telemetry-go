import React from 'react';
import { cx } from './cx';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'size' | 'checked'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  /** `success` (green) for master on/off switches; the default is the accent colour. */
  tone?: 'accent' | 'success';
}

/**
 * An on/off switch: a native checkbox with `role="switch"`. Name it with a wrapping `<label>`,
 * `aria-label` or `aria-labelledby`.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  size = 'sm',
  tone = 'accent',
  className,
  ...rest
}) => (
  <input
    type="checkbox"
    role="switch"
    className={cx(styles.switch, size === 'md' && styles.md, tone === 'success' && styles.success, className)}
    checked={checked}
    aria-checked={checked}
    onChange={(event) => onChange(event.target.checked)}
    {...rest}
  />
);
