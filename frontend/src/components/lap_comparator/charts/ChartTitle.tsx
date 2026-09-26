import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { UI } from '../../../constants/ui';

interface ChartTitleProps {
  icon: LucideIcon;
  label: string;
  /** Tints the heading, e.g. with the trace's colour. */
  color?: string;
}

/** Heading of a comparator chart card: an icon and the chart name. */
export const ChartTitle: React.FC<ChartTitleProps> = ({ icon: Icon, label, color }) => (
  <h3 className="comparator-chart-title" style={color ? { color } : undefined}>
    <Icon size={UI.ICON_SIZE_LG} aria-hidden="true" />
    {label}
  </h3>
);
