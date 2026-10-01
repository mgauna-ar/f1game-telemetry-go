import React from 'react';
import type { MergedTelemetryPoint } from '../../../types/comparator';
import { cssVar } from '../../../styles/theme';
import { TOOLTIP_PROPS } from '../../charts/chartTheme';

export interface RechartsMouseMoveState<T = unknown> {
  activeTooltipIndex?: number | null | string;
  activePayload?: Array<{ payload?: T; value?: unknown; dataKey?: unknown }>;
  activeCoordinate?: { x?: number; y?: number };
  activeLabel?: unknown;
  isTooltipActive?: boolean;
}

export interface CommonChartProps {
  chartData: MergedTelemetryPoint[];
  nameA: string;
  nameB: string;
  sector1Distance: number | null;
  sector2Distance: number | null;
  hoverDistance: number | null;
  onMouseMove: (state: RechartsMouseMoveState<MergedTelemetryPoint> | null) => void;
  onHoverDistanceChange: (dist: number | null) => void;
}

/** The shared chart tooltip; the label is the distance along the lap. */
export const compactTooltipProps = {
  ...TOOLTIP_PROPS,
  labelFormatter: (label: React.ReactNode) => `${Math.round(Number(label))}m`,
};

export const CHART_COLORS = {
  SLOT_A: cssVar('--f1-slot-a'),
  SLOT_B: cssVar('--f1-slot-b'),
  SECTOR_1: cssVar('--f1-sector-1'),
  SECTOR_2: cssVar('--f1-sector-2'),
  CURSOR: cssVar('--chart-cursor'),
  AXIS_STROKE: cssVar('--chart-axis'),
  AXIS_TICK: cssVar('--chart-tick'),
  GRID_STROKE: cssVar('--chart-grid'),
  THROTTLE: cssVar('--chart-throttle'),
  BRAKE: cssVar('--chart-brake'),
  ERS: cssVar('--chart-ers'),
  ERS_MODE: cssVar('--chart-ers-mode'),
  AERO: cssVar('--chart-aero'),
  DELTA: cssVar('--chart-delta'),
  BOOST_A: cssVar('--chart-boost-a'),
  BOOST_B: cssVar('--chart-boost-b'),
} as const;

export const CHART_MARGIN = { top: 5, right: 30, left: 0, bottom: 0 } as const;

