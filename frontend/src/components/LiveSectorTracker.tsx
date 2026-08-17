import React, { useMemo } from 'react';
import { Zap, Gauge, Award, Timer, Target } from 'lucide-react';
import { parseDriverName } from '../hooks/useTelemetry';
import { TEAM_COLORS } from './LeaderboardTower';
import type { ParticipantData, LapData } from '../hooks/useTelemetry';

interface LiveSectorTrackerProps {
  participants: ParticipantData[];
  laps: LapData[];
  selectedCarIndex: number;
  playerCarIndex: number;
}

export const LiveSectorTracker: React.FC<LiveSectorTrackerProps> = ({
  participants = [],
  laps = [],
  selectedCarIndex = 0,
  playerCarIndex = 0,
}) => {
  const formatTime = (ms?: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    }
    return `${secs}.${millis.toString().padStart(3, '0')}s`;
  };

  // Find Session Best Sectors (Purple Sectors)
  const sectorAnalysis = useMemo(() => {
    let bestS1 = { time: 0, carIdx: -1, driverName: '--', teamId: -1 };
    let bestS2 = { time: 0, carIdx: -1, driverName: '--', teamId: -1 };
    let fastestLap = { time: 0, carIdx: -1, driverName: '--', teamId: -1 };

    laps.forEach((lap, idx) => {
      if (!lap) return;
      const p = participants[idx];
      const name = parseDriverName(p?.Name, `Car #${idx + 1}`, p?.DriverId);
      const teamId = p?.TeamId ?? 0;

      // Sector 1
      const s1Ms = lap.Sector1TimeMSPart;
      if (s1Ms > 0 && (bestS1.time === 0 || s1Ms < bestS1.time)) {
        bestS1 = { time: s1Ms, carIdx: idx, driverName: name, teamId };
      }

      // Sector 2
      const s2Ms = lap.Sector2TimeMSPart;
      if (s2Ms > 0 && (bestS2.time === 0 || s2Ms < bestS2.time)) {
        bestS2 = { time: s2Ms, carIdx: idx, driverName: name, teamId };
      }

      // Fastest Lap
      const lastLap = lap.LastLapTimeInMS;
      if (lastLap > 0 && (fastestLap.time === 0 || lastLap < fastestLap.time)) {
        fastestLap = { time: lastLap, carIdx: idx, driverName: name, teamId };
      }
    });

    // Approximate Sector 3 if fastestLap exists
    let estimatedS3 = 0;
    if (fastestLap.time > 0 && bestS1.time > 0 && bestS2.time > 0) {
      estimatedS3 = Math.max(0, fastestLap.time - bestS1.time - bestS2.time);
    }

    const theoreticalBest =
      bestS1.time > 0 && bestS2.time > 0 && estimatedS3 > 0
        ? bestS1.time + bestS2.time + estimatedS3
        : fastestLap.time > 0
        ? fastestLap.time
        : 0;

    return {
      bestS1,
      bestS2,
      estimatedS3,
      fastestLap,
      theoreticalBest,
    };
  }, [participants, laps]);

  // Speed Trap Leaderboard (Sorted by Fastest Speed)
  const speedTraps = useMemo(() => {
    const list = participants.map((p, idx) => {
      const lap = laps[idx];
      const name = parseDriverName(p?.Name, `Car #${idx + 1}`, p?.DriverId);
      return {
        carIndex: idx,
        name,
        teamId: p.TeamId,
        speed: lap?.SpeedTrapFastestSpeed || 0,
        lapNum: lap?.SpeedTrapFastestLap || 0,
        isSelected: idx === selectedCarIndex,
      };
    });

    return list
      .filter((s) => s.speed > 0)
      .sort((a, b) => b.speed - a.speed)
      .slice(0, 5);
  }, [participants, laps, selectedCarIndex]);

  // Selected driver sectors
  const selectedLap = laps[selectedCarIndex];
  const selectedParticipant = participants[selectedCarIndex];
  const selectedName = parseDriverName(
    selectedParticipant?.Name,
    `Car #${selectedCarIndex + 1}`,
    selectedParticipant?.DriverId
  );

  return (
    <div className="glass-panel race-hub-card live-sector-tracker-panel">
      {/* Panel Header */}
      <div className="race-hub-header">
        <div className="race-hub-title-group">
          <div className="race-hub-icon-wrap">
            <Zap size={16} color="#B57EDC" />
          </div>
          <div>
            <h3 className="race-hub-title">Live Sector Performance & Speed Traps</h3>
            <div className="race-hub-subtitle mono">Session Purple Splits & Top Speeds</div>
          </div>
        </div>

        <div className="race-hub-header-actions">
          <div className="ultimate-lap-chip mono">
            <span className="label">THEORETICAL BEST:</span>
            <span className="val">{formatTime(sectorAnalysis.theoreticalBest)}</span>
          </div>
        </div>
      </div>

      {/* Sector Purple Cards Row */}
      <div className="sector-purple-grid">
        {/* Sector 1 */}
        <div className="sector-card purple-s1">
          <div className="sector-card-header">
            <span className="sector-badge">SECTOR 1</span>
            <span className="mono sector-time">{formatTime(sectorAnalysis.bestS1.time)}</span>
          </div>
          <div className="sector-holder">
            <span
              className="team-dot"
              style={{ backgroundColor: TEAM_COLORS[sectorAnalysis.bestS1.teamId] || 'var(--accent-primary)' }}
            />
            <span className="holder-name">{sectorAnalysis.bestS1.driverName}</span>
          </div>
        </div>

        {/* Sector 2 */}
        <div className="sector-card purple-s2">
          <div className="sector-card-header">
            <span className="sector-badge">SECTOR 2</span>
            <span className="mono sector-time">{formatTime(sectorAnalysis.bestS2.time)}</span>
          </div>
          <div className="sector-holder">
            <span
              className="team-dot"
              style={{ backgroundColor: TEAM_COLORS[sectorAnalysis.bestS2.teamId] || 'var(--accent-primary)' }}
            />
            <span className="holder-name">{sectorAnalysis.bestS2.driverName}</span>
          </div>
        </div>

        {/* Fastest Lap */}
        <div className="sector-card fastest-lap-card">
          <div className="sector-card-header">
            <span className="sector-badge fastest">FASTEST LAP</span>
            <span className="mono sector-time">{formatTime(sectorAnalysis.fastestLap.time)}</span>
          </div>
          <div className="sector-holder">
            <span
              className="team-dot"
              style={{ backgroundColor: TEAM_COLORS[sectorAnalysis.fastestLap.teamId] || '#FFD700' }}
            />
            <span className="holder-name">{sectorAnalysis.fastestLap.driverName}</span>
          </div>
        </div>
      </div>

      {/* Bottom Split: Selected Driver Splits & Speed Trap Top 5 */}
      <div className="sector-bottom-split">
        {/* Selected Driver Splits */}
        <div className="selected-driver-sector-card">
          <div className="subcard-title">
            <Target size={14} color="var(--accent-primary)" />
            <span>Sector Splits: {selectedName}</span>
          </div>

          <div className="driver-splits-row">
            <div className="split-col">
              <span className="split-label">S1</span>
              <span className="split-time mono">
                {formatTime(selectedLap?.Sector1TimeMSPart)}
              </span>
              {sectorAnalysis.bestS1.time > 0 && selectedLap?.Sector1TimeMSPart ? (
                <span
                  className="split-delta mono"
                  style={{
                    color:
                      selectedLap.Sector1TimeMSPart <= sectorAnalysis.bestS1.time ? '#B57EDC' : 'var(--text-muted)',
                  }}
                >
                  {selectedLap.Sector1TimeMSPart <= sectorAnalysis.bestS1.time
                    ? 'PURPLE'
                    : `+${((selectedLap.Sector1TimeMSPart - sectorAnalysis.bestS1.time) / 1000).toFixed(3)}s`}
                </span>
              ) : null}
            </div>

            <div className="split-col">
              <span className="split-label">S2</span>
              <span className="split-time mono">
                {formatTime(selectedLap?.Sector2TimeMSPart)}
              </span>
              {sectorAnalysis.bestS2.time > 0 && selectedLap?.Sector2TimeMSPart ? (
                <span
                  className="split-delta mono"
                  style={{
                    color:
                      selectedLap.Sector2TimeMSPart <= sectorAnalysis.bestS2.time ? '#B57EDC' : 'var(--text-muted)',
                  }}
                >
                  {selectedLap.Sector2TimeMSPart <= sectorAnalysis.bestS2.time
                    ? 'PURPLE'
                    : `+${((selectedLap.Sector2TimeMSPart - sectorAnalysis.bestS2.time) / 1000).toFixed(3)}s`}
                </span>
              ) : null}
            </div>

            <div className="split-col">
              <span className="split-label">LAST LAP</span>
              <span className="split-time mono">
                {formatTime(selectedLap?.LastLapTimeInMS)}
              </span>
              <span className="split-delta mono" style={{ color: 'var(--text-muted)' }}>
                {selectedLap?.CurrentLapInvalid ? 'INVALIDATED' : 'VALID'}
              </span>
            </div>
          </div>
        </div>

        {/* Speed Trap Rankings */}
        <div className="speed-trap-card">
          <div className="subcard-title">
            <Gauge size={14} color="#33CCFF" />
            <span>Speed Trap Leaderboard</span>
          </div>

          <div className="speed-trap-list">
            {speedTraps.length === 0 ? (
              <div className="speed-trap-empty mono">No speed trap triggers recorded yet</div>
            ) : (
              speedTraps.map((st, i) => (
                <div
                  key={st.carIndex}
                  className={`speed-trap-item ${st.isSelected ? 'selected' : ''}`}
                >
                  <div className="speed-trap-left">
                    <span className="mono speed-rank">#{i + 1}</span>
                    <span
                      className="team-color-indicator"
                      style={{ backgroundColor: TEAM_COLORS[st.teamId] || '#33CCFF' }}
                    />
                    <span className="speed-driver-name">{st.name}</span>
                  </div>
                  <div className="speed-trap-right mono">
                    <span className="speed-val">{Math.round(st.speed)} KM/H</span>
                    {st.lapNum > 0 && <span className="speed-lap">L{st.lapNum}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
