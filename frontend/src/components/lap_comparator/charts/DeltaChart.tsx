import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { Line } from 'recharts';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';

export interface DeltaChartProps extends CommonChartProps {
  hasDeltaData: boolean;
  maxGapA: number;
  maxGapB: number;
}

export const DeltaChart = React.memo<DeltaChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB, hasDeltaData, maxGapA, maxGapB } = props;

  const titleNode = (
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
  );

  const headerRight = (
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      {t('comparator.charts.timeDeltaSub', { driverA: nameA, driverB: nameB })}
    </span>
  );

  const emptyBody = !hasDeltaData ? (
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
        {t('comparator.charts.timeDeltaRequiresBoth', { driver: !nameB ? t('comparator.defaultDriverB') : nameB })}
      </span>
      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
        {t('comparator.charts.noTelemetryInSlot', { driver: !nameB ? t('comparator.defaultDriverB') : nameB })}
      </span>
    </div>
  ) : undefined;

  return (
    <ComparatorChart
      {...props}
      height="300px"
      title={titleNode}
      headerRight={headerRight}
      customBody={emptyBody}
      showZeroLine={true}
      yAxisDomain={['auto', 'auto']}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(2)}s` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num)
          ? [`${num > 0 ? '+' : ''}${num.toFixed(3)}s`, `${t('comparator.timeDelta')} (${nameA} vs ${nameB})`]
          : ['-', `${t('comparator.timeDelta')} (${nameA} vs ${nameB})`];
      }}
      extraLines={
        <Line
          type="monotone"
          dataKey="time_delta"
          name={t('comparator.timeDelta')}
          stroke="#f1c40f"
          dot={false}
          strokeWidth={2.5}
          isAnimationActive={false}
        />
      }
    />
  );
});

DeltaChart.displayName = 'DeltaChart';
