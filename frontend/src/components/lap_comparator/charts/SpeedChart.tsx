import React from 'react';
import { Gauge } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { ChartTitle, PacketLossNotice } from './ChartTitle';

export interface SpeedChartProps extends CommonChartProps {
  maxGapA: number;
  maxGapB: number;
}

export const SpeedChart = React.memo<SpeedChartProps>((props) => {
  const { t } = useI18n();
  const { maxGapA, maxGapB, nameA, nameB } = props;

  const headerRight = <PacketLossNotice maxGapA={maxGapA} maxGapB={maxGapB} nameA={nameA} nameB={nameB} />;

  return (
    <ComparatorChart
      {...props}
      height="300px"
      title={<ChartTitle icon={Gauge} label={t('comparator.charts.speed')} />}
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
