import React from 'react';
import { Wind } from 'lucide-react';
import { Line } from 'recharts';
import { useI18n } from '../../../context/I18nContext';
import { CHART_COLORS, type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { NO_ANIMATION } from '../../charts/chartTheme';
import { ChartSubtitle, ChartTitle } from './ChartTitle';

export const ActiveAeroChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB } = props;

  const boostA = `${nameA} · ${t('comparator.charts.boost')}`;
  const boostB = `${nameB} · ${t('comparator.charts.boost')}`;
  const headerRight = <ChartSubtitle>{t('comparator.charts.activeAeroSub')}</ChartSubtitle>;

  return (
    <ComparatorChart
      {...props}
      height="300px"
      title={<ChartTitle icon={Wind} label={t('comparator.charts.activeAero')} color={CHART_COLORS.AERO} />}
      headerRight={headerRight}
      dataKeyA="activeAeroA"
      dataKeyB="activeAeroB"
      lineType="stepAfter"
      yAxisStroke={CHART_COLORS.AERO}
      yAxisDomain={[0, 1]}
      yAxisTicks={[0, 1]}
      yAxisTickFormatter={(v) =>
        v === 1 ? t('comparator.charts.activeAeroStraight') : t('comparator.charts.activeAeroCorner')
      }
      tooltipFormatter={(val: unknown, name?: string | number, item?: { dataKey?: unknown }) => {
        const num = typeof val === 'number' ? val : Number(val);
        if (val === null || val === undefined || !Number.isFinite(num)) return ['—', String(name ?? '')];
        const numericVal = Math.round(num);
        const labelName = String(name ?? '');
        if (item?.dataKey === 'boostActiveA' || item?.dataKey === 'boostActiveB') {
          return [numericVal === 1 ? t('comparator.charts.boostOn') : t('comparator.charts.boostOff'), labelName];
        }
        return [
          numericVal === 1 ? t('comparator.charts.activeAeroStraight') : t('comparator.charts.activeAeroCorner'),
          labelName,
        ];
      }}
      legendItems={[
        { id: 'boostA', label: boostA, color: CHART_COLORS.BOOST_A },
        { id: 'boostB', label: boostB, color: CHART_COLORS.BOOST_B, shape: 'dotted' },
      ]}
      extraLines={
        <>
          <Line
            type="stepAfter"
            dataKey="boostActiveA"
            name={boostA}
            stroke={CHART_COLORS.BOOST_A}
            dot={false}
            strokeWidth={1.5}
            {...NO_ANIMATION}
          />
          <Line
            type="stepAfter"
            dataKey="boostActiveB"
            name={boostB}
            stroke={CHART_COLORS.BOOST_B}
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="2 2"
            {...NO_ANIMATION}
          />
        </>
      }
    />
  );
});

ActiveAeroChart.displayName = 'ActiveAeroChart';
