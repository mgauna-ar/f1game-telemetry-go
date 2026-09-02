import React from 'react';
import { MapPin, Sparkles } from 'lucide-react';
import { TrackFlag } from '../TrackFlag';
import { ComparatorTrackMap } from '../ComparatorTrackMap';
import { getTurnContextAtDistance } from '../../utils/trackTurns';
import { ERS_MODE_NAMES } from '../../constants/f1';
import type { MergedTelemetryPoint, TrackTurn } from '../../types/comparator';
import type { Session } from '../../types/session';

interface ComparatorSidebarProps {
  comparisonData: MergedTelemetryPoint[];
  detectedTurns: TrackTurn[];
  hoverDistance: number | null;
  setHoverDistance: (dist: number | null) => void;
  sector1Distance: number | null;
  sector2Distance: number | null;
  selectedSessionAObj?: Session | null;
  nameA: string;
  nameB: string;
  onOpenAiDebrief: () => void;
}

export const ComparatorSidebar: React.FC<ComparatorSidebarProps> = ({
  comparisonData,
  detectedTurns,
  hoverDistance,
  setHoverDistance,
  sector1Distance,
  sector2Distance,
  selectedSessionAObj,
  nameA,
  nameB,
  onOpenAiDebrief,
}) => {
  const activePoint =
    hoverDistance !== null && comparisonData.length > 0
      ? comparisonData.reduce((prev, curr) =>
          Math.abs(curr.lap_distance - hoverDistance) < Math.abs(prev.lap_distance - hoverDistance) ? curr : prev,
        comparisonData[0])
      : null;

  const turnContext = getTurnContextAtDistance(detectedTurns, hoverDistance);

  return (
    <div className="comparator-sidebar-col">
      {/* Track Map */}
      <div className="glass-panel" style={{ padding: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPin size={15} color="var(--accent-primary)" /> Track Heatmap
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {selectedSessionAObj && (
              <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <TrackFlag track={selectedSessionAObj.track_name} width={14} height={10} />
                <span>{selectedSessionAObj.track_name}</span>
              </span>
            )}

            <button
              type="button"
              className="nav-tab active"
              onClick={onOpenAiDebrief}
              style={{
                padding: '3px 8px',
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: '12px',
                background: 'rgba(0, 242, 254, 0.12)',
                borderColor: 'rgba(0, 242, 254, 0.35)',
                color: '#00f2fe',
              }}
              title="Open AI Race Engineer telemetry analysis"
            >
              <Sparkles size={12} color="#00f2fe" /> Ask AI
            </button>
          </div>
        </div>

        <ComparatorTrackMap
          data={comparisonData}
          turns={detectedTurns}
          activeDistance={hoverDistance}
          height={380}
          sector1Distance={sector1Distance}
          sector2Distance={sector2Distance}
          onSelectDistance={(dist) => setHoverDistance(dist)}
        />

        {/* Turn Quick-Jump Ribbon */}
        {detectedTurns.length > 0 && (
          <div style={{ marginTop: '0.45rem', marginBottom: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Turns (click to jump):</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{detectedTurns.length} turns</span>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '4px',
                overflowX: 'auto',
                paddingBottom: '3px',
                scrollbarWidth: 'thin',
              }}
            >
              {detectedTurns.map((turn) => {
                const isSelected = hoverDistance !== null && Math.abs(turn.distance - hoverDistance) <= 35;
                return (
                  <button
                    key={turn.name}
                    type="button"
                    onClick={() => setHoverDistance(turn.distance)}
                    style={{
                      background: isSelected ? '#ffd200' : 'rgba(255, 255, 255, 0.08)',
                      color: isSelected ? '#000000' : '#ffffff',
                      border: isSelected ? '1px solid #ffd200' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    title={`${turn.name} (${turn.distance}m)`}
                  >
                    {turn.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Hover Point Live Telemetry Readout */}
        {comparisonData.length > 0 && (
          <div
            style={{
              marginTop: '0.4rem',
              padding: '0.5rem 0.75rem',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.75rem',
              minHeight: '112px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {activePoint ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Distance Point:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f1c40f' }}>{activePoint.lap_distance}m</span>
                  </div>

                  {turnContext.label && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        background: turnContext.phase === 'apex' ? 'rgba(255, 210, 0, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: turnContext.phase === 'apex' ? '#ffd200' : 'rgba(255, 255, 255, 0.85)',
                        border: turnContext.phase === 'apex' ? '1px solid rgba(255, 210, 0, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '3px',
                        padding: '1px 5px',
                      }}
                    >
                      📍 {turnContext.label}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.15rem' }}>
                  <div style={{ borderLeft: '2px solid #ff4757', paddingLeft: '0.35rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#ff4757', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameA}</div>
                    <div>Speed: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.speedA ?? '-'} km/h</strong></div>
                    <div>Thr/Brk: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.throttleA !== null ? Math.round(activePoint.throttleA * 100) : 0}% / {activePoint.brakeA !== null ? Math.round(activePoint.brakeA * 100) : 0}%</strong></div>
                    <div>ERS: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.ersBatteryA !== null ? activePoint.ersBatteryA.toFixed(0) : '-'}% ({ERS_MODE_NAMES[activePoint.ersDeployModeA ?? 0] || 'Off'})</strong></div>
                  </div>

                  <div style={{ borderLeft: '2px solid #00d2d3', paddingLeft: '0.35rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#00d2d3', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameB}</div>
                    <div>Speed: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.speedB ?? '-'} km/h</strong></div>
                    <div>Thr/Brk: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.throttleB !== null ? Math.round(activePoint.throttleB * 100) : 0}% / {activePoint.brakeB !== null ? Math.round(activePoint.brakeB * 100) : 0}%</strong></div>
                    <div>ERS: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.ersBatteryB !== null ? activePoint.ersBatteryB.toFixed(0) : '-'}% ({ERS_MODE_NAMES[activePoint.ersDeployModeB ?? 0] || 'Off'})</strong></div>
                  </div>
                </div>

                {activePoint.time_delta !== null && (
                  <div style={{ marginTop: '0.25rem', paddingTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontWeight: 700, fontSize: '0.74rem', color: activePoint.time_delta < 0 ? '#ff4757' : activePoint.time_delta > 0 ? '#00d2d3' : '#fff' }}>
                    Δ {activePoint.time_delta > 0 ? '+' : ''}{activePoint.time_delta.toFixed(3)}s
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', padding: '0.3rem 0' }}>
                <span style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: '2px' }}>
                  🔍 Live Telemetry Inspection
                </span>
                Hover over graphs or track to inspect telemetry at that point
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
