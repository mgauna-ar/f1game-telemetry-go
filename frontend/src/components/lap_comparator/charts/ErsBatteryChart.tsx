import React from 'react';
import { BatteryCharging } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { CHART_COLORS, type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { ChartNotice, ChartTitle } from './ChartTitle';

export interface ErsBatteryChartProps extends CommonChartProps {
  isErsRestrictedA: boolean;
  isErsRestrictedB: boolean;
}

export const ErsBatteryChart = React.memo<ErsBatteryChartProps>((props) => {
  const { t } = useI18n();
  const { isErsRestrictedA, isErsRestrictedB } = props;

  const headerRight =
    isErsRestrictedA || isErsRestrictedB ? (
      <ChartNotice>{t('comparator.charts.ersTelemetryRestricted')}</ChartNotice>
    ) : null;

  return (
    <ComparatorChart
      {...props}
      height="280px"
      title={<ChartTitle icon={BatteryCharging} label={t('comparator.charts.ersBattery')} color={CHART_COLORS.ERS} />}
      headerRight={headerRight}
      dataKeyA="ersBatteryA"
      dataKeyB="ersBatteryB"
      yAxisDomain={[0, 100]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}%` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`${num.toFixed(1)}%`] : ['—'];
      }}
    />
  );
});

ErsBatteryChart.displayName = 'ErsBatteryChart';
