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
import { compactTooltipProps, type CommonChartProps } from './chartDefaults';

export const GearChart = React.memo<CommonChartProps>(({
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
    <div className="glass-panel" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#fff' }}>
        ⚙️ {t('comparator.charts.gear')}
      </h3>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
            <YAxis
              stroke="#666"
              tick={{ fill: '#999', fontSize: 11 }}
              domain={[1, 8]}
              ticks={[1, 2, 3, 4, 5, 6, 7, 8]}
              tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `G${Math.round(v)}` : '')}
            />
            <Tooltip
              {...compactTooltipProps}
              formatter={(val: any) =>
                val !== null && val !== undefined && Number.isFinite(Number(val)) ? [`Gear ${Math.round(Number(val))}`] : ['-']
              }
            />
            {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
            {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
            {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
            <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
            <Line type="stepAfter" dataKey="gearA" name={`${nameA} Gear`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="gearB" name={`${nameB} Gear`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

GearChart.displayName = 'GearChart';
