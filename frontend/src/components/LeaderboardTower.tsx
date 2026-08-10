import React from 'react';
import { Trophy, Wrench, Flame } from 'lucide-react';
import { parseDriverName } from '../hooks/useTelemetry';
import type { ParticipantData, LapData, CarStatusData, SessionData } from '../hooks/useTelemetry';

export const TEAM_COLORS: Record<number, string> = {
  0: '#3671C6', // Red Bull Racing
  1: '#6CD3BF', // Mercedes
  2: '#FF8000', // McLaren
  3: '#229971', // Aston Martin
  4: '#E8002D', // Ferrari
  5: '#0093CC', // Alpine
  6: '#37BEDD', // Williams
  7: '#6692FF', // Visa Cash App RB
  8: '#C92D4B', // Sauber
  9: '#B6BABD', // Haas
};

export const TYRE_COMPOUNDS: Record<number, { label: string; color: string; bg: string }> = {
  16: { label: 'S', color: '#FF3333', bg: 'rgba(255, 51, 51, 0.15)' }, // Soft
  17: { label: 'M', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.15)' }, // Medium
  18: { label: 'H', color: '#FFFFFF', bg: 'rgba(255, 255, 255, 0.15)' }, // Hard
  7: { label: 'I', color: '#33FF33', bg: 'rgba(51, 255, 51, 0.15)' },  // Intermediate
  8: { label: 'W', color: '#3399FF', bg: 'rgba(51, 153, 255, 0.15)' }, // Wet
};

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
  const isQualy = session?.SessionType !== undefined && session.SessionType >= 5 && session.SessionType <= 9;
  const isQ1 = session?.SessionType === 5;
  const isQ2 = session?.SessionType === 6;

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
      name,
      raceNumber: p.RaceNumber || idx + 1,
      teamId: p.TeamId,
      aiControlled: p.AIControlled === 1,
      lap,
      carStatus,
      isPlayer: idx === playerCarIndex,
    };
  });

  // Fallback synthetic drivers if array is empty (e.g. initial connection before packet ID 4 arrives)
  const displayDrivers: ProcessedDriver[] = drivers.length > 0 ? drivers : [
    { carIndex: 0, position: laps[0]?.CarPosition || 1, name: 'Player Car', raceNumber: 1, teamId: 0, aiControlled: false, lap: laps[0], carStatus: carStatuses[0], isPlayer: true }
  ];

  // Sort drivers
  if (isQualy) {
    displayDrivers.sort((a, b) => {
      const timeA = bestLapTimesRef.current[a.carIndex] || (a.lap?.LastLapTimeInMS || 0);
      const timeB = bestLapTimesRef.current[b.carIndex] || (b.lap?.LastLapTimeInMS || 0);

      // Both drivers have completed timed laps -> sort by lap time ascending
      if (timeA > 0 && timeB > 0) {
        if (timeA !== timeB) return timeA - timeB;
        return a.carIndex - b.carIndex;
      }
      // Driver A has timed lap, B does not -> A goes first
      if (timeA > 0 && timeB === 0) return -1;
      if (timeA === 0 && timeB > 0) return 1;

      // Neither driver has a timed lap -> sort stably by car index (prevent UI jitter)
      return a.carIndex - b.carIndex;
    });

    // Re-assign positions based on qualifying standing order
    displayDrivers.forEach((d, idx) => {
      d.position = idx + 1;
    });
  } else {
    // Race sorting by car position
    displayDrivers.sort((a, b) => a.position - b.position);
  }

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

  return (
    <div className="glass-panel leaderboard-tower">
      <div className="leaderboard-header">
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
          <Trophy size={18} color="var(--accent-primary)" />
          {isQualy ? 'Qualifying Standings' : 'Race Leaderboard Tower'}
        </h3>
        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {displayDrivers.length} CARS
        </span>
      </div>

      <div className="tower-scroll-container">
        {displayDrivers.map((driver, index) => {
          const teamColor = TEAM_COLORS[driver.teamId] || '#A0A0A0';
          const isSelected = driver.carIndex === selectedCarIndex;
          const compound = driver.carStatus?.VisualTyreCompound ? TYRE_COMPOUNDS[driver.carStatus.VisualTyreCompound] : null;
          const driverBestLap = isQualy
            ? (bestLapTimesRef.current[driver.carIndex] || driver.lap?.LastLapTimeInMS)
            : driver.lap?.LastLapTimeInMS;

          const showEliminationLine = isQualy && displayDrivers.length >= 15 && (
            (isQ1 && index === 14) || (isQ2 && index === 9)
          );

          return (
            <React.Fragment key={driver.carIndex}>
              <div
                className={`tower-row ${isSelected ? 'tower-row-selected' : ''} ${driver.isPlayer ? 'tower-row-player' : ''}`}
                onClick={() => onSelectCar(driver.carIndex)}
              >
                {/* Team Accent Bar */}
                <div className="team-bar" style={{ backgroundColor: teamColor }} />

                {/* Position */}
                <div className="tower-pos mono">
                  P{driver.position}
                </div>

                {/* Driver Info */}
                <div className="tower-driver-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="tower-name">{driver.name}</span>
                    <span className="tower-number mono">#{driver.raceNumber}</span>
                    {driver.isPlayer && <span className="player-tag">YOU</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    {getDriverStatusBadge(driver.lap?.DriverStatus, driver.lap?.PitStatus)}
                    {driver.lap?.CurrentLapNum ? (
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        LAP {driver.lap.CurrentLapNum}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Tyre Compound Badge */}
                {compound ? (
                  <div
                    className="tyre-badge mono"
                    style={{ color: compound.color, backgroundColor: compound.bg, borderColor: compound.color }}
                  >
                    {compound.label}
                  </div>
                ) : (
                  <div className="tyre-badge mono" style={{ color: '#888', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    -
                  </div>
                )}

                {/* Gap / Interval / Lap Time */}
                <div className="tower-time-col mono">
                  {isQualy ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: driverBestLap && driverBestLap > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {formatTime(driverBestLap)}
                      </div>
                      {driverBestLap && driverBestLap > 0 && (
                        <div style={{ fontSize: '0.7rem', color: index === 0 ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                          {formatQualyDelta(driverBestLap)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: index === 0 ? 'var(--accent-primary)' : 'inherit' }}>
                        {index === 0 ? 'LEADER' : formatDelta(driver.lap?.DeltaToRaceLeaderMSPart, driver.lap?.DeltaToRaceLeaderMinutesPart)}
                      </div>
                      {index > 0 && driver.lap?.DeltaToCarInFrontMSPart !== undefined && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          INT {formatDelta(driver.lap.DeltaToCarInFrontMSPart, driver.lap.DeltaToCarInFrontMinutesPart)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Elimination Zone Line for Qualifying */}
              {showEliminationLine && (
                <div className="elimination-line">
                  <span>ELIMINATION ZONE CUT-OFF</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
