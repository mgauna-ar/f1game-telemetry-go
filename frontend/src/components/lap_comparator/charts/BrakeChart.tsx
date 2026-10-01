import React from 'react';
import { Disc } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { CHART_COLORS, type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { ChartTitle } from './ChartTitle';

export const BrakeChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  return (
    <ComparatorChart
      {...props}
      height="280px"
      title={<ChartTitle icon={Disc} label={t('comparator.charts.brake')} color={CHART_COLORS.BRAKE} />}
      dataKeyA="brakeA"
      dataKeyB="brakeB"
      yAxisDomain={[0, 1]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`${Math.round(num * 100)}%`] : ['—'];
      }}
    />
  );
});

BrakeChart.displayName = 'BrakeChart';
