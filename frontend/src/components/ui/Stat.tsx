import React from 'react';
import { cx } from './cx';
import styles from './Stat.module.css';

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Numbers and times read in monospace; turn off for words such as the weather. */
  mono?: boolean;
  className?: string;
}

/** A labelled figure, such as total laps or track temperature. A `dl` pair, so the label names the value. */
export const Stat: React.FC<StatProps> = ({ label, value, icon, mono = true, className }) => (
  <div className={cx(styles.stat, className)}>
    {icon && (
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    )}
    <dl className={styles.text}>
      <dt className={styles.label}>{label}</dt>
      <dd className={cx(styles.value, !mono && styles.plain)}>{value}</dd>
    </dl>
  </div>
);
