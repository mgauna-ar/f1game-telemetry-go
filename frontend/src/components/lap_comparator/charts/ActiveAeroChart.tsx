import React from 'react';
import { Wind } from 'lucide-react';
import { Line } from 'recharts';
import { useI18n } from '../../../context/I18nContext';
import { CHART_COLORS, type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { ChartSubtitle, ChartTitle } from './ChartTitle';

export const ActiveAeroChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB } = props;

  const headerRight = <ChartSubtitle>{t('comparator.charts.activeAeroSub')}</ChartSubtitle>;

  return (
    <ComparatorChart
      {...props}
      height="300px"
      title={<ChartTitle icon={Wind} label={t('comparator.charts.activeAero')} color={CHART_COLORS.AERO} />}
      headerRight={headerRight}
      dataKeyA="activeAeroA"
      dataKeyB="activeAeroB"
      lineNameA={`${nameA} Aero`}
      lineNameB={`${nameB} Aero`}
      lineType="stepAfter"
      yAxisStroke={CHART_COLORS.AERO}
      yAxisDomain={[0, 1]}
      yAxisTicks={[0, 1]}
      yAxisTickFormatter={(v) =>
        v === 1 ? t('comparator.charts.activeAeroStraight') : t('comparator.charts.activeAeroCorner')
      }
      tooltipFormatter={(val: unknown, name?: string | number) => {
        const num = typeof val === 'number' ? val : Number(val);
        if (val === null || val === undefined || !Number.isFinite(num)) return ['-', String(name ?? '')];
        const numericVal = Math.round(num);
        const labelName = String(name ?? '');
        if (labelName.includes('Boost')) {
          return [numericVal === 1 ? 'ACTIVE' : 'OFF', labelName];
        }
        return [
          numericVal === 1 ? t('comparator.charts.activeAeroStraight') : t('comparator.charts.activeAeroCorner'),
          labelName,
        ];
      }}
      extraLines={
        <>
          <Line
            type="stepAfter"
            dataKey="boostActiveA"
            name={`${nameA} Boost`}
            stroke={CHART_COLORS.BOOST_A}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          <Line
            type="stepAfter"
            dataKey="boostActiveB"
            name={`${nameB} Boost`}
            stroke={CHART_COLORS.BOOST_B}
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="2 2"
            isAnimationActive={false}
          />
        </>
      }
    />
  );
});

ActiveAeroChart.displayName = 'ActiveAeroChart';
