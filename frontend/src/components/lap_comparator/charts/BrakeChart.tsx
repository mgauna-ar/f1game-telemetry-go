import React from 'react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';

export const BrakeChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB } = props;

  return (
    <ComparatorChart
      {...props}
      height="280px"
      title={
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#ff4757', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🔴 {t('comparator.charts.brake')}
        </h3>
      }
      dataKeyA="brakeA"
      dataKeyB="brakeB"
      lineNameA={`${nameA} Brake`}
      lineNameB={`${nameB} Brake`}
      yAxisDomain={[0, 1]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`${Math.round(num * 100)}%`] : ['-'];
      }}
    />
  );
});

BrakeChart.displayName = 'BrakeChart';
