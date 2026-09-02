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
import { getErsModeName } from '../../../constants/f1';
import { compactTooltipProps, type CommonChartProps, type RechartsMouseMoveState } from './chartDefaults';
import type { MergedTelemetryPoint } from '../../../types/comparator';

export interface ErsDeployModeChartProps extends CommonChartProps {
  isErsRestrictedA: boolean;
  isErsRestrictedB: boolean;
  formatA?: number | null;
  formatB?: number | null;
  is2026: boolean;
}

export const ErsDeployModeChart = React.memo<ErsDeployModeChartProps>(({
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
  formatA,
  formatB,
  is2026,
}) => {
  const { t } = useI18n();

  return (
    <div className="glass-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#bd93f9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🚀 {t('comparator.charts.ersDeployMode')}
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
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {is2026 ? t('comparator.charts.ersDeployModesSub2026') : t('comparator.charts.ersDeployModesSub')}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} syncId="comparatorSync" onMouseMove={(state) => onMouseMove(state as RechartsMouseMoveState<MergedTelemetryPoint>)} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
            <YAxis
              stroke="#bd93f9"
              tick={{ fill: '#bd93f9', fontSize: 11 }}
              domain={[0, 3]}
              ticks={[0, 1, 2, 3]}
              tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? getErsModeName(Math.round(v), formatA || formatB) : '')}
            />
            <Tooltip
              {...compactTooltipProps}
              formatter={(val: unknown, name?: string | number) => {
                const num = typeof val === 'number' ? val : Number(val);
                if (val === null || val === undefined || !Number.isFinite(num)) return ['-', String(name ?? '')];
                const modeNum = Math.round(num);
                const fmt = String(name ?? '').includes(nameA) ? formatA : formatB;
                return [getErsModeName(modeNum, fmt), String(name ?? '')];
              }}
            />
            {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
            {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
            {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
            <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
            <Line type="stepAfter" dataKey="ersDeployModeA" name={`${nameA} Mode`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="ersDeployModeB" name={`${nameB} Mode`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

ErsDeployModeChart.displayName = 'ErsDeployModeChart';
