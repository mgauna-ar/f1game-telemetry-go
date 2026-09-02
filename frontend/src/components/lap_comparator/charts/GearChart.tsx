import React from 'react';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';

export const GearChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB } = props;

  return (
    <ComparatorChart
      {...props}
      height="260px"
      title={<h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>⚙️ {t('comparator.charts.gear')}</h3>}
      dataKeyA="gearA"
      dataKeyB="gearB"
      lineNameA={`${nameA} Gear`}
      lineNameB={`${nameB} Gear`}
      lineType="stepAfter"
      yAxisDomain={[1, 8]}
      yAxisTicks={[1, 2, 3, 4, 5, 6, 7, 8]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `G${Math.round(v)}` : '')}
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num) ? [`Gear ${Math.round(num)}`] : ['-'];
      }}
    />
  );
});

GearChart.displayName = 'GearChart';
