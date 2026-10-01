import React from 'react';
import { Clock, Timer } from 'lucide-react';
import { Line } from 'recharts';
import { useI18n } from '../../../context/I18nContext';
import { CHART_COLORS, type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { NO_ANIMATION } from '../../charts/chartTheme';
import { ChartSubtitle, ChartTitle, PacketLossNotice } from './ChartTitle';
import styles from './ComparatorChart.module.css';

export interface DeltaChartProps extends CommonChartProps {
  hasDeltaData: boolean;
  maxGapA: number;
  maxGapB: number;
}

export const DeltaChart = React.memo<DeltaChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB, hasDeltaData, maxGapA, maxGapB } = props;

  const titleNode = (
    <>
      <ChartTitle icon={Timer} label={t('comparator.charts.timeDelta')} />
      <PacketLossNotice maxGapA={maxGapA} maxGapB={maxGapB} nameA={nameA} nameB={nameB} />
    </>
  );

  const headerRight = (
    <ChartSubtitle>{t('comparator.charts.timeDeltaSub', { driverA: nameA, driverB: nameB })}</ChartSubtitle>
  );

  const driverB = nameB || t('comparator.defaultDriverB');
  const emptyBody = !hasDeltaData ? (
    <div className={styles.placeholder}>
      <Clock size={20} className={styles.placeholderTitle} aria-hidden="true" />
      <span className={styles.placeholderTitle}>
        {t('comparator.charts.timeDeltaRequiresBoth', { driver: driverB })}
      </span>
      <span className={styles.placeholderText}>{t('comparator.charts.noTelemetryInSlot', { driver: driverB })}</span>
    </div>
  ) : undefined;

  return (
    <ComparatorChart
      {...props}
      height="300px"
      title={titleNode}
      headerRight={headerRight}
      customBody={emptyBody}
      showZeroLine={true}
      yAxisDomain={['auto', 'auto']}
      yAxisTickFormatter={(v) =>
        typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(2)}s` : ''
      }
      tooltipFormatter={(val: unknown) => {
        const num = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(num)
          ? [`${num > 0 ? '+' : ''}${num.toFixed(3)}s`, `${t('comparator.timeDelta')} (${nameA} vs ${nameB})`]
          : ['—', `${t('comparator.timeDelta')} (${nameA} vs ${nameB})`];
      }}
      legendItems={[{ id: 'delta', label: t('comparator.timeDelta'), color: CHART_COLORS.DELTA }]}
      extraLines={
        <Line
          type="monotone"
          dataKey="time_delta"
          name={t('comparator.timeDelta')}
          stroke={CHART_COLORS.DELTA}
          dot={false}
          strokeWidth={2.5}
          {...NO_ANIMATION}
        />
      }
    />
  );
});

DeltaChart.displayName = 'DeltaChart';
