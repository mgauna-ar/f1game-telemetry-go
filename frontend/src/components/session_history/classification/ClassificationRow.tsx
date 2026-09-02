import React from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { TEAM_COLORS, RESULT_REASONS, RESULT_STATUS } from '../../../constants/f1';
import { formatSectorTime } from '../../../utils/formatters';
import { useI18n } from '../../../context/I18nContext';
import { DriverLapsSubTable } from './DriverLapsSubTable';
import type { Session, Lap, DriverStanding, StagedLap } from '../../../types/session';

interface ClassificationRowProps {
  session: Session;
  driver: DriverStanding;
  isLeader: boolean;
  isRaceSession: boolean;
  leaderBestLapMS: number;
  leaderTotalRaceTimeMS?: number;
  leaderLapsCount?: number;
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  sessionFastestLapMS: number;
  isExpanded: boolean;
  onToggleDriverExpand: (carIndex: number) => void;
  stagedA?: StagedLap | null;
  stagedB?: StagedLap | null;
  onStageLap?: (lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => void;
  onSendToComparator?: (sessionId: number, lapId: number, slot: 'A' | 'B') => void;
  formatLapTime: (ms: number) => string;
  formatTotalDuration: (ms: number) => string;
  renderTyreBadge: (compoundRaw?: string, actualCompound?: string) => React.ReactNode;
  renderDriverTyreStints: (laps: Lap[]) => React.ReactNode;
}

export const ClassificationRow: React.FC<ClassificationRowProps> = ({
  session,
  driver,
  isLeader,
  isRaceSession,
  leaderBestLapMS,
  leaderTotalRaceTimeMS,
  leaderLapsCount = 0,
  sessionBestS1,
  sessionBestS2,
  sessionBestS3,
  sessionFastestLapMS,
  isExpanded,
  onToggleDriverExpand,
  stagedA,
  stagedB,
  onStageLap,
  onSendToComparator,
  formatLapTime,
  formatTotalDuration,
  renderTyreBadge,
  renderDriverTyreStints,
}) => {
  const { t } = useI18n();
  const formatSector = (ms: number) => formatSectorTime(ms, false);
  const teamColor = TEAM_COLORS[driver.participant.team_id] || '#A0A0A0';

  // Overall session fastest lap check
  const isOverallFastestLap =
    sessionFastestLapMS > 0 &&
    driver.bestLapTimeMS > 0 &&
    driver.bestLapTimeMS === sessionFastestLapMS;

  // Time / Gap formatted string with rich DNF reasons
  let timeGapDisplay = '--';
  if (isRaceSession) {
    if (driver.isDSQ) {
      timeGapDisplay = driver.resultReason === RESULT_REASONS.BLACK_FLAGGED
        ? `DSQ (${t('history.classification.reasons.blackFlag')})`
        : 'DSQ';
    } else if (driver.isDNF) {
      const lastLapStatus = driver.laps?.[driver.laps.length - 1]?.result_status ?? driver.participant?.result_status;
      if (driver.resultReason === RESULT_REASONS.TERMINAL_DAMAGE) {
        timeGapDisplay = `DNF (${t('history.classification.reasons.terminalDamage')})`;
      } else if (driver.resultReason === RESULT_REASONS.MECHANICAL_FAILURE) {
        timeGapDisplay = `DNF (${t('history.classification.reasons.mechanicalFailure')})`;
      } else if (driver.resultReason === RESULT_REASONS.RETIRED || lastLapStatus === RESULT_STATUS.RETIRED) {
        timeGapDisplay = `DNF (${t('history.classification.reasons.retired')})`;
      } else if (driver.resultReason === RESULT_REASONS.NOT_ENOUGH_LAPS) {
        timeGapDisplay = `DNF (${t('history.classification.reasons.notEnoughLaps')})`;
      } else {
        timeGapDisplay = 'DNF';
      }
    } else if (isLeader) {
      timeGapDisplay = formatTotalDuration(driver.totalRaceTimeWithPenalties ?? 0);
    } else {
      const driverLapsCount = driver.laps.length;
      if (leaderLapsCount > 0 && driverLapsCount < leaderLapsCount) {
        const lapDiff = leaderLapsCount - driverLapsCount;
        timeGapDisplay = lapDiff === 1
          ? t('history.classification.lapDiffSingular', { count: lapDiff })
          : t('history.classification.lapDiffPlural', { count: lapDiff });
      } else if ((driver.totalRaceTimeWithPenalties ?? 0) > 0 && (leaderTotalRaceTimeMS ?? 0) > 0) {
        const gapMS = (driver.totalRaceTimeWithPenalties ?? 0) - (leaderTotalRaceTimeMS ?? 0);
        timeGapDisplay = gapMS >= 0 ? `+${(gapMS / 1000).toFixed(3)}s` : `+0.000s`;
      }
    }
  } else {
    if (isLeader) {
      timeGapDisplay = t('history.classification.leader');
    } else if (driver.bestLapTimeMS < Infinity && leaderBestLapMS < Infinity) {
      const delta = (driver.bestLapTimeMS - leaderBestLapMS) / 1000;
      timeGapDisplay = `+${delta.toFixed(3)}s`;
    }
  }

  // Sector timing for THAT BEST LAP:
  const bestLapS1 = driver.bestLap?.sector1_ms ?? 0;
  const bestLapS2 = driver.bestLap?.sector2_ms ?? 0;
  let bestLapS3 = driver.bestLap?.sector3_ms ?? 0;
  if (bestLapS3 <= 0 && driver.bestLap && driver.bestLap.lap_time_ms > 0 && bestLapS1 > 0 && bestLapS2 > 0) {
    bestLapS3 = driver.bestLap.lap_time_ms - (bestLapS1 + bestLapS2);
  }

  const isS1Purple = bestLapS1 > 0 && sessionBestS1 > 0 && bestLapS1 <= sessionBestS1;
  const isS2Purple = bestLapS2 > 0 && sessionBestS2 > 0 && bestLapS2 <= sessionBestS2;
  const isS3Purple = bestLapS3 > 0 && sessionBestS3 > 0 && bestLapS3 <= sessionBestS3;

  const isS1Green = !isS1Purple && bestLapS1 > 0 && driver.bestS1MS > 0 && bestLapS1 <= driver.bestS1MS;
  const isS2Green = !isS2Purple && bestLapS2 > 0 && driver.bestS2MS > 0 && bestLapS2 <= driver.bestS2MS;
  const isS3Green = !isS3Purple && bestLapS3 > 0 && driver.bestS3MS > 0 && bestLapS3 <= driver.bestS3MS;

  return (
    <React.Fragment>
      {/* Driver Row */}
      <tr
        onClick={() => onToggleDriverExpand(driver.participant.car_index)}
        style={{ cursor: 'pointer' }}
      >
        {/* Position & Grid Delta */}
        <td style={{ paddingLeft: '0.65rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              className="mono"
              style={{
                fontWeight: 700,
                fontSize: '0.85rem',
                color: driver.position === 1 ? '#ffd700' : driver.position <= 3 ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              P{driver.position}
            </span>
            {isRaceSession && driver.positionsGained !== undefined && (
              <span
                className="mono"
                title={t('history.classification.gridTooltip', {
                  grid: driver.gridPosition ?? 0,
                  finish: driver.position,
                  delta: driver.positionsGained > 0 ? `+${driver.positionsGained}` : `${driver.positionsGained}`,
                })}
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color:
                    driver.positionsGained > 0
                      ? '#52c41a'
                      : driver.positionsGained < 0
                      ? '#ff4d4f'
                      : 'var(--text-muted)',
                }}
              >
                {driver.positionsGained > 0
                  ? `▲${driver.positionsGained}`
                  : driver.positionsGained < 0
                  ? `▼${Math.abs(driver.positionsGained)}`
                  : '-'}
              </span>
            )}
          </div>
        </td>

        {/* Driver Name */}
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '3px', height: '20px', backgroundColor: teamColor, borderRadius: '2px', flexShrink: 0 }} />
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{driver.participant.name}</span>
              <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '5px' }}>
                #{driver.participant.race_number}
              </span>
            </div>
          </div>
        </td>

        {isRaceSession ? (
          <>
            {/* Time / Gap */}
            <td
              className="mono"
              style={{
                fontWeight: 700,
                fontSize: '0.82rem',
                whiteSpace: 'nowrap',
                color:
                  driver.isDSQ || driver.isDNF
                    ? '#ff4d4f'
                    : isLeader
                    ? 'var(--accent-primary)'
                    : 'var(--text-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                {isLeader && !driver.isDSQ && !driver.isDNF && <Clock size={11} color="var(--text-muted)" />}
                <span>{timeGapDisplay}</span>
                {(driver.penaltySeconds ?? 0) > 0 && (
                  <span
                    className="mono"
                    title={t('history.classification.penaltyIncluded', { seconds: driver.penaltySeconds ?? 0 })}
                    style={{
                      backgroundColor: 'rgba(255, 77, 79, 0.15)',
                      color: '#ff4d4f',
                      border: '1px solid rgba(255, 77, 79, 0.4)',
                      borderRadius: '3px',
                      padding: '1px 3px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                    }}
                  >
                    +{driver.penaltySeconds}s
                  </span>
                )}
              </div>
            </td>

            {/* Laps */}
            <td className="mono" style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.82rem' }}>
              {driver.laps.length}
            </td>

            {/* Tyre Stints */}
            <td>{renderDriverTyreStints(driver.laps)}</td>

            {/* Points */}
            <td className="mono" style={{ textAlign: 'center', fontSize: '0.82rem' }}>
              {(driver.points ?? 0) > 0 ? (
                <span
                  style={{
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    backgroundColor: 'rgba(255, 215, 0, 0.12)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '3px',
                    padding: '1px 5px',
                    fontSize: '0.72rem',
                  }}
                >
                  {driver.points}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>0</span>
              )}
            </td>

            {/* Fastest Lap of Driver */}
            <td className="mono" style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', color: isOverallFastestLap ? 'var(--accent-purple)' : 'var(--accent-tertiary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {driver.bestLap ? formatLapTime(driver.bestLap.lap_time_ms) : '--:--.---'}
                {isOverallFastestLap && (
                  <span
                    title={t('history.classification.sessionFastestLap')}
                    style={{
                      display: 'inline-flex',
                      padding: '1px 3px',
                      fontSize: '0.6rem',
                      background: 'rgba(176, 38, 255, 0.2)',
                      border: '1px solid rgba(176, 38, 255, 0.4)',
                      color: 'var(--accent-purple)',
                      borderRadius: '3px',
                      fontWeight: 800,
                    }}
                  >
                    {t('history.classification.flBadge')}
                  </span>
                )}
              </div>
            </td>

            {/* S1 of Best Lap */}
            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <span
                className={isS1Purple ? 'sector-purple' : isS1Green ? 'sector-green' : ''}
                style={{ padding: '2px 4px', borderRadius: '3px' }}
              >
                {formatSector(bestLapS1)}
              </span>
            </td>

            {/* S2 of Best Lap */}
            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <span
                className={isS2Purple ? 'sector-purple' : isS2Green ? 'sector-green' : ''}
                style={{ padding: '2px 4px', borderRadius: '3px' }}
              >
                {formatSector(bestLapS2)}
              </span>
            </td>

            {/* S3 of Best Lap */}
            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <span
                className={isS3Purple ? 'sector-purple' : isS3Green ? 'sector-green' : ''}
                style={{ padding: '2px 4px', borderRadius: '3px' }}
              >
                {formatSector(bestLapS3)}
              </span>
            </td>

            {/* Max Speed */}
            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              {driver.maxSpeed ? `${driver.maxSpeed.toFixed(0)} km/h` : '--'}
            </td>
          </>
        ) : (
          <>
            {/* Best Lap */}
            <td className="mono" style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', color: isOverallFastestLap ? 'var(--accent-purple)' : 'var(--accent-tertiary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {driver.bestLap ? formatLapTime(driver.bestLap.lap_time_ms) : '--:--.---'}
                {isOverallFastestLap && (
                  <span
                    title={t('history.classification.poleFastestLap')}
                    style={{
                      display: 'inline-flex',
                      padding: '1px 3px',
                      fontSize: '0.6rem',
                      background: 'rgba(176, 38, 255, 0.2)',
                      border: '1px solid rgba(176, 38, 255, 0.4)',
                      color: 'var(--accent-purple)',
                      borderRadius: '3px',
                      fontWeight: 800,
                    }}
                  >
                    {t('history.classification.flBadge')}
                  </span>
                )}
              </div>
            </td>

            {/* Gap */}
            <td
              className="mono"
              style={{
                fontWeight: 700,
                fontSize: '0.82rem',
                whiteSpace: 'nowrap',
                color: isLeader ? 'var(--accent-primary)' : 'var(--text-primary)',
              }}
            >
              {timeGapDisplay}
            </td>

            {/* S1 of Best Lap */}
            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <span
                className={isS1Purple ? 'sector-purple' : isS1Green ? 'sector-green' : ''}
                style={{ padding: '2px 4px', borderRadius: '3px' }}
              >
                {formatSector(bestLapS1)}
              </span>
            </td>

            {/* S2 of Best Lap */}
            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <span
                className={isS2Purple ? 'sector-purple' : isS2Green ? 'sector-green' : ''}
                style={{ padding: '2px 4px', borderRadius: '3px' }}
              >
                {formatSector(bestLapS2)}
              </span>
            </td>

            {/* S3 of Best Lap */}
            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <span
                className={isS3Purple ? 'sector-purple' : isS3Green ? 'sector-green' : ''}
                style={{ padding: '2px 4px', borderRadius: '3px' }}
              >
                {formatSector(bestLapS3)}
              </span>
            </td>

            {/* Laps */}
            <td className="mono" style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.82rem' }}>
              {driver.laps.length}
            </td>

            {/* Tyre Stints */}
            <td>{renderDriverTyreStints(driver.laps)}</td>

            {/* Max Speed */}
            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              {driver.maxSpeed ? `${driver.maxSpeed.toFixed(0)} km/h` : '--'}
            </td>
          </>
        )}

        {/* Laps / Expand Details button */}
        <td style={{ textAlign: 'right', paddingRight: '0.65rem' }}>
          <button
            className="nav-tab"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDriverExpand(driver.participant.car_index);
            }}
            style={{ padding: '3px 7px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
          >
            {t('history.classification.driverLapsCount', { count: driver.laps.length })} {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </td>
      </tr>

      {/* Expandable Driver Laps Sub-Table */}
      {isExpanded && (
        <tr>
          <td colSpan={11} style={{ background: 'rgba(0, 0, 0, 0.5)', padding: '0.75rem 1rem' }}>
            <DriverLapsSubTable
              session={session}
              driver={driver}
              sessionBestS1={sessionBestS1}
              sessionBestS2={sessionBestS2}
              sessionBestS3={sessionBestS3}
              stagedA={stagedA}
              stagedB={stagedB}
              onStageLap={onStageLap}
              onSendToComparator={onSendToComparator}
              formatLapTime={formatLapTime}
              formatTotalDuration={formatTotalDuration}
              renderTyreBadge={renderTyreBadge}
            />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};
