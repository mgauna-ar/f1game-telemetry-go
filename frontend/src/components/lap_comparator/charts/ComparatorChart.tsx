import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  compactTooltipProps,
  CHART_COLORS,
  CHART_MARGIN,
  type CommonChartProps,
  type RechartsMouseMoveState,
} from './chartDefaults';
import type { MergedTelemetryPoint } from '../../../types/comparator';

export interface ComparatorChartProps extends CommonChartProps {
  title: React.ReactNode;
  headerRight?: React.ReactNode;
  height?: string | number;
  dataKeyA?: string;
  dataKeyB?: string;
  lineNameA?: string;
  lineNameB?: string;
  lineType?: 'monotone' | 'stepAfter';
  strokeA?: string;
  strokeB?: string;
  strokeDasharrayB?: string;
  strokeWidth?: number;
  yAxisDomain?: [number | 'auto' | string, number | 'auto' | string];
  yAxisTicks?: number[];
  yAxisStroke?: string;
  yAxisTickFormatter?: (val: unknown) => string;
  yAxisUnit?: string;
  tooltipFormatter?: (val: unknown, name?: string | number) => [React.ReactNode, React.ReactNode] | [React.ReactNode];
  showZeroLine?: boolean;
  extraLines?: React.ReactNode;
  customBody?: React.ReactNode;
  children?: React.ReactNode;
}

export const ComparatorChart = React.memo<ComparatorChartProps>(({
  chartData,
  nameA,
  nameB,
  sector1Distance,
  sector2Distance,
  hoverDistance,
  onMouseMove,
  onHoverDistanceChange,
  title,
  headerRight,
  height = '280px',
  dataKeyA,
  dataKeyB,
  lineNameA,
  lineNameB,
  lineType = 'monotone',
  strokeA = CHART_COLORS.SLOT_A,
  strokeB = CHART_COLORS.SLOT_B,
  strokeDasharrayB = '4 4',
  strokeWidth = 2,
  yAxisDomain = ['auto', 'auto'],
  yAxisTicks,
  yAxisStroke = CHART_COLORS.AXIS_STROKE,
  yAxisTickFormatter,
  yAxisUnit,
  tooltipFormatter,
  showZeroLine = false,
  extraLines,
  customBody,
  children,
}) => {
  return (
    <div className="glass-panel" style={{ height, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.25rem',
          flexWrap: 'wrap',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {typeof title === 'string' ? (
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{title}</h3>
          ) : (
            title
          )}
        </div>
        {headerRight && <div>{headerRight}</div>}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {customBody ? (
          customBody
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              syncId="comparatorSync"
              onMouseMove={(state) => onMouseMove(state as RechartsMouseMoveState<MergedTelemetryPoint>)}
              onMouseLeave={() => onHoverDistanceChange(null)}
              margin={CHART_MARGIN}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.GRID_STROKE} />
              <XAxis
                dataKey="lap_distance"
                type="number"
                domain={['dataMin', 'dataMax']}
                allowDataOverflow={true}
                stroke={CHART_COLORS.AXIS_STROKE}
                tick={{ fill: CHART_COLORS.AXIS_TICK, fontSize: 11 }}
                unit="m"
              />
              <YAxis
                stroke={yAxisStroke}
                tick={{ fill: yAxisStroke === CHART_COLORS.AXIS_STROKE ? CHART_COLORS.AXIS_TICK : yAxisStroke, fontSize: 11 }}
                domain={yAxisDomain as never}
                ticks={yAxisTicks}
                tickFormatter={yAxisTickFormatter as never}
                unit={yAxisUnit}
              />
              <Tooltip {...compactTooltipProps} formatter={tooltipFormatter as never} />

              {showZeroLine && (
                <ReferenceLine y={0} stroke={CHART_COLORS.AXIS_STROKE} strokeDasharray="3 3" />
              )}
              {sector1Distance && (
                <ReferenceLine
                  x={sector1Distance}
                  stroke={CHART_COLORS.SECTOR_1}
                  strokeDasharray="3 3"
                  label={{ value: 'S1', fill: CHART_COLORS.SECTOR_1, fontSize: 10, position: 'top' }}
                />
              )}
              {sector2Distance && (
                <ReferenceLine
                  x={sector2Distance}
                  stroke={CHART_COLORS.SECTOR_2}
                  strokeDasharray="3 3"
                  label={{ value: 'S2', fill: CHART_COLORS.SECTOR_2, fontSize: 10, position: 'top' }}
                />
              )}
              {hoverDistance !== null && (
                <ReferenceLine
                  x={hoverDistance}
                  stroke={CHART_COLORS.CURSOR}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
              )}

              <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />

              {dataKeyA && (
                <Line
                  type={lineType}
                  dataKey={dataKeyA}
                  name={lineNameA ?? nameA}
                  stroke={strokeA}
                  dot={false}
                  strokeWidth={strokeWidth}
                  isAnimationActive={false}
                />
              )}
              {dataKeyB && (
                <Line
                  type={lineType}
                  dataKey={dataKeyB}
                  name={lineNameB ?? nameB}
                  stroke={strokeB}
                  dot={false}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharrayB}
                  isAnimationActive={false}
                />
              )}

              {extraLines}
              {children}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});

ComparatorChart.displayName = 'ComparatorChart';
