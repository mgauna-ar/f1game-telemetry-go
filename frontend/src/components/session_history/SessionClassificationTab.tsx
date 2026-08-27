import React, { useMemo } from 'react';
import {
  Trophy,
  Clock,
  ChevronDown,
  ChevronUp,
  Award,
  GitCompare,
} from 'lucide-react';
import { TEAM_COLORS, RESULT_REASONS, RESULT_STATUS } from '../../constants/f1';
import type { Session, Lap, DriverStanding, StagedLap } from '../../types/session';
import { useI18n } from '../../context/I18nContext';

export type { DriverStanding };

interface SessionClassificationTabProps {
  session: Session;
  driverStandings: DriverStanding[];
  isRaceSession: boolean;
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  expandedDrivers: Record<number, boolean>;
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

export const SessionClassificationTab: React.FC<SessionClassificationTabProps> = ({
  session,
  driverStandings,
  isRaceSession,
  sessionBestS1,
  sessionBestS2,
  sessionBestS3,
  expandedDrivers,
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
  const leaderBestLapMS = driverStandings.length > 0 ? driverStandings[0].bestLapTimeMS : Infinity;
  const top3 = driverStandings.slice(0, 3);

  const sessionFastestLapMS = useMemo(() => {
    let fastest = Infinity;
    driverStandings.forEach((d) => {
      if (d.bestLapTimeMS > 0 && d.bestLapTimeMS < fastest) {
        fastest = d.bestLapTimeMS;
      }
    });
    return fastest < Infinity ? fastest : 0;
  }, [driverStandings]);

  const formatSectorTime = (ms: number) => {
    if (!ms || ms <= 0) return '--.---';
    return (ms / 1000).toFixed(3);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* PODIUM SHOWCASE BANNER (Top 3) */}
      {top3.length > 0 && (
        <div className="podium-grid">
          {top3.map((driver) => {
            const teamColor = TEAM_COLORS[driver.participant.team_id] || '#A0A0A0';
            const isP1 = driver.position === 1;
            const isP2 = driver.position === 2;
            const rankClass = isP1 ? 'podium-p1' : isP2 ? 'podium-p2' : 'podium-p3';
            const rankLabel = isP1
              ? t('history.classification.podiumP1')
              : isP2
              ? t('history.classification.podiumP2')
              : t('history.classification.podiumP3');
            const rankColor = isP1 ? '#ffd700' : isP2 ? '#c0c0c0' : '#cd7f32';

            return (
              <div key={driver.participant.car_index} className={`glass-panel podium-card ${rankClass}`}>
                <div className="podium-rank-ribbon" style={{ color: rankColor }}>
                  <Award size={16} />
                  <span>{rankLabel}</span>
                </div>

                <div className="podium-driver-info">
                  <div style={{ width: '4px', height: '32px', backgroundColor: teamColor, borderRadius: '2px' }} />
                  <div>
                    <div className="podium-driver-name">
                      {driver.participant.name}
                      <span className="mono podium-race-num">#{driver.participant.race_number}</span>
                    </div>
                    <div className="podium-driver-sub mono">
                      {isRaceSession
                        ? driver.isDSQ
                          ? 'DSQ'
                          : driver.isDNF
                          ? 'DNF'
                          : formatTotalDuration(driver.totalRaceTimeMS ?? 0)
                        : t('history.classification.bestPrefix', { time: formatLapTime(driver.bestLapTimeMS) })}
                    </div>
                  </div>
                </div>

                <div className="podium-stats-row mono">
                  <div className="podium-stat">
                    <span className="stat-label">{t('history.classification.bestLap')}</span>
                    <span className="stat-value" style={{ color: 'var(--accent-tertiary)' }}>
                      {formatLapTime(driver.bestLapTimeMS)}
                    </span>
                  </div>
                  <div className="podium-stat">
                    <span className="stat-label">{t('history.classification.laps')}</span>
                    <span className="stat-value">{driver.laps.length}</span>
                  </div>
                  <div className="podium-stat">
                    <span className="stat-label">{t('history.classification.maxSpeed')}</span>
                    <span className="stat-value">
                      {driver.maxSpeed ? `${driver.maxSpeed.toFixed(0)} km/h` : '--'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CLASSIFICATION & STANDINGS TABLE */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={20} color="var(--accent-primary)" />
            {isRaceSession ? t('history.classification.raceClassification') : t('history.classification.timingClassification')}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-purple)' }} />
              {t('history.classification.sessionFastestSector')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-tertiary)' }} />
              {t('history.classification.personalBestSector')}
            </span>
          </div>
        </div>

        {driverStandings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            {t('history.classification.noLapData')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="history-table">
              <thead>
                {isRaceSession ? (
                  <tr>
                    <th style={{ width: '55px', paddingLeft: '0.65rem' }}>{t('history.classification.headers.pos')}</th>
                    <th style={{ minWidth: '140px' }}>{t('history.classification.headers.driver')}</th>
                    <th style={{ minWidth: '110px' }}>{t('history.classification.headers.timeGap')}</th>
                    <th style={{ width: '45px', textAlign: 'center' }}>{t('history.classification.headers.laps')}</th>
                    <th style={{ minWidth: '120px' }}>{t('history.classification.headers.tyreStints')}</th>
                    <th style={{ width: '45px', textAlign: 'center' }}>{t('history.classification.headers.points')}</th>
                    <th style={{ minWidth: '95px' }}>{t('history.classification.headers.fastestLap')}</th>
                    <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s1')}</th>
                    <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s2')}</th>
                    <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s3')}</th>
                    <th style={{ minWidth: '75px' }}>{t('history.classification.headers.topSpeed')}</th>
                    <th style={{ textAlign: 'right', width: '85px', paddingRight: '0.65rem' }}>{t('history.classification.headers.details')}</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={{ width: '38px', paddingLeft: '0.65rem' }}>{t('history.classification.headers.pos')}</th>
                    <th style={{ minWidth: '140px' }}>{t('history.classification.headers.driver')}</th>
                    <th style={{ minWidth: '95px' }}>{t('history.classification.headers.bestLap')}</th>
                    <th style={{ minWidth: '80px' }}>{t('history.classification.headers.gap')}</th>
                    <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s1')}</th>
                    <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s2')}</th>
                    <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s3')}</th>
                    <th style={{ width: '45px', textAlign: 'center' }}>{t('history.classification.headers.laps')}</th>
                    <th style={{ minWidth: '120px' }}>{t('history.classification.headers.tyreStints')}</th>
                    <th style={{ minWidth: '75px' }}>{t('history.classification.headers.topSpeed')}</th>
                    <th style={{ textAlign: 'right', width: '85px', paddingRight: '0.65rem' }}>{t('history.classification.headers.details')}</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {driverStandings.map((driver) => {
                  const teamColor = TEAM_COLORS[driver.participant.team_id] || '#A0A0A0';
                  const isExpanded = !!expandedDrivers[driver.participant.car_index];
                  const isLeader = driver.position === 1;

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
                    } else if (driverStandings.length > 0) {
                      const leaderLaps = driverStandings[0].laps.length;
                      const driverLapsCount = driver.laps.length;
                      if (leaderLaps > 0 && driverLapsCount < leaderLaps) {
                        const lapDiff = leaderLaps - driverLapsCount;
                        timeGapDisplay = lapDiff === 1
                          ? t('history.classification.lapDiffSingular', { count: lapDiff })
                          : t('history.classification.lapDiffPlural', { count: lapDiff });
                      } else if ((driver.totalRaceTimeWithPenalties ?? 0) > 0 && (driverStandings[0].totalRaceTimeWithPenalties ?? 0) > 0) {
                        const gapMS = (driver.totalRaceTimeWithPenalties ?? 0) - (driverStandings[0].totalRaceTimeWithPenalties ?? 0);
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
                    <React.Fragment key={driver.participant.car_index}>
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
                                {formatSectorTime(bestLapS1)}
                              </span>
                            </td>

                            {/* S2 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              <span
                                className={isS2Purple ? 'sector-purple' : isS2Green ? 'sector-green' : ''}
                                style={{ padding: '2px 4px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS2)}
                              </span>
                            </td>

                            {/* S3 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              <span
                                className={isS3Purple ? 'sector-purple' : isS3Green ? 'sector-green' : ''}
                                style={{ padding: '2px 4px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS3)}
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
                                {formatSectorTime(bestLapS1)}
                              </span>
                            </td>

                            {/* S2 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              <span
                                className={isS2Purple ? 'sector-purple' : isS2Green ? 'sector-green' : ''}
                                style={{ padding: '2px 4px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS2)}
                              </span>
                            </td>

                            {/* S3 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              <span
                                className={isS3Purple ? 'sector-purple' : isS3Green ? 'sector-green' : ''}
                                style={{ padding: '2px 4px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS3)}
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
                                  {(() => {
                                    let runningRaceTime = 0;
                                    return driver.laps.filter((lap) => lap.lap_time_ms > 0).map((lap) => {
                                      runningRaceTime += lap.lap_time_ms;

                                      const isPB = driver.bestLap && lap.id === driver.bestLap.id;
                                      const lapDeltaToBest = driver.bestLap && lap.lap_time_ms > 0
                                        ? isPB
                                          ? t('history.classification.personalBest')
                                          : `+${((lap.lap_time_ms - driver.bestLap.lap_time_ms) / 1000).toFixed(3)}s`
                                        : '--';

                                      const s1 = lap.sector1_ms ?? 0;
                                      const s2 = lap.sector2_ms ?? 0;
                                      let s3 = lap.sector3_ms ?? 0;
                                      if (s3 <= 0 && lap.lap_time_ms > 0 && s1 > 0 && s2 > 0) {
                                        s3 = lap.lap_time_ms - (s1 + s2);
                                      }

                                      const s1Purple = s1 > 0 && sessionBestS1 > 0 && s1 <= sessionBestS1;
                                      const s2Purple = s2 > 0 && sessionBestS2 > 0 && s2 <= sessionBestS2;
                                      const s3Purple = s3 > 0 && sessionBestS3 > 0 && s3 <= sessionBestS3;

                                      const s1Green = !s1Purple && s1 > 0 && s1 <= driver.bestS1MS;
                                      const s2Green = !s2Purple && s2 > 0 && s2 <= driver.bestS2MS;
                                      const s3Green = !s3Purple && s3 > 0 && s3 <= driver.bestS3MS;

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
                                              {formatSectorTime(s1)}
                                            </span>
                                          </td>
                                          <td className="mono" style={{ padding: '6px 8px' }}>
                                            <span className={s2Purple ? 'sector-purple' : s2Green ? 'sector-green' : ''}>
                                              {formatSectorTime(s2)}
                                            </span>
                                          </td>
                                          <td className="mono" style={{ padding: '6px 8px' }}>
                                            <span className={s3Purple ? 'sector-purple' : s3Green ? 'sector-green' : ''}>
                                              {formatSectorTime(s3)}
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
                                                {(() => {
                                                  const isStagedA = stagedA?.lapId === lap.id;
                                                  const isStagedB = stagedB?.lapId === lap.id;

                                                  return (
                                                    <>
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
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
