import React from 'react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';

export const SteeringChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB } = props;

  return (
    <ComparatorChart
      {...props}
      height="260px"
      title={<h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>📐 {t('comparator.charts.steering')}</h3>}
      dataKeyA="steerA"
      dataKeyB="steerB"
      lineNameA={`${nameA} Steer`}
      lineNameB={`${nameB} Steer`}
      yAxisDomain={[-1, 1]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(2)}` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`${num.toFixed(2)}`] : ['-'];
      }}
      showZeroLine={true}
    />
  );
});

SteeringChart.displayName = 'SteeringChart';
