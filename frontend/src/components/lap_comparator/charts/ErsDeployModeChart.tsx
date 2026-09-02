import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { getErsModeName } from '../../../constants/f1';
import { type CommonChartProps } from './chartDefaults';
import { ComparatorChart } from './ComparatorChart';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
      <h3 style={{ margin: 0, fontSize: '1rem', color: '#bd93f9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        🚀 {t('comparator.charts.ersDeployMode')}
      </h3>
      {(isErsRestrictedA || isErsRestrictedB) && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.72rem',
            color: '#ffa502',
            background: 'rgba(255, 165, 2, 0.15)',
            border: '1px solid rgba(255, 165, 2, 0.4)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={11} />
          <span>
            {isErsRestrictedA && isErsRestrictedB
              ? t('comparator.charts.ersRestrictedBoth', { nameA, nameB })
              : isErsRestrictedA
              ? t('comparator.charts.ersRestrictedSingle', { name: nameA })
              : t('comparator.charts.ersRestrictedSingle', { name: nameB })}
          </span>
        </span>
      )}
    </div>
  );

  const headerRight = (
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      {is2026 ? t('comparator.charts.ersDeployModesSub2026') : t('comparator.charts.ersDeployModesSub')}
    </span>
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
      yAxisStroke="#bd93f9"
      yAxisDomain={[0, 3]}
      yAxisTicks={[0, 1, 2, 3]}
      yAxisTickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? getErsModeName(Math.round(v), formatA || formatB) : '')}
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
