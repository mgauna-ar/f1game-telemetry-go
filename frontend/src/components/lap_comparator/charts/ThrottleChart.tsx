import React from 'react';
import { ChevronsUp } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { CHART_COLORS, type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { ChartTitle } from './ChartTitle';

export const ThrottleChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  return (
    <ComparatorChart
      {...props}
      height="280px"
      title={<ChartTitle icon={ChevronsUp} label={t('comparator.charts.throttle')} color={CHART_COLORS.THROTTLE} />}
      dataKeyA="throttleA"
      dataKeyB="throttleB"
      yAxisDomain={[0, 1]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`${Math.round(num * 100)}%`] : ['—'];
      }}
    />
  );
});

ThrottleChart.displayName = 'ThrottleChart';
