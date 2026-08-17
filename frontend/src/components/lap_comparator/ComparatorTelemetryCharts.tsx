import React from 'react';
import { ZoomIn, RotateCcw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { MergedTelemetryPoint } from '../../utils/deltaCalculation';
import { ERS_MODE_NAMES } from '../../constants/f1';
import { useI18n } from '../../context/I18nContext';

interface ComparatorTelemetryChartsProps {
  chartData: MergedTelemetryPoint[];
  comparisonData: MergedTelemetryPoint[];
  nameA: string;
  nameB: string;
  hoverDistance: number | null;
  onHoverDistanceChange: (dist: number | null) => void;
  zoomDomain: [number, number] | null;
  onZoomDomainChange: (domain: [number, number] | null) => void;
  sector1Distance: number | null;
  sector2Distance: number | null;
  sessionAId: number | '';
  loadingA: boolean;
  loadingB: boolean;
  onMouseMove: (state: any) => void;
}

const compactTooltipProps = {
  contentStyle: {
    backgroundColor: 'rgba(10, 14, 23, 0.65)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.72rem',
    lineHeight: '1.2',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
  },
  itemStyle: {
    padding: '1px 0',
    fontSize: '0.70rem',
    margin: 0,
  },
  labelStyle: {
    color: '#cbd5e1',
    fontSize: '0.68rem',
    marginBottom: '2px',
    fontWeight: 600,
  },
  wrapperStyle: {
    zIndex: 100,
    pointerEvents: 'none' as const,
  },
  labelFormatter: (label: any) => `${Math.round(Number(label))}m`,
};

export const ComparatorTelemetryCharts: React.FC<ComparatorTelemetryChartsProps> = ({
  chartData,
  comparisonData,
  nameA,
  nameB,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Synchronized Track Distance Zoom Toolbar */}
      {comparisonData.length > 0 && (
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
                border: !zoomDomain ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                background: !zoomDomain ? 'rgba(255, 71, 87, 0.15)' : 'rgba(255,255,255,0.05)',
                color: !zoomDomain ? '#ff4757' : '#ccc',
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
      {comparisonData.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 1. TIME DELTA CHART */}
          <div className="glass-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ⏱️ {t('comparator.charts.timeDelta')}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('comparator.charts.timeDeltaSub', { driverA: nameA, driverB: nameB })}
              </span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#999', fontSize: 11 }}
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(2)}s` : '')}
                  />
                  <Tooltip
                    {...compactTooltipProps}
                    formatter={(val: any) =>
                      val !== null && val !== undefined && Number.isFinite(Number(val))
                        ? [`${Number(val) > 0 ? '+' : ''}${Number(val).toFixed(3)}s`, `Time Delta (${nameA} vs ${nameB})`]
                        : ['-', `Time Delta (${nameA} vs ${nameB})`]
                    }
                  />
                  <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                  {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                  {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                  {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                  <Line type="monotone" dataKey="time_delta" name="Time Delta" stroke="#f1c40f" dot={false} strokeWidth={2.5} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. SPEED CHART */}
          <div className="glass-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#fff' }}>
              🏎️ {t('comparator.charts.speed')}
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#999', fontSize: 11 }}
                    domain={[0, 360]}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}` : '')}
                  />
                  <Tooltip
                    {...compactTooltipProps}
                    formatter={(val: any) =>
                      val !== null && val !== undefined && Number.isFinite(Number(val)) ? [`${Math.round(Number(val))} km/h`] : ['-']
                    }
                  />
                  {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                  {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                  {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                  <Line type="monotone" dataKey="speedA" name={`${nameA} Speed (km/h)`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="speedB" name={`${nameB} Speed (km/h)`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. INDIVIDUAL THROTTLE CHART */}
          <div className="glass-panel" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#2ecc71', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🟢 {t('comparator.charts.throttle')}
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#999', fontSize: 11 }}
                    domain={[0, 1]}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '')}
                  />
                  <Tooltip
                    {...compactTooltipProps}
                    formatter={(val: any) =>
                      val !== null && val !== undefined && Number.isFinite(Number(val)) ? [`${Math.round(Number(val) * 100)}%`] : ['-']
                    }
                  />
                  {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                  {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                  {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                  <Line type="monotone" dataKey="throttleA" name={`${nameA} Throttle`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="throttleB" name={`${nameB} Throttle`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. INDIVIDUAL BRAKE CHART */}
          <div className="glass-panel" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#ff4757', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🔴 {t('comparator.charts.brake')}
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#999', fontSize: 11 }}
                    domain={[0, 1]}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '')}
                  />
                  <Tooltip
                    {...compactTooltipProps}
                    formatter={(val: any) =>
                      val !== null && val !== undefined && Number.isFinite(Number(val)) ? [`${Math.round(Number(val) * 100)}%`] : ['-']
                    }
                  />
                  {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                  {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                  {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                  <Line type="monotone" dataKey="brakeA" name={`${nameA} Brake`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="brakeB" name={`${nameB} Brake`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. GEAR SELECTION CHART */}
          <div className="glass-panel" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#fff' }}>
              ⚙️ {t('comparator.charts.gear')}
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#999', fontSize: 11 }}
                    domain={[1, 8]}
                    ticks={[1, 2, 3, 4, 5, 6, 7, 8]}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `G${Math.round(v)}` : '')}
                  />
                  <Tooltip
                    {...compactTooltipProps}
                    formatter={(val: any) =>
                      val !== null && val !== undefined && Number.isFinite(Number(val)) ? [`Gear ${Math.round(Number(val))}`] : ['-']
                    }
                  />
                  {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                  {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                  {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                  <Line type="stepAfter" dataKey="gearA" name={`${nameA} Gear`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="gearB" name={`${nameB} Gear`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. STEERING ANGLE CHART */}
          <div className="glass-panel" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#fff' }}>
              📐 {t('comparator.charts.steering')}
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#999', fontSize: 11 }}
                    domain={[-1, 1]}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(2)}` : '')}
                  />
                  <Tooltip
                    {...compactTooltipProps}
                    formatter={(val: any) =>
                      val !== null && val !== undefined && Number.isFinite(Number(val)) ? [`${Number(val).toFixed(2)}`] : ['-']
                    }
                  />
                  <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                  {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                  {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                  {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                  <Line type="monotone" dataKey="steerA" name={`${nameA} Steer`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="steerB" name={`${nameB} Steer`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 7. INDIVIDUAL ERS BATTERY CHART */}
          <div className="glass-panel" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#38ef7d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              ⚡ {t('comparator.charts.ersBattery')}
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#999', fontSize: 11 }}
                    domain={[0, 100]}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}%` : '')}
                  />
                  <Tooltip
                    {...compactTooltipProps}
                    formatter={(val: any) =>
                      val !== null && val !== undefined && Number.isFinite(Number(val)) ? [`${Number(val).toFixed(1)}%`] : ['-']
                    }
                  />
                  {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                  {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                  {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                  <Line type="monotone" dataKey="ersBatteryA" name={`${nameA} Battery (%)`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="ersBatteryB" name={`${nameB} Battery (%)`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 8. INDIVIDUAL ERS DEPLOY MODE CHART */}
          <div className="glass-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#bd93f9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🚀 {t('comparator.charts.ersDeployMode')}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('comparator.charts.ersDeployModesSub')}
              </span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="comparatorSync" onMouseMove={onMouseMove} onMouseLeave={() => onHoverDistanceChange(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                  <YAxis
                    stroke="#bd93f9"
                    tick={{ fill: '#bd93f9', fontSize: 11 }}
                    domain={[0, 3]}
                    ticks={[0, 1, 2, 3]}
                    tickFormatter={(v) => (typeof v === 'number' && Number.isFinite(v) ? ERS_MODE_NAMES[Math.round(v)] || `${Math.round(v)}` : '')}
                  />
                  <Tooltip
                    {...compactTooltipProps}
                    formatter={(val: any, name?: any) => {
                      if (val === null || val === undefined || !Number.isFinite(Number(val))) return ['-', String(name ?? '')];
                      const modeNum = Math.round(Number(val));
                      return [ERS_MODE_NAMES[modeNum] || `Mode ${modeNum}`, String(name ?? '')];
                    }}
                  />
                  {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                  {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                  {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                  <Line type="stepAfter" dataKey="ersDeployModeA" name={`${nameA} Mode`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="ersDeployModeB" name={`${nameB} Mode`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>
            {!sessionAId
              ? t('comparator.charts.selectSessionAndLaps')
              : loadingA || loadingB
              ? t('comparator.charts.loadingTelemetry')
              : t('comparator.charts.selectBothLaps')}
          </p>
        </div>
      )}
    </div>
  );
};
