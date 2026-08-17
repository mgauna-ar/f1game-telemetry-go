import React from 'react';
import { Trophy, Wrench, Flame } from 'lucide-react';
import { parseDriverName } from '../hooks/useTelemetry';
import type { ParticipantData, LapData, CarStatusData, SessionData } from '../types/telemetry';
import { TEAM_COLORS, TYRE_COMPOUNDS } from '../constants/f1';

export { TEAM_COLORS, TYRE_COMPOUNDS };

interface LeaderboardTowerProps {
  session: SessionData | null;
  participants: ParticipantData[];
  laps: LapData[];
  carStatuses: CarStatusData[];
  playerCarIndex: number;
  selectedCarIndex: number;
  onSelectCar: (index: number) => void;
}

interface ProcessedDriver {
  carIndex: number;
  position: number;
  gridPosition: number;
  name: string;
  raceNumber: number;
  teamId: number;
  aiControlled: boolean;
  lap: LapData | undefined;
  carStatus: CarStatusData | undefined;
  isPlayer: boolean;
}

export const LeaderboardTower: React.FC<LeaderboardTowerProps> = ({
  session = null,
  participants = [],
  laps = [],
  carStatuses = [],
  playerCarIndex = 0,
  selectedCarIndex = 0,
  onSelectCar = () => {},
}) => {
  const isQualy = session?.SessionType !== undefined && 
    ((session.SessionType >= 5 && session.SessionType <= 9) || (session.SessionType >= 10 && session.SessionType <= 14));
  const isQ1 = session?.SessionType === 5 || session?.SessionType === 10;
  const isQ2 = session?.SessionType === 6 || session?.SessionType === 11;

  // Position flash animations on position changes
  const prevPosMapRef = React.useRef<Record<number, number>>({});
  const [posFlashMap, setPosFlashMap] = React.useState<Record<number, 'up' | 'down'>>({});

  // Track best lap times per car during qualifying session
  const bestLapTimesRef = React.useRef<Record<number, number>>({});
  const lastSessionKeyRef = React.useRef<string | number | null>(null);

  const sessionKey = `${session?.SessionType}_${session?.TrackId}`;
  if (lastSessionKeyRef.current !== sessionKey) {
    bestLapTimesRef.current = {};
    lastSessionKeyRef.current = sessionKey;
  }

  laps.forEach((lap, idx) => {
    if (lap && lap.LastLapTimeInMS > 0) {
      const currentBest = bestLapTimesRef.current[idx] || 0;
      if (currentBest === 0 || lap.LastLapTimeInMS < currentBest) {
        bestLapTimesRef.current[idx] = lap.LastLapTimeInMS;
      }
    }
  });

  // Build unified driver entries
  const drivers: ProcessedDriver[] = participants.map((p, idx) => {
    const lap = laps[idx];
    const carStatus = carStatuses[idx];
    const rawName = p.Name;
    const defaultName = p.RaceNumber ? `Driver #${p.RaceNumber}` : `Car #${idx + 1}`;
    const name = parseDriverName(rawName, defaultName, p.DriverId);

    return {
      carIndex: idx,
      position: lap?.CarPosition || idx + 1,
      gridPosition: lap?.GridPosition || 0,
      name,
      raceNumber: p.RaceNumber || idx + 1,
      teamId: p.TeamId,
      aiControlled: p.AIControlled === 1,
      lap,
      carStatus,
      isPlayer: idx === playerCarIndex,
    };
  });

  // Fallback synthetic drivers if array is empty
  const displayDrivers: ProcessedDriver[] = drivers.length > 0 ? drivers : [
    { carIndex: 0, position: laps[0]?.CarPosition || 1, gridPosition: laps[0]?.GridPosition || 1, name: 'Player Car', raceNumber: 1, teamId: 0, aiControlled: false, lap: laps[0], carStatus: carStatuses[0], isPlayer: true }
  ];

  // Sort drivers
  if (isQualy) {
    displayDrivers.sort((a, b) => {
      const timeA = bestLapTimesRef.current[a.carIndex] || (a.lap?.LastLapTimeInMS || 0);
      const timeB = bestLapTimesRef.current[b.carIndex] || (b.lap?.LastLapTimeInMS || 0);

      if (timeA > 0 && timeB > 0) {
        if (timeA !== timeB) return timeA - timeB;
        return a.carIndex - b.carIndex;
      }
      if (timeA > 0 && timeB === 0) return -1;
      if (timeA === 0 && timeB > 0) return 1;

      return a.carIndex - b.carIndex;
    });

    displayDrivers.forEach((d, idx) => {
      d.position = idx + 1;
    });
  } else {
    displayDrivers.sort((a, b) => a.position - b.position);
  }

  // Detect position updates for flash animations
  React.useEffect(() => {
    const newFlash: Record<number, 'up' | 'down'> = {};
    let hasChanges = false;

    displayDrivers.forEach(d => {
      const prevPos = prevPosMapRef.current[d.carIndex];
      if (prevPos !== undefined && prevPos !== d.position) {
        newFlash[d.carIndex] = d.position < prevPos ? 'up' : 'down';
        hasChanges = true;
      }
      prevPosMapRef.current[d.carIndex] = d.position;
    });

    if (hasChanges) {
      setPosFlashMap(prev => ({ ...prev, ...newFlash }));
      const timer = setTimeout(() => {
        setPosFlashMap({});
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [displayDrivers]);

  // Find Pole Position lap time in Qualifying
  const p1CarIndex = displayDrivers[0]?.carIndex;
  const p1BestLap = isQualy && p1CarIndex !== undefined ? (bestLapTimesRef.current[p1CarIndex] || displayDrivers[0]?.lap?.LastLapTimeInMS || 0) : 0;
  const poleTimeMs = isQualy && p1BestLap > 0 ? p1BestLap : 0;

  const formatTime = (ms?: number) => {
    if (!ms || ms <= 0) return 'NO TIME';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const formatQualyDelta = (driverMs?: number) => {
    if (!driverMs || driverMs <= 0) return '';
    if (!poleTimeMs || driverMs === poleTimeMs) return 'POLE';
    const delta = (driverMs - poleTimeMs) / 1000;
    return `+${delta.toFixed(3)}s`;
  };

  const formatDelta = (msPart?: number, minsPart?: number) => {
    if (msPart === undefined && minsPart === undefined) return '--';
    const totalMs = (minsPart || 0) * 60000 + (msPart || 0);
    if (totalMs === 0) return 'LEADER';
    return `+${(totalMs / 1000).toFixed(3)}s`;
  };

  const getGridDeltaBadge = (gridPos?: number, curPos?: number) => {
    if (!gridPos || !curPos || gridPos === 0) return null;
    const delta = gridPos - curPos; // > 0 means gained positions (e.g. started P5, now P2 -> +3)
    if (delta > 0) {
      return <span className="grid-delta-badge delta-gain" title={`Parrilla: P${gridPos} -> Ahora: P${curPos}`}>▲{delta}</span>;
    } else if (delta < 0) {
      return <span className="grid-delta-badge delta-loss" title={`Parrilla: P${gridPos} -> Ahora: P${curPos}`}>▼{Math.abs(delta)}</span>;
    } else {
      return <span className="grid-delta-badge delta-same" title={`Parrilla: P${gridPos}`}>=</span>;
    }
  };

  const getPenaltyBadge = (lap?: LapData) => {
    if (!lap) return null;
    const elements: React.ReactNode[] = [];

    if (lap.NumUnservedStopGoPens && lap.NumUnservedStopGoPens > 0) {
      elements.push(
        <span key="sg" className="driver-penalty-badge penalty-stopgo" title="Stop & Go Penalty">
          SG
        </span>
      );
    } else if (lap.NumUnservedDriveThroughPens && lap.NumUnservedDriveThroughPens > 0) {
      elements.push(
        <span key="dt" className="driver-penalty-badge penalty-drivethrough" title="Drive Through Penalty">
          DT
        </span>
      );
    }

    if (lap.Penalties && lap.Penalties > 0) {
      elements.push(
        <span key="pen" className="driver-penalty-badge penalty-time" title={`${lap.Penalties}s Time Penalty`}>
          +{lap.Penalties}s
        </span>
      );
    } else if (lap.TotalWarnings && lap.TotalWarnings > 0) {
      elements.push(
        <span key="warn" className="driver-warning-badge" title={`${lap.TotalWarnings} Warnings`}>
          {lap.TotalWarnings}W
        </span>
      );
    }

    if (elements.length === 0) return null;
    return <>{elements}</>;
  };

  const getDriverStatusBadge = (status?: number, pitStatus?: number) => {
    if (pitStatus === 1 || pitStatus === 2) {
      return <span className="driver-status-badge status-pit"><Wrench size={10} style={{ display: 'inline', marginRight: '2px' }} /> PIT</span>;
    }
    if (status === 1) {
      return <span className="driver-status-badge status-hotlap"><Flame size={10} style={{ display: 'inline', marginRight: '2px' }} /> HOTLAP</span>;
    }
    if (status === 3) {
      return <span className="driver-status-badge status-outlap">OUT LAP</span>;
    }
    if (status === 0) {
      return <span className="driver-status-badge status-garage">GARAGE</span>;
    }
    return null;
  };

  // Split drivers into 2 parallel columns (P1-P11 on left, P12-P22 on right)
  const col1Drivers = displayDrivers.slice(0, 11);
  const col2Drivers = displayDrivers.slice(11);

  const renderDriverRow = (driver: ProcessedDriver, indexInCol: number, colIndex: number) => {
    const overallIndex = colIndex === 0 ? indexInCol : indexInCol + col1Drivers.length;
    const teamColor = TEAM_COLORS[driver.teamId] || '#A0A0A0';
    const isSelected = driver.carIndex === selectedCarIndex;
    const compound = driver.carStatus?.VisualTyreCompound ? TYRE_COMPOUNDS[driver.carStatus.VisualTyreCompound] : null;
    const driverBestLap = isQualy
      ? (bestLapTimesRef.current[driver.carIndex] || driver.lap?.LastLapTimeInMS)
      : driver.lap?.LastLapTimeInMS;

    const flashClass = posFlashMap[driver.carIndex]
      ? posFlashMap[driver.carIndex] === 'up' ? 'flash-pos-up' : 'flash-pos-down'
      : '';

    const showEliminationLine = isQualy && displayDrivers.length >= 15 && (
      (isQ1 && overallIndex === 14) || (isQ2 && overallIndex === 9)
    );

    return (
      <React.Fragment key={driver.carIndex}>
        <div
          className={`tower-row ${isSelected ? 'tower-row-selected' : ''} ${driver.isPlayer ? 'tower-row-player' : ''} ${flashClass}`}
          onClick={() => onSelectCar(driver.carIndex)}
          style={{ padding: '0.4rem 0.6rem', minHeight: '34px' }}
        >
          {/* Team Accent Bar */}
          <div className="team-bar" style={{ backgroundColor: teamColor }} />

          {/* Position & Grid Change Badge */}
          <div className="tower-pos mono" style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '45px' }}>
            <span style={{ fontWeight: 700 }}>P{driver.position}</span>
            {!isQualy && getGridDeltaBadge(driver.gridPosition, driver.position)}
          </div>

          {/* Driver Info */}
          <div className="tower-driver-info" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="tower-name" style={{ fontSize: '0.82rem' }}>{driver.name}</span>
              <span className="tower-number mono" style={{ fontSize: '0.68rem' }}>#{driver.raceNumber}</span>
              {driver.isPlayer && <span className="player-tag">YOU</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px', flexWrap: 'wrap' }}>
              {getDriverStatusBadge(driver.lap?.DriverStatus, driver.lap?.PitStatus)}
              {getPenaltyBadge(driver.lap)}
            </div>
          </div>

          {/* Tyre Compound Badge & Age */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 6px' }}>
            {compound ? (
              <div
                className="tyre-badge mono"
                style={{ color: compound.color, backgroundColor: compound.bg, borderColor: compound.color, fontSize: '0.68rem', padding: '1px 5px' }}
              >
                {compound.label} <span className="tyre-laps-label">{driver.carStatus?.TyresAgeLaps || 0}L</span>
              </div>
            ) : (
              <div className="tyre-badge mono" style={{ color: '#888', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '0.68rem', padding: '1px 5px' }}>
                -
              </div>
            )}
          </div>

          {/* Gap / Interval / Lap Time */}
          <div className="tower-time-col mono" style={{ minWidth: '75px', textAlign: 'right' }}>
            {isQualy ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: driverBestLap && driverBestLap > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {formatTime(driverBestLap)}
                </div>
                {driverBestLap && driverBestLap > 0 && (
                  <div style={{ fontSize: '0.68rem', color: overallIndex === 0 ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                    {formatQualyDelta(driverBestLap)}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: overallIndex === 0 ? 'var(--accent-primary)' : 'inherit' }}>
                  {overallIndex === 0 ? 'LEADER' : formatDelta(driver.lap?.DeltaToRaceLeaderMSPart, driver.lap?.DeltaToRaceLeaderMinutesPart)}
                </div>
                {overallIndex > 0 && driver.lap?.DeltaToCarInFrontMSPart !== undefined && (
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    INT {formatDelta(driver.lap.DeltaToCarInFrontMSPart, driver.lap.DeltaToCarInFrontMinutesPart)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Elimination Zone Line for Qualifying */}
        {showEliminationLine && (
          <div className="elimination-line" style={{ margin: '2px 0' }}>
            <span>ELIMINATION ZONE CUT-OFF</span>
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="glass-panel leaderboard-tower" style={{ height: 'auto', maxHeight: 'none' }}>
      {/* Clean F1 TV Timing Tower Header */}
      <div className="leaderboard-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
          <Trophy size={18} color="var(--accent-primary)" />
          {isQualy ? 'Qualifying Standings' : 'Race Leaderboard Tower'}
        </h3>
        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {displayDrivers.length} CARS
        </span>
      </div>

      {/* 2 Parallel Columns Grid (P1-P11 Left | P12-P22 Right) */}
      <div className="tower-two-cols-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {/* Left Column: P1 to P11 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {col1Drivers.map((driver, idx) => renderDriverRow(driver, idx, 0))}
        </div>

        {/* Right Column: P12 to P22 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {col2Drivers.map((driver, idx) => renderDriverRow(driver, idx, 1))}
        </div>
      </div>
    </div>
  );
};
