import React from 'react';
import { cx } from './cx';
import styles from './Stat.module.css';

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Numbers and times read in monospace; turn off for words such as the weather. */
  mono?: boolean;
  /** A smaller line under the value, such as who set it. */
  detail?: React.ReactNode;
  /** Recolours or resizes the value. */
  valueClassName?: string;
  className?: string;
}

/** A labelled figure, such as total laps or track temperature. A `dl` pair, so the label names the value. */
export const Stat: React.FC<StatProps> = ({ label, value, icon, mono = true, detail, valueClassName, className }) => (
  <div className={cx(styles.stat, className)}>
    {icon && (
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    )}
    <dl className={styles.text}>
      <dt className={styles.label}>{label}</dt>
      <dd className={cx(styles.value, !mono && styles.plain, valueClassName)}>{value}</dd>
      {detail && <dd className={styles.detail}>{detail}</dd>}
    </dl>
  </div>
);
