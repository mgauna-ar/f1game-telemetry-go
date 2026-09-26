import React, { createContext, useContext, useId } from 'react';
import { cx } from './cx';
import styles from './Panel.module.css';

const PanelTitleContext = createContext<string | undefined>(undefined);

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** `compact` for toolbars and small cards, `flush` when the content brings its own padding. */
  padding?: 'normal' | 'compact' | 'flush';
  /** Render as a plain `div` instead of a `section` named by its header. */
  as?: 'section' | 'div';
}

/**
 * A glass card. As a `section`, it is named by the title of the `PanelHeader` inside it, so
 * screen readers can jump between panels.
 */
export const Panel: React.FC<PanelProps> = ({ padding = 'normal', as = 'section', className, children, ...rest }) => {
  const titleId = useId();
  const Tag = as;
  return (
    <PanelTitleContext.Provider value={as === 'section' ? titleId : undefined}>
      <Tag
        aria-labelledby={as === 'section' ? titleId : undefined}
        className={cx(styles.panel, padding !== 'normal' && styles[padding], className)}
        {...rest}
      >
        {children}
      </Tag>
    </PanelTitleContext.Provider>
  );
};

export interface PanelHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Controls on the right, such as filters or a clear button. */
  actions?: React.ReactNode;
  /** Heading level, so each page keeps a sensible outline. */
  level?: 2 | 3 | 4;
  className?: string;
}

/** A panel's title row: icon, title, a short subtitle and optional actions. */
export const PanelHeader: React.FC<PanelHeaderProps> = ({ title, subtitle, icon, actions, level = 3, className }) => {
  const titleId = useContext(PanelTitleContext);
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';
  return (
    <header className={cx(styles.header, className)}>
      <div className={styles.heading}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <div>
          <Heading id={titleId} className={styles.title}>
            {title}
          </Heading>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
};
