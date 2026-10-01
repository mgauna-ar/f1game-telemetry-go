import React, { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { ChartTitle, PacketLossNotice } from './ChartTitle';
import { useUnits } from '../../../hooks/useUnits';
import { pointsInSpeedUnit } from '../../../utils/units';

export interface SpeedChartProps extends CommonChartProps {
  maxGapA: number;
  maxGapB: number;
}

export const SpeedChart = React.memo<SpeedChartProps>((props) => {
  const { t } = useI18n();
  const units = useUnits();
  const { maxGapA, maxGapB, nameA, nameB, chartData } = props;
  const data = useMemo(() => pointsInSpeedUnit(chartData, units.prefs.speed), [chartData, units.prefs.speed]);

  const headerRight = <PacketLossNotice maxGapA={maxGapA} maxGapB={maxGapB} nameA={nameA} nameB={nameB} />;

  return (
    <ComparatorChart
      {...props}
      chartData={data}
      height="300px"
      title={<ChartTitle icon={Gauge} label={t('comparator.charts.speed', { unit: units.speedUnit.toUpperCase() })} />}
      headerRight={headerRight}
      dataKeyA="speedA"
      dataKeyB="speedB"
      lineNameA={`${nameA} Speed`}
      lineNameB={`${nameB} Speed`}
      yAxisDomain={['auto', 'auto']}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`${Math.round(num)} ${units.speedUnit}`] : ['-'];
      }}
    />
  );
});

SpeedChart.displayName = 'SpeedChart';
