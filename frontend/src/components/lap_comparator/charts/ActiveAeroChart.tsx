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

export const ActiveAeroChart = React.memo<CommonChartProps>(({
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
    <div className="glass-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🪽 {t('comparator.charts.activeAero')}
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {t('comparator.charts.activeAeroSub')}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} syncId="comparatorSync" onMouseMove={(state) => onMouseMove(state as RechartsMouseMoveState<MergedTelemetryPoint>)} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
            <YAxis
              stroke="#00f2fe"
              tick={{ fill: '#00f2fe', fontSize: 11 }}
              domain={[0, 1]}
              ticks={[0, 1]}
              tickFormatter={(v) =>
                v === 1 ? t('comparator.charts.activeAeroStraight') : t('comparator.charts.activeAeroCorner')
              }
            />
            <Tooltip
              {...compactTooltipProps}
              formatter={(val: unknown, name?: string | number) => {
                const num = typeof val === 'number' ? val : Number(val);
                if (val === null || val === undefined || !Number.isFinite(num)) return ['-', String(name ?? '')];
                const numericVal = Math.round(num);
                const labelName = String(name ?? '');
                if (labelName.includes('Boost')) {
                  return [numericVal === 1 ? 'ACTIVE' : 'OFF', labelName];
                }
                return [
                  numericVal === 1 ? t('comparator.charts.activeAeroStraight') : t('comparator.charts.activeAeroCorner'),
                  labelName,
                ];
              }}
            />
            {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
            {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
            {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
            <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
            <Line type="stepAfter" dataKey="activeAeroA" name={`${nameA} Aero`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="activeAeroB" name={`${nameB} Aero`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
            <Line type="stepAfter" dataKey="boostActiveA" name={`${nameA} Boost`} stroke="#ffd700" dot={false} strokeWidth={1.5} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="boostActiveB" name={`${nameB} Boost`} stroke="#a855f7" dot={false} strokeWidth={1.5} strokeDasharray="2 2" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

ActiveAeroChart.displayName = 'ActiveAeroChart';
