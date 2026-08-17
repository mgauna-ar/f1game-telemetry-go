import React, { useMemo } from 'react';
import {
  Trophy,
  Clock,
  ChevronDown,
  ChevronUp,
  Award,
  GitCompare,
} from 'lucide-react';
import { TEAM_COLORS } from '../LeaderboardTower';
import type { Session, Participant, Lap, CarSetup } from '../SessionHistory';

export interface DriverStanding {
  position: number;
  participant: Participant;
  laps: Lap[];
  bestLap: Lap | null;
  bestLapTimeMS: number;
  lastLap: Lap | null;
  lastLapTimeMS: number;
  totalRaceTimeMS: number;
  penaltySeconds: number;
  totalRaceTimeWithPenalties: number;
  officialPos: number;
  isDNF: boolean;
  isDSQ: boolean;
  maxSpeed: number;
  setup?: CarSetup;
  bestS1MS: number;
  bestS2MS: number;
  bestS3MS: number;
  theoreticalBestMS: number;
}

import type { StagedLap } from './SessionComparatorDock';

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
  renderTyreBadge: (compoundRaw?: string) => React.ReactNode;
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
            const rankLabel = isP1 ? 'P1 • WINNER' : isP2 ? 'P2 • SECOND' : 'P3 • THIRD';
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
                          : formatTotalDuration(driver.totalRaceTimeMS)
                        : `Best: ${formatLapTime(driver.bestLapTimeMS)}`}
                    </div>
                  </div>
                </div>

                <div className="podium-stats-row mono">
                  <div className="podium-stat">
                    <span className="stat-label">BEST LAP</span>
                    <span className="stat-value" style={{ color: 'var(--accent-tertiary)' }}>
                      {formatLapTime(driver.bestLapTimeMS)}
                    </span>
                  </div>
                  <div className="podium-stat">
                    <span className="stat-label">LAPS</span>
                    <span className="stat-value">{driver.laps.length}</span>
                  </div>
                  <div className="podium-stat">
                    <span className="stat-label">MAX SPEED</span>
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
            {isRaceSession ? 'Official Race Classification' : 'Session Classification & Timing'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-purple)' }} />
              Session Fastest Sector
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-tertiary)' }} />
              Personal Best Sector
            </span>
          </div>
        </div>

        {driverStandings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No lap timing data recorded for this session.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="history-table">
              <thead>
                {isRaceSession ? (
                  <tr>
                    <th style={{ width: '45px' }}>POS</th>
                    <th>DRIVER</th>
                    <th>TIME / GAP</th>
                    <th>LAPS</th>
                    <th>TYRE STINTS</th>
                    <th>FASTEST LAP</th>
                    <th>S1</th>
                    <th>S2</th>
                    <th>S3</th>
                    <th>TOP SPEED</th>
                    <th style={{ textAlign: 'right' }}>DETAILS</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={{ width: '45px' }}>POS</th>
                    <th>DRIVER</th>
                    <th>BEST LAP</th>
                    <th>GAP</th>
                    <th>S1</th>
                    <th>S2</th>
                    <th>S3</th>
                    <th>LAPS</th>
                    <th>TYRE STINTS</th>
                    <th>TOP SPEED</th>
                    <th style={{ textAlign: 'right' }}>DETAILS</th>
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

                  // Time / Gap formatted string
                  let timeGapDisplay = '--';
                  if (isRaceSession) {
                    if (driver.isDSQ) {
                      timeGapDisplay = 'DSQ';
                    } else if (driver.isDNF) {
                      timeGapDisplay = 'DNF';
                    } else if (isLeader) {
                      timeGapDisplay = formatTotalDuration(driver.totalRaceTimeWithPenalties);
                    } else if (driverStandings.length > 0) {
                      const leaderLaps = driverStandings[0].laps.length;
                      const driverLapsCount = driver.laps.length;
                      if (leaderLaps > 0 && driverLapsCount < leaderLaps) {
                        const lapDiff = leaderLaps - driverLapsCount;
                        timeGapDisplay = `+${lapDiff} ${lapDiff === 1 ? 'Lap' : 'Laps'}`;
                      } else if (driver.totalRaceTimeWithPenalties > 0 && driverStandings[0].totalRaceTimeWithPenalties > 0) {
                        const gapMS = driver.totalRaceTimeWithPenalties - driverStandings[0].totalRaceTimeWithPenalties;
                        timeGapDisplay = gapMS >= 0 ? `+${(gapMS / 1000).toFixed(3)}s` : `+0.000s`;
                      }
                    }
                  } else {
                    if (isLeader) {
                      timeGapDisplay = 'LEADER';
                    } else if (driver.bestLapTimeMS < Infinity && leaderBestLapMS < Infinity) {
                      const delta = (driver.bestLapTimeMS - leaderBestLapMS) / 1000;
                      timeGapDisplay = `+${delta.toFixed(3)}s`;
                    }
                  }

                  // Sector timing for THAT BEST LAP:
                  const bestLapS1 = driver.bestLap ? driver.bestLap.sector1_ms : 0;
                  const bestLapS2 = driver.bestLap ? driver.bestLap.sector2_ms : 0;
                  const bestLapS3 = driver.bestLap ? driver.bestLap.sector3_ms : 0;

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
                        {/* Position */}
                        <td>
                          <div
                            className="mono"
                            style={{
                              fontWeight: 700,
                              color: driver.position === 1 ? '#ffd700' : driver.position <= 3 ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            }}
                          >
                            P{driver.position}
                          </div>
                        </td>

                        {/* Driver Name */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '4px', height: '22px', backgroundColor: teamColor, borderRadius: '2px' }} />
                            <div>
                              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {driver.participant.name}
                                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  #{driver.participant.race_number}
                                </span>
                              </div>
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
                                color:
                                  driver.isDSQ || driver.isDNF
                                    ? '#ff4d4f'
                                    : isLeader
                                    ? 'var(--accent-primary)'
                                    : 'var(--text-primary)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isLeader && !driver.isDSQ && !driver.isDNF && <Clock size={12} color="var(--text-muted)" />}
                                <span>{timeGapDisplay}</span>
                                {driver.penaltySeconds > 0 && (
                                  <span
                                    className="mono"
                                    title={`${driver.penaltySeconds}s Penalty Included`}
                                    style={{
                                      backgroundColor: 'rgba(255, 77, 79, 0.15)',
                                      color: '#ff4d4f',
                                      border: '1px solid rgba(255, 77, 79, 0.4)',
                                      borderRadius: '3px',
                                      padding: '1px 4px',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                    }}
                                  >
                                    +{driver.penaltySeconds}s
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Laps */}
                            <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                              {driver.laps.length}
                            </td>

                            {/* Tyre Stints */}
                            <td>{renderDriverTyreStints(driver.laps)}</td>

                            {/* Fastest Lap of Driver */}
                            <td className="mono" style={{ fontWeight: 700, color: isOverallFastestLap ? 'var(--accent-purple)' : 'var(--accent-tertiary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {driver.bestLap ? formatLapTime(driver.bestLap.lap_time_ms) : '--:--.---'}
                                {isOverallFastestLap && (
                                  <span
                                    title="Session Fastest Lap"
                                    style={{
                                      display: 'inline-flex',
                                      padding: '1px 4px',
                                      fontSize: '0.65rem',
                                      background: 'rgba(176, 38, 255, 0.2)',
                                      border: '1px solid rgba(176, 38, 255, 0.4)',
                                      color: 'var(--accent-purple)',
                                      borderRadius: '3px',
                                      fontWeight: 800,
                                    }}
                                  >
                                    FL
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* S1 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.85rem' }}>
                              <span
                                className={isS1Purple ? 'sector-purple' : isS1Green ? 'sector-green' : ''}
                                style={{ padding: '2px 5px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS1)}
                              </span>
                            </td>

                            {/* S2 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.85rem' }}>
                              <span
                                className={isS2Purple ? 'sector-purple' : isS2Green ? 'sector-green' : ''}
                                style={{ padding: '2px 5px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS2)}
                              </span>
                            </td>

                            {/* S3 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.85rem' }}>
                              <span
                                className={isS3Purple ? 'sector-purple' : isS3Green ? 'sector-green' : ''}
                                style={{ padding: '2px 5px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS3)}
                              </span>
                            </td>

                            {/* Max Speed */}
                            <td className="mono">
                              {driver.maxSpeed ? `${driver.maxSpeed.toFixed(1)} km/h` : '-- km/h'}
                            </td>
                          </>
                        ) : (
                          <>
                            {/* Best Lap */}
                            <td className="mono" style={{ fontWeight: 700, color: isOverallFastestLap ? 'var(--accent-purple)' : 'var(--accent-tertiary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {driver.bestLap ? formatLapTime(driver.bestLap.lap_time_ms) : '--:--.---'}
                                {isOverallFastestLap && (
                                  <span
                                    title="Pole / Session Fastest Lap"
                                    style={{
                                      display: 'inline-flex',
                                      padding: '1px 4px',
                                      fontSize: '0.65rem',
                                      background: 'rgba(176, 38, 255, 0.2)',
                                      border: '1px solid rgba(176, 38, 255, 0.4)',
                                      color: 'var(--accent-purple)',
                                      borderRadius: '3px',
                                      fontWeight: 800,
                                    }}
                                  >
                                    FL
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Gap */}
                            <td
                              className="mono"
                              style={{
                                fontWeight: 700,
                                color: isLeader ? 'var(--accent-primary)' : 'var(--text-primary)',
                              }}
                            >
                              {timeGapDisplay}
                            </td>

                            {/* S1 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.85rem' }}>
                              <span
                                className={isS1Purple ? 'sector-purple' : isS1Green ? 'sector-green' : ''}
                                style={{ padding: '2px 5px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS1)}
                              </span>
                            </td>

                            {/* S2 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.85rem' }}>
                              <span
                                className={isS2Purple ? 'sector-purple' : isS2Green ? 'sector-green' : ''}
                                style={{ padding: '2px 5px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS2)}
                              </span>
                            </td>

                            {/* S3 of Best Lap */}
                            <td className="mono" style={{ fontSize: '0.85rem' }}>
                              <span
                                className={isS3Purple ? 'sector-purple' : isS3Green ? 'sector-green' : ''}
                                style={{ padding: '2px 5px', borderRadius: '3px' }}
                              >
                                {formatSectorTime(bestLapS3)}
                              </span>
                            </td>

                            {/* Laps */}
                            <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                              {driver.laps.length}
                            </td>

                            {/* Tyre Stints */}
                            <td>{renderDriverTyreStints(driver.laps)}</td>

                            {/* Max Speed */}
                            <td className="mono">
                              {driver.maxSpeed ? `${driver.maxSpeed.toFixed(1)} km/h` : '-- km/h'}
                            </td>
                          </>
                        )}

                        {/* Laps / Expand Details button */}
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="nav-tab"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleDriverExpand(driver.participant.car_index);
                            }}
                            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {driver.laps.length} Laps {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
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
                                  <Clock size={14} /> Recorded Laps for {driver.participant.name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Use 'Slot A' or 'Slot B' to compare telemetry curves in Lap Comparator
                                </div>
                              </div>
                              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '5px 8px' }}>Lap #</th>
                                    <th style={{ padding: '5px 8px' }}>Lap Time</th>
                                    <th style={{ padding: '5px 8px' }}>Sector 1</th>
                                    <th style={{ padding: '5px 8px' }}>Sector 2</th>
                                    <th style={{ padding: '5px 8px' }}>Sector 3</th>
                                    <th style={{ padding: '5px 8px' }}>Cumulative</th>
                                    <th style={{ padding: '5px 8px' }}>Delta to Best</th>
                                    <th style={{ padding: '5px 8px' }}>Max Speed</th>
                                    <th style={{ padding: '5px 8px' }}>Tyre</th>
                                    <th style={{ padding: '5px 8px' }}>Status</th>
                                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Compare Telemetry</th>
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
                                          ? 'PERSONAL BEST'
                                          : `+${((lap.lap_time_ms - driver.bestLap.lap_time_ms) / 1000).toFixed(3)}s`
                                        : '--';

                                      const s1Purple = lap.sector1_ms > 0 && sessionBestS1 > 0 && lap.sector1_ms <= sessionBestS1;
                                      const s2Purple = lap.sector2_ms > 0 && sessionBestS2 > 0 && lap.sector2_ms <= sessionBestS2;
                                      const s3Purple = lap.sector3_ms > 0 && sessionBestS3 > 0 && lap.sector3_ms <= sessionBestS3;

                                      const s1Green = !s1Purple && lap.sector1_ms > 0 && lap.sector1_ms <= driver.bestS1MS;
                                      const s2Green = !s2Purple && lap.sector2_ms > 0 && lap.sector2_ms <= driver.bestS2MS;
                                      const s3Green = !s3Purple && lap.sector3_ms > 0 && lap.sector3_ms <= driver.bestS3MS;

                                      return (
                                        <tr key={lap.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                          <td className="mono" style={{ padding: '6px 8px', fontWeight: 700 }}>
                                            Lap {lap.lap_number}
                                          </td>
                                          <td className="mono" style={{ padding: '6px 8px', color: isPB ? 'var(--accent-tertiary)' : 'inherit', fontWeight: isPB ? 700 : 500 }}>
                                            {formatLapTime(lap.lap_time_ms)}
                                          </td>
                                          <td className="mono" style={{ padding: '6px 8px' }}>
                                            <span className={s1Purple ? 'sector-purple' : s1Green ? 'sector-green' : ''}>
                                              {formatSectorTime(lap.sector1_ms)}
                                            </span>
                                          </td>
                                          <td className="mono" style={{ padding: '6px 8px' }}>
                                            <span className={s2Purple ? 'sector-purple' : s2Green ? 'sector-green' : ''}>
                                              {formatSectorTime(lap.sector2_ms)}
                                            </span>
                                          </td>
                                          <td className="mono" style={{ padding: '6px 8px' }}>
                                            <span className={s3Purple ? 'sector-purple' : s3Green ? 'sector-green' : ''}>
                                              {formatSectorTime(lap.sector3_ms)}
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
                                            {renderTyreBadge(lap.tyre_compound)}
                                          </td>
                                          <td style={{ padding: '6px 8px' }}>
                                            <span className={`session-badge ${lap.is_valid ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
                                              {lap.is_valid ? 'VALID' : 'INVALID'}
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
                                                        title={isStagedA ? 'Staged in Slot A (Click to unstage)' : `Stage Lap ${lap.lap_number} into Lap Comparator Slot A`}
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
                                                        <GitCompare size={11} /> {isStagedA ? '✓ Slot A' : 'Slot A'}
                                                      </button>

                                                      <button
                                                        className={`nav-tab ${isStagedB ? 'active' : ''}`}
                                                        title={isStagedB ? 'Staged in Slot B (Click to unstage)' : `Stage Lap ${lap.lap_number} into Lap Comparator Slot B`}
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
                                                        <GitCompare size={11} /> {isStagedB ? '✓ Slot B' : 'Slot B'}
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
