import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
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

export interface DeltaChartProps extends CommonChartProps {
  hasDeltaData: boolean;
  maxGapA: number;
  maxGapB: number;
}

export const DeltaChart = React.memo<DeltaChartProps>(({
  chartData,
  nameA,
  nameB,
  sector1Distance,
  sector2Distance,
  hoverDistance,
  onMouseMove,
  onHoverDistanceChange,
  hasDeltaData,
  maxGapA,
  maxGapB,
}) => {
  const { t } = useI18n();

  return (
    <div className="glass-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ⏱️ {t('comparator.charts.timeDelta')}
          </h3>
          {(maxGapA > 0 || maxGapB > 0) && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                color: '#f39c12',
                background: 'rgba(243, 156, 18, 0.15)',
                border: '1px solid rgba(243, 156, 18, 0.35)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
              title={
                maxGapA > 0 && maxGapB > 0
                  ? `${t('comparator.charts.packetLossDetected', { meters: maxGapA, name: nameA })} | ${t('comparator.charts.packetLossDetected', { meters: maxGapB, name: nameB })}`
                  : maxGapA > 0
                  ? t('comparator.charts.packetLossDetected', { meters: maxGapA, name: nameA })
                  : t('comparator.charts.packetLossDetected', { meters: maxGapB, name: nameB })
              }
            >
              <AlertTriangle size={11} />
              <span>
                {maxGapA > 0 && maxGapB > 0
                  ? `+${Math.max(maxGapA, maxGapB)}m Gap`
                  : maxGapA > 0
                  ? t('comparator.charts.packetLossDetected', { meters: maxGapA, name: nameA })
                  : t('comparator.charts.packetLossDetected', { meters: maxGapB, name: nameB })}
              </span>
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {t('comparator.charts.timeDeltaSub', { driverA: nameA, driverB: nameB })}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {hasDeltaData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
              <YAxis
                stroke="#666"
                tick={{ fill: '#999', fontSize: 11 }}
                domain={['auto', 'auto']}
                tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(2)}s` : '')}
              />
              <Tooltip
                {...compactTooltipProps}
                formatter={(val: any) =>
                  val !== null && val !== undefined && Number.isFinite(Number(val))
                    ? [`${Number(val) > 0 ? '+' : ''}${Number(val).toFixed(3)}s`, `Time Delta (${nameA} vs ${nameB})`]
                    : ['-', `Time Delta (${nameA} vs ${nameB})`]
                }
              />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
              {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
              {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
              {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
              <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
              <Line type="monotone" dataKey="time_delta" name="Time Delta" stroke="#f1c40f" dot={false} strokeWidth={2.5} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px',
              border: '1px dashed rgba(243, 156, 18, 0.35)',
              padding: '1.5rem',
              textAlign: 'center',
              gap: '0.5rem',
            }}
          >
            <Clock size={28} color="#f39c12" />
            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f39c12' }}>
              {t('comparator.charts.timeDeltaRequiresBoth', { driver: !nameB ? 'Driver B' : nameB })}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {t('comparator.charts.noTelemetryInSlot', { driver: !nameB ? 'Driver B' : nameB })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

DeltaChart.displayName = 'DeltaChart';
