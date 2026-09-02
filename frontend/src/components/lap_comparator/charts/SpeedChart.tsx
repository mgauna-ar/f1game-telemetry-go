import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';

export interface SpeedChartProps extends CommonChartProps {
  maxGapA: number;
  maxGapB: number;
}

export const SpeedChart = React.memo<SpeedChartProps>((props) => {
  const { t } = useI18n();
  const { maxGapA, maxGapB, nameA, nameB } = props;

  const headerRight = (maxGapA > 0 || maxGapB > 0) ? (
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
  ) : null;

  return (
    <ComparatorChart
      {...props}
      height="300px"
      title={<h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>🏎️ {t('comparator.charts.speed')}</h3>}
      headerRight={headerRight}
      dataKeyA="speedA"
      dataKeyB="speedB"
      lineNameA={`${nameA} Speed`}
      lineNameB={`${nameB} Speed`}
      yAxisDomain={['auto', 'auto']}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`${Math.round(num)} km/h`] : ['-'];
      }}
    />
  );
});

SpeedChart.displayName = 'SpeedChart';
