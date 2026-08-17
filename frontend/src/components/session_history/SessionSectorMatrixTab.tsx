import React, { useState, useMemo } from 'react';
import { Zap, Gauge, Award, Layers } from 'lucide-react';
import { TEAM_COLORS } from '../LeaderboardTower';
import type { DriverStanding } from './SessionClassificationTab';

interface SessionSectorMatrixTabProps {
  driverStandings: DriverStanding[];
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  formatLapTime: (ms: number) => string;
}

export const SessionSectorMatrixTab: React.FC<SessionSectorMatrixTabProps> = ({
  driverStandings,
  sessionBestS1,
  sessionBestS2,
  sessionBestS3,
  formatLapTime,
}) => {
  const [sectorView, setSectorView] = useState<'ALL' | 'S1' | 'S2' | 'S3'>('ALL');

  const formatSectorTime = (ms: number) => {
    if (!ms || ms <= 0) return '--.---';
    return (ms / 1000).toFixed(3);
  };

  // Find which driver holds each purple sector
  const s1Holder: DriverStanding | null = useMemo(() => {
    return driverStandings.find((d) => d.bestS1MS > 0 && d.bestS1MS === sessionBestS1) || null;
  }, [driverStandings, sessionBestS1]);

  const s2Holder: DriverStanding | null = useMemo(() => {
    return driverStandings.find((d) => d.bestS2MS > 0 && d.bestS2MS === sessionBestS2) || null;
  }, [driverStandings, sessionBestS2]);

  const s3Holder: DriverStanding | null = useMemo(() => {
    return driverStandings.find((d) => d.bestS3MS > 0 && d.bestS3MS === sessionBestS3) || null;
  }, [driverStandings, sessionBestS3]);

  // Absolute theoretical best lap of the entire session
  const ultimateSessionLapMS =
    sessionBestS1 > 0 && sessionBestS2 > 0 && sessionBestS3 > 0
      ? sessionBestS1 + sessionBestS2 + sessionBestS3
      : 0;

  // Actual best lap of the session
  const actualSessionBestLap = useMemo<{ bestMS: number; driver: DriverStanding | null }>(() => {
    let best = Infinity;
    let holder: DriverStanding | null = null;
    driverStandings.forEach((d) => {
      if (d.bestLapTimeMS > 0 && d.bestLapTimeMS < best) {
        best = d.bestLapTimeMS;
        holder = d;
      }
    });
    return { bestMS: best < Infinity ? best : 0, driver: holder };
  }, [driverStandings]);

  const ultimateDeltaMS =
    actualSessionBestLap.bestMS > 0 && ultimateSessionLapMS > 0
      ? actualSessionBestLap.bestMS - ultimateSessionLapMS
      : 0;

  // Speed Trap Rankings
  const speedRankings = useMemo(() => {
    return [...driverStandings]
      .filter((d) => d.maxSpeed > 0)
      .sort((a, b) => b.maxSpeed - a.maxSpeed);
  }, [driverStandings]);

  const maxOverallSpeed = speedRankings.length > 0 ? speedRankings[0].maxSpeed : 350;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. ULTIMATE THEORETICAL LAP HERO CARD */}
      <div className="glass-panel" style={{ padding: '1.5rem', background: 'radial-gradient(ellipse at 80% 20%, rgba(176, 38, 255, 0.15), transparent 60%), var(--bg-glass)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
              <Zap size={18} />
              <span>SESSION ULTIMATE THEORETICAL LAP</span>
            </div>
            <div className="mono" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {ultimateSessionLapMS > 0 ? formatLapTime(ultimateSessionLapMS) : '--:--.---'}
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
              Combined fastest individual sectors set across all drivers in this session.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div className="header-stat-box" style={{ minWidth: '150px' }}>
              <Award size={18} color="var(--accent-tertiary)" />
              <div>
                <div className="stat-label">ACTUAL FASTEST LAP</div>
                <div className="stat-value mono" style={{ fontSize: '1.1rem', color: 'var(--accent-tertiary)' }}>
                  {actualSessionBestLap.bestMS > 0 ? formatLapTime(actualSessionBestLap.bestMS) : '--:--.---'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {actualSessionBestLap.driver?.participant.name || 'Unknown'}
                </div>
              </div>
            </div>

            <div className="header-stat-box" style={{ minWidth: '150px' }}>
              <Layers size={18} color="var(--accent-secondary)" />
              <div>
                <div className="stat-label">THEORETICAL DELTA</div>
                <div className="stat-value mono" style={{ fontSize: '1.1rem', color: '#00f2fe' }}>
                  {ultimateDeltaMS > 0 ? `-${(ultimateDeltaMS / 1000).toFixed(3)}s` : '0.000s'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Potential improvement
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sector Component Breakdown Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          {/* Sector 1 Record */}
          <div className="glass-panel" style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(176, 38, 255, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-purple)' }}>SECTOR 1 RECORD</span>
              <span className="mono sector-purple" style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                {formatSectorTime(sessionBestS1)}
              </span>
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: TEAM_COLORS[s1Holder?.participant.team_id || 0] || '#A0A0A0' }} />
              <span>{s1Holder?.participant.name || 'Unknown'}</span>
            </div>
          </div>

          {/* Sector 2 Record */}
          <div className="glass-panel" style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(176, 38, 255, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-purple)' }}>SECTOR 2 RECORD</span>
              <span className="mono sector-purple" style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                {formatSectorTime(sessionBestS2)}
              </span>
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: TEAM_COLORS[s2Holder?.participant.team_id || 0] || '#A0A0A0' }} />
              <span>{s2Holder?.participant.name || 'Unknown'}</span>
            </div>
          </div>

          {/* Sector 3 Record */}
          <div className="glass-panel" style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(176, 38, 255, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-purple)' }}>SECTOR 3 RECORD</span>
              <span className="mono sector-purple" style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                {formatSectorTime(sessionBestS3)}
              </span>
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: TEAM_COLORS[s3Holder?.participant.team_id || 0] || '#A0A0A0' }} />
              <span>{s3Holder?.participant.name || 'Unknown'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECTOR LEADERBOARD & SPEED TRAP GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Sector Leaderboards */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="var(--accent-purple)" /> Sector Leaderboards
            </h4>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className={`nav-tab ${sectorView === 'ALL' ? 'active' : ''}`}
                onClick={() => setSectorView('ALL')}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                All Sectors
              </button>
              <button
                className={`nav-tab ${sectorView === 'S1' ? 'active' : ''}`}
                onClick={() => setSectorView('S1')}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                S1
              </button>
              <button
                className={`nav-tab ${sectorView === 'S2' ? 'active' : ''}`}
                onClick={() => setSectorView('S2')}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                S2
              </button>
              <button
                className={`nav-tab ${sectorView === 'S3' ? 'active' : ''}`}
                onClick={() => setSectorView('S3')}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                S3
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
            <table className="history-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>POS</th>
                  <th>DRIVER</th>
                  {(sectorView === 'ALL' || sectorView === 'S1') && <th>BEST S1</th>}
                  {(sectorView === 'ALL' || sectorView === 'S2') && <th>BEST S2</th>}
                  {(sectorView === 'ALL' || sectorView === 'S3') && <th>BEST S3</th>}
                </tr>
              </thead>
              <tbody>
                {driverStandings.map((driver, idx) => {
                  const teamColor = TEAM_COLORS[driver.participant.team_id] || '#A0A0A0';
                  const s1Delta = driver.bestS1MS > 0 && sessionBestS1 > 0 ? (driver.bestS1MS - sessionBestS1) / 1000 : 0;
                  const s2Delta = driver.bestS2MS > 0 && sessionBestS2 > 0 ? (driver.bestS2MS - sessionBestS2) / 1000 : 0;
                  const s3Delta = driver.bestS3MS > 0 && sessionBestS3 > 0 ? (driver.bestS3MS - sessionBestS3) / 1000 : 0;

                  return (
                    <tr key={driver.participant.car_index}>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        P{idx + 1}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '3px', height: '16px', backgroundColor: teamColor, borderRadius: '2px' }} />
                          <span style={{ fontWeight: 600 }}>{driver.participant.name}</span>
                        </div>
                      </td>

                      {(sectorView === 'ALL' || sectorView === 'S1') && (
                        <td className="mono">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className={s1Delta === 0 && driver.bestS1MS > 0 ? 'sector-purple' : 'sector-green'}>
                              {formatSectorTime(driver.bestS1MS)}
                            </span>
                            {s1Delta > 0 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                +{s1Delta.toFixed(3)}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {(sectorView === 'ALL' || sectorView === 'S2') && (
                        <td className="mono">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className={s2Delta === 0 && driver.bestS2MS > 0 ? 'sector-purple' : 'sector-green'}>
                              {formatSectorTime(driver.bestS2MS)}
                            </span>
                            {s2Delta > 0 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                +{s2Delta.toFixed(3)}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {(sectorView === 'ALL' || sectorView === 'S3') && (
                        <td className="mono">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className={s3Delta === 0 && driver.bestS3MS > 0 ? 'sector-purple' : 'sector-green'}>
                              {formatSectorTime(driver.bestS3MS)}
                            </span>
                            {s3Delta > 0 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                +{s3Delta.toFixed(3)}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Speed Trap & Top Speed Leaderboard */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Gauge size={18} color="var(--accent-secondary)" /> Speed Trap & Maximum Speeds
            </h4>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              HIGHEST: {maxOverallSpeed ? `${maxOverallSpeed.toFixed(1)} km/h` : '--'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {speedRankings.map((driver, rankIdx) => {
              const teamColor = TEAM_COLORS[driver.participant.team_id] || '#00f2fe';
              const speed = driver.maxSpeed;
              const speedRatio = maxOverallSpeed > 0 ? (speed / maxOverallSpeed) * 100 : 0;
              const deltaToTop = maxOverallSpeed > 0 ? maxOverallSpeed - speed : 0;

              return (
                <div
                  key={driver.participant.car_index}
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mono" style={{ fontWeight: 700, color: rankIdx === 0 ? '#ffd700' : 'var(--text-muted)', fontSize: '0.8rem', width: '24px' }}>
                        P{rankIdx + 1}
                      </span>
                      <span style={{ width: '3px', height: '14px', backgroundColor: teamColor, borderRadius: '2px' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{driver.participant.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {deltaToTop > 0 && (
                        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          -{deltaToTop.toFixed(1)} km/h
                        </span>
                      )}
                      <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: rankIdx === 0 ? 'var(--accent-secondary)' : 'var(--text-primary)' }}>
                        {speed.toFixed(1)} km/h
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Speed Bar */}
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(10, speedRatio)}%`,
                        height: '100%',
                        backgroundColor: teamColor,
                        borderRadius: '2px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
