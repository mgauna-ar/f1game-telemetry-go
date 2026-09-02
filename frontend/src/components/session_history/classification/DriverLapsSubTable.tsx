import React, { useMemo } from 'react';
import { Clock, GitCompare } from 'lucide-react';
import { formatSectorTime } from '../../../utils/formatters';
import { useI18n } from '../../../context/I18nContext';
import type { Session, Lap, DriverStanding, StagedLap } from '../../../types/session';

interface DriverLapsSubTableProps {
  session: Session;
  driver: DriverStanding;
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  stagedA?: StagedLap | null;
  stagedB?: StagedLap | null;
  onStageLap?: (lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => void;
  onSendToComparator?: (sessionId: number, lapId: number, slot: 'A' | 'B') => void;
  formatLapTime: (ms: number) => string;
  formatTotalDuration: (ms: number) => string;
  renderTyreBadge: (compoundRaw?: string, actualCompound?: string) => React.ReactNode;
}

export const DriverLapsSubTable: React.FC<DriverLapsSubTableProps> = React.memo(({
  session,
  driver,
  sessionBestS1,
  sessionBestS2,
  sessionBestS3,
  stagedA,
  stagedB,
  onStageLap,
  onSendToComparator,
  formatLapTime,
  formatTotalDuration,
  renderTyreBadge,
}) => {
  const { t } = useI18n();
  const formatSector = (ms: number) => formatSectorTime(ms, false);

  const validLapsWithCumulative = useMemo(() => {
    let runningRaceTime = 0;
    return driver.laps
      .filter((lap) => lap.lap_time_ms > 0)
      .map((lap) => {
        runningRaceTime += lap.lap_time_ms;
        return {
          lap,
          runningRaceTime,
        };
      });
  }, [driver.laps]);

  return (
    <div style={{ padding: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} /> {t('history.classification.recordedLapsFor', { name: driver.participant.name })}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {t('history.classification.slotHelperText')}
        </div>
      </div>
      <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.lapNumber')}</th>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.lapTime')}</th>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.s1')}</th>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.s2')}</th>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.s3')}</th>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.cumulative')}</th>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.deltaToBest')}</th>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.maxSpeed')}</th>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.tyre')}</th>
            <th style={{ padding: '5px 8px' }}>{t('history.classification.subHeaders.status')}</th>
            <th style={{ padding: '5px 8px', textAlign: 'right' }}>{t('history.classification.subHeaders.compareTelemetry')}</th>
          </tr>
        </thead>
        <tbody>
          {validLapsWithCumulative.map(({ lap, runningRaceTime }) => {
            const isPB = driver.bestLap && lap.id === driver.bestLap.id;
            const lapDeltaToBest = driver.bestLap && lap.lap_time_ms > 0
              ? isPB
                ? t('history.classification.personalBest')
                : `+${((lap.lap_time_ms - driver.bestLap.lap_time_ms) / 1000).toFixed(3)}s`
              : '--';

            const s1 = lap.sector1_ms ?? 0;
            const s2 = lap.sector2_ms ?? 0;
            let s3 = lap.sector3_ms ?? 0;
            if (s3 === 0 && lap.lap_time_ms > 0 && s1 > 0 && s2 > 0) {
              s3 = lap.lap_time_ms - (s1 + s2);
            }

            const s1Purple = s1 > 0 && sessionBestS1 > 0 && s1 <= sessionBestS1;
            const s2Purple = s2 > 0 && sessionBestS2 > 0 && s2 <= sessionBestS2;
            const s3Purple = s3 > 0 && sessionBestS3 > 0 && s3 <= sessionBestS3;

            const s1Green = !s1Purple && s1 > 0 && s1 <= driver.bestS1MS;
            const s2Green = !s2Purple && s2 > 0 && s2 <= driver.bestS2MS;
            const s3Green = !s3Purple && s3 > 0 && s3 <= driver.bestS3MS;

            const isStagedA = stagedA?.lapId === lap.id;
            const isStagedB = stagedB?.lapId === lap.id;

            return (
              <tr key={lap.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td className="mono" style={{ padding: '6px 8px', fontWeight: 700 }}>
                  {t('history.classification.lapItem', { number: lap.lap_number })}
                </td>
                <td className="mono" style={{ padding: '6px 8px', color: isPB ? 'var(--accent-tertiary)' : 'inherit', fontWeight: isPB ? 700 : 500 }}>
                  {formatLapTime(lap.lap_time_ms)}
                </td>
                <td className="mono" style={{ padding: '6px 8px' }}>
                  <span className={s1Purple ? 'sector-purple' : s1Green ? 'sector-green' : ''}>
                    {formatSector(s1)}
                  </span>
                </td>
                <td className="mono" style={{ padding: '6px 8px' }}>
                  <span className={s2Purple ? 'sector-purple' : s2Green ? 'sector-green' : ''}>
                    {formatSector(s2)}
                  </span>
                </td>
                <td className="mono" style={{ padding: '6px 8px' }}>
                  <span className={s3Purple ? 'sector-purple' : s3Green ? 'sector-green' : ''}>
                    {formatSector(s3)}
                  </span>
                </td>
                <td className="mono" style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>
                  {formatTotalDuration(runningRaceTime)}
                </td>
                <td className="mono" style={{ padding: '6px 8px', color: isPB ? 'var(--accent-tertiary)' : 'var(--text-muted)' }}>
                  {lapDeltaToBest}
                </td>
                <td className="mono" style={{ padding: '6px 8px' }}>
                  {lap.max_speed_kmh ? `${lap.max_speed_kmh.toFixed(1)} km/h` : '-'}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    {renderTyreBadge(lap.tyre_compound, lap.actual_compound)}
                    {lap.stint && lap.stint > 0 && (
                      <span
                        className="mono"
                        style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-secondary)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          border: '1px solid var(--border-color)',
                          fontWeight: 600,
                        }}
                        title={t('history.classification.stintTooltip', { number: lap.stint })}
                      >
                        {t('history.classification.stintShort', { number: lap.stint })}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <span className={`session-badge ${lap.is_valid ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
                    {lap.is_valid ? t('history.classification.valid') : t('history.classification.invalid')}
                  </span>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  {(onStageLap || onSendToComparator) && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <button
                        className={`nav-tab ${isStagedA ? 'active' : ''}`}
                        title={isStagedA ? t('history.classification.stagedInSlotA') : t('history.classification.stageLapInSlotA', { lap: lap.lap_number })}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onStageLap) {
                            onStageLap(lap, driver, 'A');
                          } else if (onSendToComparator) {
                            onSendToComparator(session.id, lap.id, 'A');
                          }
                        }}
                        style={{
                          padding: '2px 7px',
                          fontSize: '0.72rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: isStagedA ? 'rgba(0, 242, 254, 0.22)' : undefined,
                          borderColor: isStagedA ? '#00f2fe' : undefined,
                          color: isStagedA ? '#00f2fe' : undefined,
                          fontWeight: isStagedA ? 800 : 500,
                          boxShadow: isStagedA ? '0 0 10px rgba(0, 242, 254, 0.3)' : undefined,
                        }}
                      >
                        <GitCompare size={11} /> {isStagedA ? `✓ ${t('history.classification.stageSlotA')}` : t('history.classification.stageSlotA')}
                      </button>

                      <button
                        className={`nav-tab ${isStagedB ? 'active' : ''}`}
                        title={isStagedB ? t('history.classification.stagedInSlotB') : t('history.classification.stageLapInSlotB', { lap: lap.lap_number })}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onStageLap) {
                            onStageLap(lap, driver, 'B');
                          } else if (onSendToComparator) {
                            onSendToComparator(session.id, lap.id, 'B');
                          }
                        }}
                        style={{
                          padding: '2px 7px',
                          fontSize: '0.72rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: isStagedB ? 'rgba(225, 6, 0, 0.22)' : undefined,
                          borderColor: isStagedB ? '#e10600' : undefined,
                          color: isStagedB ? '#ff4d4f' : undefined,
                          fontWeight: isStagedB ? 800 : 500,
                          boxShadow: isStagedB ? '0 0 10px rgba(225, 6, 0, 0.3)' : undefined,
                        }}
                      >
                        <GitCompare size={11} /> {isStagedB ? `✓ ${t('history.classification.stageSlotB')}` : t('history.classification.stageSlotB')}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

DriverLapsSubTable.displayName = 'DriverLapsSubTable';
