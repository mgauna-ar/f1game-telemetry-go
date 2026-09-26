import React from 'react';
import { cx } from './cx';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  variant?: 'text' | 'block' | 'circle';
  width?: string | number;
  height?: string | number;
  className?: string;
}

/** A shimmering placeholder for content that is loading. Hidden from screen readers. */
export const Skeleton: React.FC<SkeletonProps> = ({ variant = 'text', width, height, className }) => (
  <span
    aria-hidden="true"
    className={cx(styles.skeleton, styles[variant], className)}
    style={width !== undefined || height !== undefined ? { width, height } : undefined}
  />
);

export interface SkeletonGroupProps {
  /** Announced to screen readers while loading, such as "Loading sessions…". */
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Wraps placeholders in a status region that tells screen readers what is loading. */
export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({ label, children, className }) => (
  <div role="status" aria-busy="true" className={cx(styles.group, className)}>
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

/** Placeholder rows shaped like a table: a short cell, then three wider ones. */
export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <>
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className={styles.row} aria-hidden="true">
        <Skeleton variant="circle" width="1.75rem" height="1.75rem" />
        <Skeleton width={`${70 - (index % 3) * 12}%`} />
        <Skeleton width={`${85 - (index % 2) * 20}%`} />
        <Skeleton width="60%" />
      </div>
    ))}
  </>
);
