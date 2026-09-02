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
import { useI18n } from '../../../context/I18nContext';
import { compactTooltipProps, type CommonChartProps, type RechartsMouseMoveState } from './chartDefaults';
import type { MergedTelemetryPoint } from '../../../types/comparator';

export const BrakeChart = React.memo<CommonChartProps>(({
  chartData,
  nameA,
  nameB,
  sector1Distance,
  sector2Distance,
  hoverDistance,
  onMouseMove,
  onHoverDistanceChange,
}) => {
  const { t } = useI18n();

  return (
    <div className="glass-panel" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#ff4757', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        🔴 {t('comparator.charts.brake')}
      </h3>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} syncId="comparatorSync" onMouseMove={(state) => onMouseMove(state as RechartsMouseMoveState<MergedTelemetryPoint>)} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
            <YAxis
              stroke="#666"
              tick={{ fill: '#999', fontSize: 11 }}
              domain={[0, 1]}
              tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '')}
            />
            <Tooltip
              {...compactTooltipProps}
              formatter={(val: unknown) => {
                const num = typeof val === 'number' ? val : Number(val);
                return Number.isFinite(num) ? [`${Math.round(num * 100)}%`] : ['-'];
              }}
            />
            {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
            {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
            {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
            <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
            <Line type="monotone" dataKey="brakeA" name={`${nameA} Brake`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="monotone" dataKey="brakeB" name={`${nameB} Brake`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

BrakeChart.displayName = 'BrakeChart';
