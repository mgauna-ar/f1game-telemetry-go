import React from 'react';
import { Wrench } from 'lucide-react';
import { parseDriverName } from '../hooks/useTelemetry';
import { TEAM_COLORS, TYRE_COMPOUNDS } from '../constants/f1';
import type { ParticipantData, LapData, CarStatusData, SessionData } from '../types/telemetry';
import { useI18n } from '../context/I18nContext';

interface LivePitStrategyProps {
  session: SessionData | null;
  participants: ParticipantData[];
  laps: LapData[];
  carStatuses: CarStatusData[];
  selectedCarIndex: number;
  playerCarIndex: number;
  onSelectCar: (index: number) => void;
}

export const LivePitStrategy: React.FC<LivePitStrategyProps> = ({
  session,
  laps = [],
  carStatuses = [],
  participants = [],
  playerCarIndex = 0,
  selectedCarIndex = 0,
  onSelectCar,
}) => {
  const { t } = useI18n();

  const idealLap = session?.PitStopWindowIdealLap || 18;
  const latestLap = session?.PitStopWindowLatestLap || 24;
  const rejoinPos = session?.PitStopRejoinPosition || 6;
  const currentLeaderLap = Math.max(...laps.map((l) => l?.CurrentLapNum || 0), 1);

  // Check if current lap is inside the pit stop window
  const isWindowOpen = currentLeaderLap >= idealLap && currentLeaderLap <= latestLap;

  // Build sorted field data
  const drivers = participants.map((p, idx) => {
    const lap = laps[idx];
    const status = carStatuses[idx];
    const rawName = p.Name;
    const defaultName = p.RaceNumber ? `Driver #${p.RaceNumber}` : `Car #${idx + 1}`;
    const name = parseDriverName(rawName, defaultName, p.DriverId);

    return {
      carIndex: idx,
      position: lap?.CarPosition || idx + 1,
      name,
      raceNumber: p.RaceNumber || idx + 1,
      teamId: p.TeamId,
      lap,
      status,
      isPlayer: idx === playerCarIndex,
      isSelected: idx === selectedCarIndex,
    };
  });

  drivers.sort((a, b) => a.position - b.position);

  const getPitStatusBadge = (pitStatus?: number, timerMs?: number, timeInLaneMs?: number) => {
    if (pitStatus === 1) {
      return (
        <span className="pit-badge-lane mono">
          <span className="pit-live-dot" />
          {t('live.pitLane')} {timeInLaneMs ? `(${(timeInLaneMs / 1000).toFixed(1)}s)` : ''}
        </span>
      );
    }
    if (pitStatus === 2) {
      return (
        <span className="pit-badge-box mono">
          <span className="pit-live-dot box" />
          {t('live.inBox')} {timerMs ? `(${(timerMs / 1000).toFixed(1)}s)` : ''}
        </span>
      );
    }
    return <span className="pit-badge-track mono">{t('live.trackStatus')}</span>;
  };

  const getTyreMeta = (compoundId?: number) => {
    if (compoundId !== undefined && TYRE_COMPOUNDS[compoundId]) {
      return TYRE_COMPOUNDS[compoundId];
    }
    return { label: 'M', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.15)' };
  };

  const activePitsCount = laps.filter((l) => l && (l.PitStatus === 1 || l.PitStatus === 2)).length;

  return (
    <div className="glass-panel race-hub-card live-pit-strategy-panel">
      {/* Panel Header */}
      <div className="race-hub-header">
        <div className="race-hub-title-group">
          <div className="race-hub-icon-wrap">
            <Wrench size={16} color="var(--accent-primary)" />
          </div>
          <div>
            <h3 className="race-hub-title">
              {t('live.pitStrategyTitle')}
            </h3>
            <div className="race-hub-subtitle mono">
              {t('live.pitStrategySub')}
            </div>
          </div>
        </div>

        <div className="race-hub-header-actions">
          {activePitsCount > 0 && (
            <span className="active-pits-pill mono">
              <span className="pit-live-dot" />
              {t('live.pittingNow', { count: activePitsCount })}
            </span>
          )}
        </div>
      </div>

      {/* Pit Window Strategy KPI Strip */}
      <div className="pit-strategy-kpi-row">
        <div className="pit-kpi-box">
          <div className="readout-label">{t('live.estimatedPitWindow')}</div>
          <div className="pit-kpi-value mono" style={{ color: isWindowOpen ? '#33FF99' : 'inherit' }}>
            {t('live.lapRange', { ideal: idealLap, latest: latestLap })}
          </div>
          <div className="pit-kpi-sub">
            {isWindowOpen
              ? t('live.windowOpenNow')
              : currentLeaderLap < idealLap
              ? t('live.windowOpensIn', { count: idealLap - currentLeaderLap })
              : t('live.windowClosed')}
          </div>
        </div>

        <div className="pit-kpi-box">
          <div className="readout-label">{t('live.predictedRejoin')}</div>
          <div className="pit-kpi-value mono" style={{ color: 'var(--accent-primary)' }}>
            P{rejoinPos}
          </div>
          <div className="pit-kpi-sub">{t('live.cleanAirEstimate')}</div>
        </div>

        <div className="pit-kpi-box">
          <div className="readout-label">{t('live.selectedDriver')}</div>
          <div className="pit-kpi-value mono" style={{ fontSize: '1rem', color: '#33CCFF' }}>
            {drivers.find((d) => d.isSelected)?.name || 'Car #1'}
          </div>
          <div className="pit-kpi-sub">
            {t('live.stopsMade', { count: drivers.find((d) => d.isSelected)?.lap?.NumPitStops || 0 })}
          </div>
        </div>
      </div>

      {/* Field Tyre & Pit Matrix Table */}
      <div className="pit-matrix-table-container">
        <table className="pit-matrix-table">
          <thead>
            <tr>
              <th style={{ width: '42px', textAlign: 'center' }}>{t('live.thPos')}</th>
              <th>{t('live.thDriver')}</th>
              <th style={{ width: '70px', textAlign: 'center' }}>{t('live.thTyre')}</th>
              <th style={{ width: '75px', textAlign: 'center' }}>{t('live.thAge')}</th>
              <th style={{ width: '65px', textAlign: 'center' }}>{t('live.thStops')}</th>
              <th style={{ width: '130px', textAlign: 'right' }}>{t('live.thStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const tyreCompound = d.status?.VisualTyreCompound ?? 17;
              const tyreMeta = getTyreMeta(tyreCompound);
              const tyreAge = d.status?.TyresAgeLaps ?? 0;
              const teamColor = TEAM_COLORS[d.teamId] || 'var(--accent-primary)';

              return (
                <tr
                  key={d.carIndex}
                  className={`pit-matrix-row ${d.isSelected ? 'selected' : ''} ${d.isPlayer ? 'player' : ''}`}
                  onClick={() => onSelectCar(d.carIndex)}
                >
                  <td className="mono text-center font-bold" style={{ color: d.position <= 3 ? '#FFD700' : 'inherit' }}>
                    P{d.position}
                  </td>
                  <td>
                    <div className="pit-driver-cell">
                      <span className="team-color-indicator" style={{ backgroundColor: teamColor }} />
                      <span className="pit-driver-name">{d.name}</span>
                      {d.isPlayer && <span className="player-indicator-chip">{t('live.youChip')}</span>}
                    </div>
                  </td>
                  <td className="text-center">
                    <span
                      className="tyre-badge-mini mono"
                      style={{
                        color: tyreMeta.color,
                        backgroundColor: tyreMeta.bg,
                        borderColor: tyreMeta.color,
                      }}
                    >
                      {tyreMeta.label}
                    </span>
                  </td>
                  <td className="mono text-center font-semibold">
                    <span
                      style={{
                        color: tyreAge > 20 ? '#FF4D4D' : tyreAge > 12 ? '#FFD700' : 'inherit',
                      }}
                    >
                      {tyreAge} L
                    </span>
                  </td>
                  <td className="mono text-center font-semibold">{d.lap?.NumPitStops ?? 0}</td>
                  <td className="text-right">
                    {getPitStatusBadge(d.lap?.PitStatus, d.lap?.PitStopTimerInMS, d.lap?.PitLaneTimeInLaneInMS)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
