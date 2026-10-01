import React from 'react';
import { cx } from './cx';
import styles from './Callout.module.css';

export interface CalloutProps {
  /** `info` (blue) for tips and offers, `warning` (yellow) for something missing, `neutral` for a quiet note. */
  tone?: 'info' | 'warning' | 'neutral';
  icon?: React.ReactNode;
  title?: React.ReactNode;
  /** Buttons or links on the right, such as Apply and Dismiss. */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** A note inside a page: an icon, a short text and optional actions, tinted by its tone. */
export const Callout: React.FC<CalloutProps> = ({ tone = 'info', icon, title, actions, className, children }) => (
  <div className={cx(styles.callout, styles[tone], className)} data-tone={tone}>
    {icon && (
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    )}
    <div className={styles.text}>
      {title && <p className={styles.title}>{title}</p>}
      {children && <div className={styles.body}>{children}</div>}
    </div>
    {actions && <div className={styles.actions}>{actions}</div>}
  </div>
);
