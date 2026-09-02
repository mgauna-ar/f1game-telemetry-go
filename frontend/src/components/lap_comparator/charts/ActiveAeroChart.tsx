import React from 'react';
import { Line } from 'recharts';
import { useI18n } from '../../../context/I18nContext';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';

export const ActiveAeroChart = React.memo<CommonChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB } = props;

  const headerRight = (
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      {t('comparator.charts.activeAeroSub')}
    </span>
  );

  return (
    <ComparatorChart
      {...props}
      height="300px"
      title={
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🪽 {t('comparator.charts.activeAero')}
        </h3>
      }
      headerRight={headerRight}
      dataKeyA="activeAeroA"
      dataKeyB="activeAeroB"
      lineNameA={`${nameA} Aero`}
      lineNameB={`${nameB} Aero`}
      lineType="stepAfter"
      yAxisStroke="#00f2fe"
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
          <Line type="stepAfter" dataKey="boostActiveA" name={`${nameA} Boost`} stroke="#ffd700" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="boostActiveB" name={`${nameB} Boost`} stroke="#a855f7" dot={false} strokeWidth={1.5} strokeDasharray="2 2" isAnimationActive={false} />
        </>
      }
    />
  );
});

ActiveAeroChart.displayName = 'ActiveAeroChart';
