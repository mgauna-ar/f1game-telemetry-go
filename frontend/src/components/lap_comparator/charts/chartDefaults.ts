import type { MergedTelemetryPoint } from '../../../types/comparator';

export interface CommonChartProps {
  chartData: MergedTelemetryPoint[];
  nameA: string;
  nameB: string;
  sector1Distance: number | null;
  sector2Distance: number | null;
  hoverDistance: number | null;
  onMouseMove: (state: any) => void;
  onHoverDistanceChange: (dist: number | null) => void;
}

export const compactTooltipProps = {
  contentStyle: {
    backgroundColor: 'rgba(10, 14, 23, 0.65)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.72rem',
    lineHeight: '1.2',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
  },
  itemStyle: {
    padding: '1px 0',
    fontSize: '0.70rem',
    margin: 0,
  },
  labelStyle: {
    color: '#cbd5e1',
    fontSize: '0.68rem',
    marginBottom: '2px',
    fontWeight: 600,
  },
  wrapperStyle: {
    zIndex: 100,
    pointerEvents: 'none' as const,
  },
  labelFormatter: (label: any) => `${Math.round(Number(label))}m`,
};
