import React from 'react';
import { cx } from './cx';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** A button that gets the person out, such as Retry or Clear filters. */
  action?: React.ReactNode;
  /** `danger` for errors: the title and icon turn red and the text is announced. */
  tone?: 'neutral' | 'danger';
  compact?: boolean;
  className?: string;
}

/** What a list, chart or feed shows when there is nothing in it, or when loading it failed. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  tone = 'neutral',
  compact = false,
  className,
}) => (
  <div
    className={cx(styles.empty, compact && styles.compact, tone === 'danger' && styles.danger, className)}
    role={tone === 'danger' ? 'alert' : undefined}
  >
    {icon && (
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    )}
    {title && <p className={styles.title}>{title}</p>}
    {description && <p className={styles.description}>{description}</p>}
    {action && <div className={styles.action}>{action}</div>}
  </div>
);
