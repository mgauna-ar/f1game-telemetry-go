import React from 'react';
import { Award, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Lap, Participant } from '../../types/session';
import { formatTime } from '../../utils/formatters';

interface ComparatorMetricsSummaryProps {
  lapAObj?: Lap;
  lapBObj?: Lap;
  nameA: string;
  nameB: string;
  driverA?: Participant;
  driverB?: Participant;
  totalDeltaMs: number | null;
  s1Delta: number | null;
  s2Delta: number | null;
  s3Delta: number | null;
}

export const SectorDeltaBadge: React.FC<{ label: string; msA?: number; msB?: number }> = ({ label, msA, msB }) => {
  if (!msA || !msB) return null;
  const deltaMs = msA - msB;
  const isFaster = deltaMs < 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.6rem', borderRadius: '4px' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{label}:</span>
      <span style={{ fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: isFaster ? '#ff4757' : deltaMs > 0 ? '#00d2d3' : '#fff' }}>
        {deltaMs > 0 ? '+' : ''}{(deltaMs / 1000).toFixed(3)}s
      </span>
      {isFaster ? <ArrowUpRight size={14} color="#ff4757" /> : deltaMs > 0 ? <ArrowDownRight size={14} color="#00d2d3" /> : null}
    </div>
  );
};

export const ComparatorMetricsSummary: React.FC<ComparatorMetricsSummaryProps> = ({
  lapAObj,
  lapBObj,
  nameA,
  nameB,
  driverA,
  driverB,
  totalDeltaMs,
}) => {
  const isLapAComplete = Boolean(lapAObj && lapAObj.is_valid && lapAObj.lap_time_ms > 0 && lapAObj.sector3_ms && lapAObj.sector3_ms > 0);
  const isLapBComplete = Boolean(lapBObj && lapBObj.is_valid && lapBObj.lap_time_ms > 0 && lapBObj.sector3_ms && lapBObj.sector3_ms > 0);
  const areBothLapsComplete = isLapAComplete && isLapBComplete;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Comparison Summary Banner */}
      {lapAObj && lapBObj && (
        <div
          className="glass-panel"
          style={{
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background:
              !areBothLapsComplete || totalDeltaMs === null
                ? 'rgba(243, 156, 18, 0.12)'
                : totalDeltaMs < 0
                ? 'rgba(255, 71, 87, 0.12)'
                : totalDeltaMs > 0
                ? 'rgba(0, 210, 211, 0.12)'
                : 'rgba(255,255,255,0.05)',
            border: `1px solid ${
              !areBothLapsComplete || totalDeltaMs === null
                ? 'rgba(243, 156, 18, 0.35)'
                : totalDeltaMs < 0
                ? 'rgba(255, 71, 87, 0.35)'
                : totalDeltaMs > 0
                ? 'rgba(0, 210, 211, 0.35)'
                : 'rgba(255,255,255,0.1)'
            }`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Award
              color={!areBothLapsComplete || totalDeltaMs === null ? '#f39c12' : totalDeltaMs < 0 ? '#ff4757' : '#00d2d3'}
              size={24}
            />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>
                {!areBothLapsComplete ? (
                  <span style={{ color: '#f39c12' }}>
                    {!isLapAComplete && !isLapBComplete
                      ? 'Both laps are incomplete (In-Lap / Aborted)'
                      : !isLapAComplete
                      ? 'Lap A is incomplete (Sector 3 missing)'
                      : 'Lap B is incomplete (Sector 3 missing)'}
                  </span>
                ) : totalDeltaMs !== null && totalDeltaMs < 0 ? (
                  <>
                    Lap A is <span style={{ color: '#ff4757' }}>{(Math.abs(totalDeltaMs) / 1000).toFixed(3)}s faster</span> than Lap B
                  </>
                ) : totalDeltaMs !== null && totalDeltaMs > 0 ? (
                  <>
                    Lap B is <span style={{ color: '#00d2d3' }}>{(Math.abs(totalDeltaMs) / 1000).toFixed(3)}s faster</span> than Lap A
                  </>
                ) : (
                  <>Identical lap times</>
                )}
              </div>

              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {nameA} ({isLapAComplete ? formatTime(lapAObj.lap_time_ms) : 'Incomplete'}) vs {nameB} ({isLapBComplete ? formatTime(lapBObj.lap_time_ms) : 'Incomplete'})
              </span>
            </div>
          </div>

          {/* Quick Sector Delta Badges */}
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
            <SectorDeltaBadge label="S1 Delta" msA={lapAObj.sector1_ms} msB={lapBObj.sector1_ms} />
            <SectorDeltaBadge label="S2 Delta" msA={lapAObj.sector2_ms} msB={lapBObj.sector2_ms} />
            <SectorDeltaBadge label="S3 Delta" msA={lapAObj.sector3_ms} msB={lapBObj.sector3_ms} />
          </div>
        </div>
      )}

      {/* Driver Summary Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {/* Lap A Card */}
        <div className="glass-panel comparator-card-panel" style={{ padding: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#ff4757', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ● {nameA}
          </h3>
          {lapAObj ? (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                {isLapAComplete ? formatTime(lapAObj.lap_time_ms) : '--:--.---'}
                {!lapAObj.is_valid ? (
                  <span style={{ fontSize: '0.75rem', color: '#ff4757', marginLeft: '0.5rem' }}>⚠️ INVALID</span>
                ) : !isLapAComplete ? (
                  <span style={{ fontSize: '0.75rem', color: '#f39c12', marginLeft: '0.5rem' }}>⚠️ INCOMPLETE</span>
                ) : null}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Driver: <strong style={{ color: '#fff' }}>{driverA?.name || `Car ${lapAObj.car_index ?? '?'}`}</strong> #{driverA?.race_number ?? ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S1</span>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapAObj.sector1_ms)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S2</span>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapAObj.sector2_ms)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S3</span>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapAObj.sector3_ms)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Select a lap for Slot A to view details
            </div>
          )}
        </div>

        {/* Lap B Card */}
        <div className="glass-panel comparator-card-panel" style={{ padding: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#00d2d3', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ● {nameB}
          </h3>
          {lapBObj ? (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                {isLapBComplete ? formatTime(lapBObj.lap_time_ms) : '--:--.---'}
                {!lapBObj.is_valid ? (
                  <span style={{ fontSize: '0.75rem', color: '#ff4757', marginLeft: '0.5rem' }}>⚠️ INVALID</span>
                ) : !isLapBComplete ? (
                  <span style={{ fontSize: '0.75rem', color: '#f39c12', marginLeft: '0.5rem' }}>⚠️ INCOMPLETE</span>
                ) : null}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Driver: <strong style={{ color: '#fff' }}>{driverB?.name || `Car ${lapBObj.car_index ?? '?'}`}</strong> #{driverB?.race_number ?? ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S1</span>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapBObj.sector1_ms)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S2</span>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapBObj.sector2_ms)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S3</span>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapBObj.sector3_ms)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Select a lap for Slot B to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
