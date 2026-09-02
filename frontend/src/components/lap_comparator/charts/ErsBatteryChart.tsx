import React from 'react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';

export interface ErsBatteryChartProps extends CommonChartProps {
  isErsRestrictedA: boolean;
  isErsRestrictedB: boolean;
}

export const ErsBatteryChart = React.memo<ErsBatteryChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB, isErsRestrictedA, isErsRestrictedB } = props;

  const headerRight = (isErsRestrictedA || isErsRestrictedB) ? (
    <span
      style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '4px',
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        color: '#facc15',
        border: '1px solid rgba(234, 179, 8, 0.35)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      ⚠️ {t('comparator.charts.ersTelemetryRestricted')}
    </span>
  ) : null;

  return (
    <ComparatorChart
      {...props}
      height="280px"
      title={
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#38ef7d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          ⚡ {t('comparator.charts.ersBattery')}
        </h3>
      }
      headerRight={headerRight}
      dataKeyA="ersBatteryA"
      dataKeyB="ersBatteryB"
      lineNameA={`${nameA} Battery (%)`}
      lineNameB={`${nameB} Battery (%)`}
      yAxisDomain={[0, 100]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}%` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`${num.toFixed(1)}%`] : ['-'];
      }}
    />
  );
});

ErsBatteryChart.displayName = 'ErsBatteryChart';
