import React from 'react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';

export const ThrottleChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB } = props;

  return (
    <ComparatorChart
      {...props}
      height="280px"
      title={
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#2ed573', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🟢 {t('comparator.charts.throttle')}
        </h3>
      }
      dataKeyA="throttleA"
      dataKeyB="throttleB"
      lineNameA={`${nameA} Throttle`}
      lineNameB={`${nameB} Throttle`}
      yAxisDomain={[0, 1]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`${Math.round(num * 100)}%`] : ['-'];
      }}
    />
  );
});

ThrottleChart.displayName = 'ThrottleChart';
