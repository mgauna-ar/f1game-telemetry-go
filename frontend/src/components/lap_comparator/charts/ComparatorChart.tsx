import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { compactTooltipProps, CHART_COLORS, type CommonChartProps, type RechartsMouseMoveState } from './chartDefaults';
import type { MergedTelemetryPoint } from '../../../types/comparator';
import { styleVars } from '../../../styles/theme';
import { AXIS_PROPS, AXIS_TICK, CHART_MARGIN, GRID_PROPS, NO_ANIMATION } from '../../charts/chartTheme';
import { ChartLegend, type ChartLegendItem } from '../../charts/ChartLegend';
import { Panel } from '../../ui/Panel';
import styles from './ComparatorChart.module.css';

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
  /** Recharts' tooltip formatter: the value, the series name and the series (its `dataKey`). */
  tooltipFormatter?: (
    val: unknown,
    name?: string | number,
    item?: { dataKey?: unknown }
  ) => [React.ReactNode, React.ReactNode] | [React.ReactNode];
  /** Legend entries after the two laps' (or instead of them, for a chart without `dataKeyA/B`). */
  legendItems?: ChartLegendItem[];
  showZeroLine?: boolean;
  extraLines?: React.ReactNode;
  customBody?: React.ReactNode;
  children?: React.ReactNode;
}

export const ComparatorChart = React.memo<ComparatorChartProps>(
  ({
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
    legendItems = [],
    extraLines,
    customBody,
    children,
  }) => {
    const legend: ChartLegendItem[] = [
      ...(dataKeyA ? [{ id: 'a', label: nameA, color: strokeA, shape: 'line' as const }] : []),
      ...(dataKeyB ? [{ id: 'b', label: nameB, color: strokeB, shape: 'dashed' as const }] : []),
      ...legendItems,
    ];
    return (
      <Panel
        as="div"
        padding="compact"
        className={styles.card}
        style={styleVars({ '--chart-height': typeof height === 'number' ? `${height}px` : height })}
      >
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            {typeof title === 'string' ? <h3 className={styles.title}>{title}</h3> : title}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>

        <div className={styles.body}>
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
                <CartesianGrid {...GRID_PROPS} />
                <XAxis
                  {...AXIS_PROPS}
                  dataKey="lap_distance"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  allowDataOverflow={true}
                  unit="m"
                />
                <YAxis
                  stroke={yAxisStroke}
                  tick={yAxisStroke === CHART_COLORS.AXIS_STROKE ? AXIS_TICK : { ...AXIS_TICK, fill: yAxisStroke }}
                  domain={yAxisDomain as never}
                  ticks={yAxisTicks}
                  tickFormatter={yAxisTickFormatter as never}
                  unit={yAxisUnit}
                />
                <Tooltip {...compactTooltipProps} formatter={tooltipFormatter as never} />

                {showZeroLine && <ReferenceLine y={0} stroke={CHART_COLORS.AXIS_STROKE} strokeDasharray="3 3" />}
                {sector1Distance && (
                  <ReferenceLine
                    x={sector1Distance}
                    stroke={CHART_COLORS.SECTOR_1}
                    strokeDasharray="3 3"
                    label={{ value: 'S1', fill: CHART_COLORS.SECTOR_1, fontSize: 11, position: 'top' }}
                  />
                )}
                {sector2Distance && (
                  <ReferenceLine
                    x={sector2Distance}
                    stroke={CHART_COLORS.SECTOR_2}
                    strokeDasharray="3 3"
                    label={{ value: 'S2', fill: CHART_COLORS.SECTOR_2, fontSize: 11, position: 'top' }}
                  />
                )}
                {hoverDistance !== null && (
                  <ReferenceLine x={hoverDistance} stroke={CHART_COLORS.CURSOR} strokeWidth={2} strokeDasharray="3 3" />
                )}

                {dataKeyA && (
                  <Line
                    type={lineType}
                    dataKey={dataKeyA}
                    name={lineNameA ?? nameA}
                    stroke={strokeA}
                    dot={false}
                    strokeWidth={strokeWidth}
                    {...NO_ANIMATION}
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
                    {...NO_ANIMATION}
                  />
                )}

                {extraLines}
                {children}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {!customBody && legend.length > 0 && <ChartLegend items={legend} className={styles.legend} />}
      </Panel>
    );
  }
);

ComparatorChart.displayName = 'ComparatorChart';
