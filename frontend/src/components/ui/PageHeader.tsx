import React from 'react';
import { cx } from './cx';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: React.ReactNode;
  /** One line under the title saying what the page is for. */
  subtitle?: React.ReactNode;
  /** The page's icon, drawn in the brand red before the title. */
  icon?: React.ReactNode;
  /** Controls or a status on the right, such as a picker or a count. */
  aside?: React.ReactNode;
  className?: string;
}

/** The title row every page starts with: the page's h1, a subtitle and optional controls. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, aside, className }) => (
  <header className={cx(styles.header, className)}>
    <div className={styles.text}>
      <h1 className={styles.title}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        {title}
      </h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
    {aside && <div className={styles.aside}>{aside}</div>}
  </header>
);
