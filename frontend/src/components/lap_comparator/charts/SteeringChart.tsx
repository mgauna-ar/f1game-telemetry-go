import React from 'react';
import { RotateCw } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { ChartTitle } from './ChartTitle';

export const SteeringChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB } = props;

  return (
    <ComparatorChart
      {...props}
      height="260px"
      title={<ChartTitle icon={RotateCw} label={t('comparator.charts.steering')} />}
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
