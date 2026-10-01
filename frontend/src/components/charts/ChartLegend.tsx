import React from 'react';
import { styleVars } from '../../styles/theme';
import { cx } from '../ui/cx';
import styles from './ChartLegend.module.css';

export interface ChartLegendItem {
  /** A stable key; the label is used when left out. */
  id?: string;
  label: React.ReactNode;
  color: string;
  /** How the series is drawn: a line (solid, dashed or dotted), a dot, a bar or a shaded area. */
  shape?: 'line' | 'dashed' | 'dotted' | 'dot' | 'bar' | 'area';
  /** Bold, for the series that is you. */
  emphasis?: boolean;
}

export interface ChartLegendProps {
  items: readonly ChartLegendItem[];
  className?: string;
}

/** The legend under a chart: one swatch drawn like the series, then its name. */
export const ChartLegend: React.FC<ChartLegendProps> = ({ items, className }) => (
  <ul className={cx(styles.legend, className)}>
    {items.map((item, i) => (
      <li
        key={item.id ?? (typeof item.label === 'string' ? item.label : i)}
        className={cx(item.emphasis && styles.emphasis)}
        style={styleVars({ '--legend-color': item.color })}
      >
        <span className={cx(styles.swatch, styles[item.shape ?? 'line'])} aria-hidden="true" />
        {item.label}
      </li>
    ))}
  </ul>
);
