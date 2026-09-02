import React from 'react';
import { AlertTriangle } from 'lucide-react';
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
import { compactTooltipProps, type CommonChartProps } from './chartDefaults';

export interface ErsBatteryChartProps extends CommonChartProps {
  isErsRestrictedA: boolean;
  isErsRestrictedB: boolean;
}

export const ErsBatteryChart = React.memo<ErsBatteryChartProps>(({
  chartData,
  nameA,
  nameB,
  sector1Distance,
  sector2Distance,
  hoverDistance,
  onMouseMove,
  onHoverDistanceChange,
  isErsRestrictedA,
  isErsRestrictedB,
}) => {
  const { t } = useI18n();

  return (
    <div className="glass-panel" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#38ef7d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          ⚡ {t('comparator.charts.ersBattery')}
        </h3>
        {(isErsRestrictedA || isErsRestrictedB) && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: '#ffa502',
              background: 'rgba(255, 165, 2, 0.15)',
              border: '1px solid rgba(255, 165, 2, 0.4)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={11} />
            <span>
              {isErsRestrictedA && isErsRestrictedB
                ? t('comparator.charts.ersRestrictedBoth', { nameA, nameB })
                : isErsRestrictedA
                ? t('comparator.charts.ersRestrictedSingle', { name: nameA })
                : t('comparator.charts.ersRestrictedSingle', { name: nameB })}
            </span>
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
            <YAxis
              stroke="#666"
              tick={{ fill: '#999', fontSize: 11 }}
              domain={[0, 100]}
              tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}%` : '')}
            />
            <Tooltip
              {...compactTooltipProps}
              formatter={(val: any) =>
                val !== null && val !== undefined && Number.isFinite(Number(val)) ? [`${Number(val).toFixed(1)}%`] : ['-']
              }
            />
            {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
            {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
            {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
            <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
            <Line type="monotone" dataKey="ersBatteryA" name={`${nameA} Battery (%)`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="monotone" dataKey="ersBatteryB" name={`${nameB} Battery (%)`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

ErsBatteryChart.displayName = 'ErsBatteryChart';
