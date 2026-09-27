import React, { useMemo } from 'react';
import { ZoomIn, RotateCcw, LineChart } from 'lucide-react';
import type { MergedTelemetryPoint } from '../../types/comparator';
import { useI18n } from '../../context/I18nContext';
import { type CommonChartProps, type RechartsMouseMoveState } from './charts/chartDefaults';
import { DeltaChart } from './charts/DeltaChart';
import { SpeedChart } from './charts/SpeedChart';
import { ThrottleChart } from './charts/ThrottleChart';
import { BrakeChart } from './charts/BrakeChart';
import { GearChart } from './charts/GearChart';
import { SteeringChart } from './charts/SteeringChart';
import { ErsBatteryChart } from './charts/ErsBatteryChart';
import { ErsDeployModeChart } from './charts/ErsDeployModeChart';
import { ActiveAeroChart } from './charts/ActiveAeroChart';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import styles from './ComparatorTelemetryCharts.module.css';

export interface ComparatorTelemetryChartsProps {
  chartData: MergedTelemetryPoint[];
  comparisonData: MergedTelemetryPoint[];
  nameA: string;
  nameB: string;
  formatA?: number | null;
  formatB?: number | null;
  hoverDistance: number | null;
  onHoverDistanceChange: (dist: number | null) => void;
  zoomDomain: [number, number] | null;
  onZoomDomainChange: (domain: [number, number] | null) => void;
  sector1Distance: number | null;
  sector2Distance: number | null;
  sessionAId: number | '';
  loadingA: boolean;
  loadingB: boolean;
  onMouseMove: (state: RechartsMouseMoveState<MergedTelemetryPoint> | null) => void;
}

export const ComparatorTelemetryCharts: React.FC<ComparatorTelemetryChartsProps> = React.memo(
  ({
    chartData,
    comparisonData,
    nameA,
    nameB,
    formatA,
    formatB,
    hoverDistance,
    onHoverDistanceChange,
    zoomDomain,
    onZoomDomainChange,
    sector1Distance,
    sector2Distance,
    sessionAId,
    loadingA,
    loadingB,
    onMouseMove,
  }) => {
    const { t } = useI18n();

    const hasDataA = comparisonData.some((p) => p.speedA !== null && p.speedA !== undefined);
    const hasDataB = comparisonData.some((p) => p.speedB !== null && p.speedB !== undefined);
    const hasDeltaData = comparisonData.some((p) => p.time_delta !== null && p.time_delta !== undefined);
    const hasAnyTelemetry = hasDataA || hasDataB;

    const is2026 = formatA === 2026 || formatB === 2026;
    const hasActiveAeroData =
      is2026 ||
      chartData.some(
        (p) =>
          (p.activeAeroA !== null && p.activeAeroA !== undefined) ||
          (p.activeAeroB !== null && p.activeAeroB !== undefined) ||
          (p.boostActiveA !== null && p.boostActiveA !== undefined) ||
          (p.boostActiveB !== null && p.boostActiveB !== undefined)
      );

    const isErsRestrictedA =
      hasDataA &&
      chartData.length > 0 &&
      chartData.every(
        (p) =>
          (p.ersBatteryA === null || p.ersBatteryA === undefined || p.ersBatteryA === 0) &&
          (p.ersDeployModeA === null || p.ersDeployModeA === undefined || p.ersDeployModeA === 0)
      );

    const isErsRestrictedB =
      hasDataB &&
      chartData.length > 0 &&
      chartData.every(
        (p) =>
          (p.ersBatteryB === null || p.ersBatteryB === undefined || p.ersBatteryB === 0) &&
          (p.ersDeployModeB === null || p.ersDeployModeB === undefined || p.ersDeployModeB === 0)
      );

    const maxGapA = useMemo(() => {
      let max = 0;
      for (let i = 1; i < comparisonData.length; i++) {
        if (comparisonData[i - 1].speedA !== null && comparisonData[i].speedA !== null) {
          const gap = comparisonData[i].lap_distance - comparisonData[i - 1].lap_distance;
          if (gap > max) max = gap;
        }
      }
      return max >= 100 ? Math.round(max) : 0;
    }, [comparisonData]);

    const maxGapB = useMemo(() => {
      let max = 0;
      for (let i = 1; i < comparisonData.length; i++) {
        if (comparisonData[i - 1].speedB !== null && comparisonData[i].speedB !== null) {
          const gap = comparisonData[i].lap_distance - comparisonData[i - 1].lap_distance;
          if (gap > max) max = gap;
        }
      }
      return max >= 100 ? Math.round(max) : 0;
    }, [comparisonData]);

    const commonProps: CommonChartProps = {
      chartData,
      nameA,
      nameB,
      sector1Distance,
      sector2Distance,
      hoverDistance,
      onMouseMove,
      onHoverDistanceChange,
    };

    // Zoom presets: the whole lap, or one sector once the sector boundaries are known
    const lapEnd = comparisonData.length > 0 ? comparisonData[comparisonData.length - 1].lap_distance : null;
    const sectorRanges: Array<{ sector: number; range: [number, number] | null }> = [
      { sector: 1, range: sector1Distance !== null ? [0, sector1Distance] : null },
      {
        sector: 2,
        range: sector1Distance !== null && sector2Distance !== null ? [sector1Distance, sector2Distance] : null,
      },
      { sector: 3, range: sector2Distance !== null && lapEnd !== null ? [sector2Distance, lapEnd] : null },
    ];
    const isZoomedTo = (range: [number, number]) =>
      zoomDomain !== null && zoomDomain[0] === range[0] && zoomDomain[1] === range[1];

    return (
      <div className={styles.wrap}>
        {/* Zoom shared by every chart, by track distance */}
        {comparisonData.length > 0 && hasAnyTelemetry && (
          <div className={styles.toolbar}>
            <div className={styles.zoom} role="group" aria-label={t('comparator.charts.zoom')}>
              <ZoomIn size={16} className={styles.zoomIcon} aria-hidden="true" />
              <span className={styles.zoomLabel} aria-hidden="true">
                {t('comparator.charts.zoom')}:
              </span>
              <button
                type="button"
                className={styles.zoomButton}
                aria-pressed={!zoomDomain}
                onClick={() => onZoomDomainChange(null)}
              >
                {t('comparator.charts.fullTrack')}
              </button>
              {sectorRanges.map(({ sector, range }) =>
                range ? (
                  <button
                    key={sector}
                    type="button"
                    className={styles.zoomButton}
                    data-sector={sector}
                    aria-pressed={isZoomedTo(range)}
                    onClick={() => onZoomDomainChange(range)}
                  >
                    {t('comparator.charts.sectorN', { sector })}
                  </button>
                ) : null
              )}
            </div>

            {zoomDomain && (
              <Button
                size="sm"
                onClick={() => onZoomDomainChange(null)}
                icon={<RotateCcw size={12} aria-hidden="true" />}
              >
                {t('comparator.charts.resetZoom', {
                  from: Math.round(zoomDomain[0]),
                  to: Math.round(zoomDomain[1]),
                })}
              </Button>
            )}
          </div>
        )}

        {comparisonData.length > 0 && hasAnyTelemetry ? (
          <div className={styles.charts}>
            {/* 1. TIME DELTA CHART */}
            <DeltaChart {...commonProps} hasDeltaData={hasDeltaData} maxGapA={maxGapA} maxGapB={maxGapB} />

            {/* 2. SPEED CHART */}
            <SpeedChart {...commonProps} maxGapA={maxGapA} maxGapB={maxGapB} />

            {/* 3. INDIVIDUAL THROTTLE CHART */}
            <ThrottleChart {...commonProps} />

            {/* 4. INDIVIDUAL BRAKE CHART */}
            <BrakeChart {...commonProps} />

            {/* 5. GEAR SELECTION CHART */}
            <GearChart {...commonProps} />

            {/* 6. STEERING ANGLE CHART */}
            <SteeringChart {...commonProps} />

            {/* 7. INDIVIDUAL ERS BATTERY CHART */}
            <ErsBatteryChart {...commonProps} isErsRestrictedA={isErsRestrictedA} isErsRestrictedB={isErsRestrictedB} />

            {/* 8. INDIVIDUAL ERS DEPLOY MODE CHART */}
            <ErsDeployModeChart
              {...commonProps}
              isErsRestrictedA={isErsRestrictedA}
              isErsRestrictedB={isErsRestrictedB}
              formatA={formatA}
              formatB={formatB}
              is2026={is2026}
            />

            {/* 9. ACTIVE AERO & BOOST CHART (When 2026 Telemetry Present) */}
            {hasActiveAeroData && <ActiveAeroChart {...commonProps} />}
          </div>
        ) : (
          <Panel as="div">
            <EmptyState
              icon={<LineChart size={36} />}
              description={getComparatorEmptyStateMessage(
                sessionAId,
                loadingA,
                loadingB,
                hasAnyTelemetry,
                comparisonData.length > 0,
                t
              )}
            />
          </Panel>
        )}
      </div>
    );
  }
);

const getComparatorEmptyStateMessage = (
  sessionAId: number | '',

  loadingA: boolean,
  loadingB: boolean,
  hasAnyTelemetry: boolean,
  hasComparisonData: boolean,
  t: (key: string) => string
): string => {
  if (!sessionAId) {
    return t('comparator.charts.selectSessionAndLaps');
  }
  if (loadingA || loadingB) {
    return t('comparator.charts.loadingTelemetry');
  }
  if (hasComparisonData && !hasAnyTelemetry) {
    return t('comparator.charts.noTelemetryBoth');
  }
  return t('comparator.charts.selectBothLaps');
};

ComparatorTelemetryCharts.displayName = 'ComparatorTelemetryCharts';
