import React from 'react';
import { Award, ArrowUpRight, ArrowDownRight, Activity, Clock } from 'lucide-react';
import type { Lap, Participant } from '../../types/session';
import { formatTime } from '../../utils/formatters';
import { useI18n } from '../../context/I18nContext';

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

export const SectorDeltaBadge: React.FC<{ label: string; deltaMs: number | null }> = ({ label, deltaMs }) => {
  if (deltaMs === null || deltaMs === undefined) return null;
  const isFaster = deltaMs < 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        background: 'rgba(0,0,0,0.3)',
        padding: '0.35rem 0.6rem',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
      <span
        style={{
          color: deltaMs === 0 ? 'var(--text-muted)' : isFaster ? '#00d2d3' : '#ff4757',
          fontFamily: 'var(--font-mono)',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {deltaMs === 0 ? '0.000s' : `${(deltaMs / 1000).toFixed(3)}s`}
        {deltaMs !== 0 && (isFaster ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />)}
      </span>
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
  s1Delta,
  s2Delta,
  s3Delta,
}) => {
  const { t } = useI18n();

  // Completed valid checks (must have positive lap time and sector 3)
  const isLapAComplete = Boolean(lapAObj?.is_valid && lapAObj?.lap_time_ms > 0 && lapAObj?.sector3_ms && lapAObj.sector3_ms > 0);
  const isLapBComplete = Boolean(lapBObj?.is_valid && lapBObj?.lap_time_ms > 0 && lapBObj?.sector3_ms && lapBObj.sector3_ms > 0);
  const isBothComplete = isLapAComplete && isLapBComplete;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top Banner: Total Delta Summary */}
      {isBothComplete && totalDeltaMs !== null && (
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            background:
              totalDeltaMs < 0
                ? 'linear-gradient(90deg, rgba(0,210,211,0.15) 0%, rgba(0,210,211,0.02) 100%)'
                : totalDeltaMs > 0
                ? 'linear-gradient(90deg, rgba(255,71,87,0.15) 0%, rgba(255,71,87,0.02) 100%)'
                : 'rgba(255,255,255,0.05)',
            borderLeft: `4px solid ${totalDeltaMs < 0 ? '#00d2d3' : totalDeltaMs > 0 ? '#ff4757' : '#ffd700'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Award size={28} color={totalDeltaMs < 0 ? '#00d2d3' : totalDeltaMs > 0 ? '#ff4757' : '#ffd700'} />
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                {totalDeltaMs < 0
                  ? t('comparator.metrics.fasterLapA', { driver: nameA, delta: Math.abs(totalDeltaMs / 1000).toFixed(3) })
                  : totalDeltaMs > 0
                  ? t('comparator.metrics.fasterLapB', { driver: nameB, delta: (totalDeltaMs / 1000).toFixed(3) })
                  : t('comparator.metrics.identicalTime')}
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {nameA} ({formatTime(lapAObj?.lap_time_ms)}) vs {nameB} ({formatTime(lapBObj?.lap_time_ms)})
              </span>
            </div>
          </div>

          {/* Quick Sector Delta Badges */}
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
            <SectorDeltaBadge label="S1 Delta" deltaMs={s1Delta} />
            <SectorDeltaBadge label="S2 Delta" deltaMs={s2Delta} />
            <SectorDeltaBadge label="S3 Delta" deltaMs={s3Delta} />
          </div>
        </div>
      )}

      {/* Driver Summary Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {/* Lap A Card */}
        <div className="glass-panel comparator-card-panel" style={{ padding: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#00d2d3', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ● {nameA}
          </h3>
          {lapAObj ? (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#fff', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                {isLapAComplete ? formatTime(lapAObj.lap_time_ms) : '--:--.---'}
                {!lapAObj.is_valid ? (
                  <span style={{ fontSize: '0.75rem', color: '#ff4757' }}>⚠️ {t('comparator.invalid')}</span>
                ) : !isLapAComplete ? (
                  <span style={{ fontSize: '0.75rem', color: '#f39c12' }}>⚠️ {t('comparator.incomplete')}</span>
                ) : null}
                {lapAObj.has_telemetry ? (
                  <span style={{ fontSize: '0.70rem', color: '#00d2d3', background: 'rgba(0, 210, 211, 0.12)', border: '1px solid rgba(0, 210, 211, 0.3)', padding: '1px 5px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Activity size={10} /> {t('comparator.charts.telemetryAvailable')}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.70rem', color: '#f39c12', background: 'rgba(243, 156, 18, 0.12)', border: '1px solid rgba(243, 156, 18, 0.3)', padding: '1px 5px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={10} /> {t('comparator.charts.timingOnly')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {t('common.driver')}: <strong style={{ color: '#fff' }}>{driverA?.name || `Car ${lapAObj.car_index ?? '?'}`}</strong> #{driverA?.race_number ?? ''}
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
              {t('comparator.selectLapSlotA')}
            </div>
          )}
        </div>

        {/* Lap B Card */}
        <div className="glass-panel comparator-card-panel" style={{ padding: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#ff4757', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ● {nameB}
          </h3>
          {lapBObj ? (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#fff', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                {isLapBComplete ? formatTime(lapBObj.lap_time_ms) : '--:--.---'}
                {!lapBObj.is_valid ? (
                  <span style={{ fontSize: '0.75rem', color: '#ff4757' }}>⚠️ {t('comparator.invalid')}</span>
                ) : !isLapBComplete ? (
                  <span style={{ fontSize: '0.75rem', color: '#f39c12' }}>⚠️ {t('comparator.incomplete')}</span>
                ) : null}
                {lapBObj.has_telemetry ? (
                  <span style={{ fontSize: '0.70rem', color: '#00d2d3', background: 'rgba(0, 210, 211, 0.12)', border: '1px solid rgba(0, 210, 211, 0.3)', padding: '1px 5px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Activity size={10} /> {t('comparator.charts.telemetryAvailable')}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.70rem', color: '#f39c12', background: 'rgba(243, 156, 18, 0.12)', border: '1px solid rgba(243, 156, 18, 0.3)', padding: '1px 5px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={10} /> {t('comparator.charts.timingOnly')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {t('common.driver')}: <strong style={{ color: '#fff' }}>{driverB?.name || `Car ${lapBObj.car_index ?? '?'}`}</strong> #{driverB?.race_number ?? ''}
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
              {t('comparator.selectLapSlotB')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
