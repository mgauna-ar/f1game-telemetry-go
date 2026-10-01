import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { UI } from '../../../constants/ui';
import { styleVars } from '../../../styles/theme';
import { useI18n } from '../../../context/I18nContext';
import styles from './ComparatorChart.module.css';

interface ChartTitleProps {
  icon: LucideIcon;
  label: string;
  /** Tints the heading, e.g. with the trace's colour. */
  color?: string;
}

/** Heading of a comparator chart card: an icon and the chart name. */
export const ChartTitle: React.FC<ChartTitleProps> = ({ icon: Icon, label, color }) => (
  <h3 className={styles.title} style={color ? styleVars({ '--title-color': color }) : undefined}>
    <Icon size={UI.ICON_SIZE_MD} aria-hidden="true" />
    {label}
  </h3>
);

/** Muted text on the right of a chart card's header, such as what the scale means. */
export const ChartSubtitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className={styles.subtitle}>{children}</span>
);

/** A small warning next to a chart's title, such as missing ERS data. */
export const ChartNotice: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <span className={styles.notice} title={title}>
    <AlertTriangle size={UI.ICON_SIZE_XS} aria-hidden="true" />
    <span>{children}</span>
  </span>
);

/** Warns that a lap has a gap in its telemetry (lost packets) of at least 100 m. */
export const PacketLossNotice: React.FC<{ maxGapA: number; maxGapB: number; nameA: string; nameB: string }> = ({
  maxGapA,
  maxGapB,
  nameA,
  nameB,
}) => {
  const { t } = useI18n();
  if (maxGapA <= 0 && maxGapB <= 0) return null;
  const messageA = t('comparator.charts.packetLossDetected', { meters: maxGapA, name: nameA });
  const messageB = t('comparator.charts.packetLossDetected', { meters: maxGapB, name: nameB });
  const both = maxGapA > 0 && maxGapB > 0;
  const single = maxGapA > 0 ? messageA : messageB;
  return (
    <ChartNotice title={both ? `${messageA} | ${messageB}` : single}>
      {both ? t('comparator.charts.signalGap', { meters: Math.max(maxGapA, maxGapB) }) : single}
    </ChartNotice>
  );
};
