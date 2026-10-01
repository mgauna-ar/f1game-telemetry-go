import React from 'react';
import { Cog } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { ChartTitle } from './ChartTitle';

export const GearChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  return (
    <ComparatorChart
      {...props}
      height="260px"
      title={<ChartTitle icon={Cog} label={t('comparator.charts.gear')} />}
      dataKeyA="gearA"
      dataKeyB="gearB"
      lineType="stepAfter"
      yAxisDomain={[1, 8]}
      yAxisTicks={[1, 2, 3, 4, 5, 6, 7, 8]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `G${Math.round(v)}` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`G${Math.round(num)}`] : ['—'];
      }}
    />
  );
});

GearChart.displayName = 'GearChart';
