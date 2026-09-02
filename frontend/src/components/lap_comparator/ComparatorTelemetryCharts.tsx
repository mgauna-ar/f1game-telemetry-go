import React, { useMemo } from 'react';
import { ZoomIn, RotateCcw } from 'lucide-react';
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

export const ComparatorTelemetryCharts: React.FC<ComparatorTelemetryChartsProps> = React.memo(({
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Synchronized Track Distance Zoom Toolbar */}
      {comparisonData.length > 0 && hasAnyTelemetry && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 1rem',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.08)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <ZoomIn size={16} color="var(--accent-primary)" />
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {t('comparator.charts.zoom')}:
            </span>
            <button
              type="button"
              onClick={() => onZoomDomainChange(null)}
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '4px',
                border: !zoomDomain ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.15)',
                background: !zoomDomain ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.05)',
                color: !zoomDomain ? 'var(--accent-primary)' : '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('comparator.charts.fullTrack')}
            </button>
            {sector1Distance !== null && (
              <button
                type="button"
                onClick={() => onZoomDomainChange([0, sector1Distance])}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(243, 156, 18, 0.4)',
                  background: 'rgba(243, 156, 18, 0.12)',
                  color: '#f39c12',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sector 1
              </button>
            )}
            {sector1Distance !== null && sector2Distance !== null && (
              <button
                type="button"
                onClick={() => onZoomDomainChange([sector1Distance, sector2Distance])}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(155, 89, 182, 0.4)',
                  background: 'rgba(155, 89, 182, 0.12)',
                  color: '#9b59b6',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sector 2
              </button>
            )}
            {sector2Distance !== null && comparisonData.length > 0 && (
              <button
                type="button"
                onClick={() => onZoomDomainChange([sector2Distance, comparisonData[comparisonData.length - 1].lap_distance])}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 210, 211, 0.4)',
                  background: 'rgba(0, 210, 211, 0.12)',
                  color: '#00d2d3',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sector 3
              </button>
            )}
          </div>

          {zoomDomain && (
            <button
              type="button"
              onClick={() => onZoomDomainChange(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} /> Reset Zoom ({Math.round(zoomDomain[0])}m - {Math.round(zoomDomain[1])}m)
            </button>
          )}
        </div>
      )}

      {/* TELEMETRY CHARTS STACK */}
      {comparisonData.length > 0 && hasAnyTelemetry ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 1. TIME DELTA CHART */}
          <DeltaChart
            {...commonProps}
            hasDeltaData={hasDeltaData}
            maxGapA={maxGapA}
            maxGapB={maxGapB}
          />

          {/* 2. SPEED CHART */}
          <SpeedChart
            {...commonProps}
            maxGapA={maxGapA}
            maxGapB={maxGapB}
          />

          {/* 3. INDIVIDUAL THROTTLE CHART */}
          <ThrottleChart {...commonProps} />

          {/* 4. INDIVIDUAL BRAKE CHART */}
          <BrakeChart {...commonProps} />

          {/* 5. GEAR SELECTION CHART */}
          <GearChart {...commonProps} />

          {/* 6. STEERING ANGLE CHART */}
          <SteeringChart {...commonProps} />

          {/* 7. INDIVIDUAL ERS BATTERY CHART */}
          <ErsBatteryChart
            {...commonProps}
            isErsRestrictedA={isErsRestrictedA}
            isErsRestrictedB={isErsRestrictedB}
          />

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
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>

          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>
            {getComparatorEmptyStateMessage(
              sessionAId,
              loadingA,
              loadingB,
              hasAnyTelemetry,
              comparisonData.length > 0,
              t
            )}
          </p>
        </div>
      )}
    </div>
  );
});

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

