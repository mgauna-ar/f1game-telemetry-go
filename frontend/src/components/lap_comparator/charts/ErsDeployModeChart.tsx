import React from 'react';
import { Zap } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { getErsModeName } from '../../../constants/f1';
import { CHART_COLORS, type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';
import { ChartNotice, ChartSubtitle, ChartTitle } from './ChartTitle';

export interface ErsDeployModeChartProps extends CommonChartProps {
  isErsRestrictedA: boolean;
  isErsRestrictedB: boolean;
  formatA?: number | null;
  formatB?: number | null;
  is2026: boolean;
}

export const ErsDeployModeChart = React.memo<ErsDeployModeChartProps>((props) => {
  const { t } = useI18n();
  const { nameA, nameB, isErsRestrictedA, isErsRestrictedB, formatA, formatB, is2026 } = props;

  const titleNode = (
    <>
      <ChartTitle icon={Zap} label={t('comparator.charts.ersDeployMode')} color={CHART_COLORS.ERS_MODE} />
      {(isErsRestrictedA || isErsRestrictedB) && (
        <ChartNotice>
          {isErsRestrictedA && isErsRestrictedB
            ? t('comparator.charts.ersRestrictedBoth', { nameA, nameB })
            : t('comparator.charts.ersRestrictedSingle', { name: isErsRestrictedA ? nameA : nameB })}
        </ChartNotice>
      )}
    </>
  );

  const headerRight = (
    <ChartSubtitle>
      {is2026 ? t('comparator.charts.ersDeployModesSub2026') : t('comparator.charts.ersDeployModesSub')}
    </ChartSubtitle>
  );

  return (
    <ComparatorChart
      {...props}
      height="300px"
      title={titleNode}
      headerRight={headerRight}
      dataKeyA="ersDeployModeA"
      dataKeyB="ersDeployModeB"
      lineNameA={`${nameA} Mode`}
      lineNameB={`${nameB} Mode`}
      lineType="stepAfter"
      yAxisStroke={CHART_COLORS.ERS_MODE}
      yAxisDomain={[0, 3]}
      yAxisTicks={[0, 1, 2, 3]}
      yAxisTickFormatter={(v) =>
        typeof v === 'number' && Number.isFinite(v) ? getErsModeName(Math.round(v), formatA || formatB) : ''
      }
      tooltipFormatter={(val: unknown, name?: string | number) => {
        const num = typeof val === 'number' ? val : Number(val);
        if (val === null || val === undefined || !Number.isFinite(num)) return ['-', String(name ?? '')];
        const modeNum = Math.round(num);
        const fmt = String(name ?? '').includes(nameA) ? formatA : formatB;
        return [getErsModeName(modeNum, fmt), String(name ?? '')];
      }}
    />
  );
});

ErsDeployModeChart.displayName = 'ErsDeployModeChart';
