import React from 'react';
import { Trophy, Wrench, Flame } from 'lucide-react';
import { parseDriverName } from '../hooks/useTelemetry';
import { filterActiveLiveParticipants } from '../utils/driverFilter';
import type { ParticipantData, LapData, CarStatusData, SessionData, CarTelemetry2Data } from '../types/telemetry';
import {
  TEAM_COLORS,
  TYRE_COMPOUNDS,
  SESSION_TYPES,
  RESULT_STATUS,
  PIT_STATUS,
  DRIVER_STATUS,
  ACTIVE_AERO_MODES,
  TIME_CONSTANTS,
} from '../constants/f1';
import { useI18n } from '../context/I18nContext';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';

export { TEAM_COLORS, TYRE_COMPOUNDS };

interface LeaderboardTowerProps {
  session?: SessionData | null;
  participants?: ParticipantData[];
  laps?: LapData[];
  carStatuses?: CarStatusData[];
  telemetry2List?: CarTelemetry2Data[];
  playerCarIndex?: number;
  selectedCarIndex?: number;
  onSelectCar?: (index: number) => void;
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
  telemetry2: CarTelemetry2Data | undefined;
  isPlayer: boolean;
}

export const LeaderboardTower: React.FC<LeaderboardTowerProps> = React.memo((props) => {
  const storeSession = useSessionStatusStore((s) => s.session);
  const storeParticipants = useSessionStatusStore((s) => s.participants);
  const storeLaps = useTelemetryDataStore((s) => s.allLaps);
  const storeCarStatuses = useTelemetryDataStore((s) => s.allCarStatus);
  const storeTelemetry2List = useTelemetryDataStore((s) => s.allTelemetry2);
  const storePlayerCarIndex = useTelemetryDataStore((s) => s.playerCarIndex);
  const storeSelectedCarIndex = useTelemetryDataStore((s) => s.selectedCarIndex);
  const setSelectedCarIndex = useTelemetryDataStore((s) => s.setSelectedCarIndex);

  const session = props.session !== undefined ? props.session : storeSession;
  const participants = props.participants !== undefined ? props.participants : storeParticipants;
  const laps = props.laps !== undefined ? props.laps : storeLaps;
  const carStatuses = props.carStatuses !== undefined ? props.carStatuses : storeCarStatuses;
  const telemetry2List = props.telemetry2List !== undefined ? props.telemetry2List : storeTelemetry2List;
  const playerCarIndex = props.playerCarIndex !== undefined ? props.playerCarIndex : storePlayerCarIndex;
  const selectedCarIndex = props.selectedCarIndex !== undefined ? props.selectedCarIndex : storeSelectedCarIndex;
  const onSelectCar = props.onSelectCar !== undefined ? props.onSelectCar : setSelectedCarIndex;

  const { t } = useI18n();
  const isQualy = session?.SessionType !== undefined && 
    ((session.SessionType >= SESSION_TYPES.Q1 && session.SessionType <= SESSION_TYPES.OSQ) || 
     (session.SessionType >= SESSION_TYPES.SPRINT_Q1 && session.SessionType <= SESSION_TYPES.OS_SPRINT_Q));
  const isQ1 = session?.SessionType === SESSION_TYPES.Q1 || session?.SessionType === SESSION_TYPES.SPRINT_Q1;
  const isQ2 = session?.SessionType === SESSION_TYPES.Q2 || session?.SessionType === SESSION_TYPES.SPRINT_Q2;

  // Position flash animations on position changes
  const prevPosMapRef = React.useRef<Record<number, number>>({});
  const [posFlashMap, setPosFlashMap] = React.useState<Record<number, 'up' | 'down'>>({});
  const flashTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track best lap times per car during qualifying session
  const bestLapTimesRef = React.useRef<Record<number, number>>({});
  const lastSessionKeyRef = React.useRef<string | number | null>(null);

  const sessionKey = `${session?.SessionType}_${session?.TrackId}`;

  // Update best lap times per car in effect instead of mutating ref inside useMemo
  React.useEffect(() => {
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
  }, [laps, sessionKey]);

  // Build unified driver entries
  const displayDrivers: ProcessedDriver[] = React.useMemo(() => {
    // Pure computation of best lap times for this calculation
    const effectiveBestTimes: Record<number, number> = { ...bestLapTimesRef.current };
    if (lastSessionKeyRef.current !== sessionKey) {
      Object.keys(effectiveBestTimes).forEach((k) => delete effectiveBestTimes[Number(k)]);
    }
    laps.forEach((lap, idx) => {
      if (lap && lap.LastLapTimeInMS > 0) {
        const currentBest = effectiveBestTimes[idx] || 0;
        if (currentBest === 0 || lap.LastLapTimeInMS < currentBest) {
          effectiveBestTimes[idx] = lap.LastLapTimeInMS;
        }
      }
    });

    const activeParticipants = filterActiveLiveParticipants(participants, laps, playerCarIndex);

    const drivers: ProcessedDriver[] = activeParticipants.map(({ participant: p, carIndex: idx }) => {
      const lap = laps[idx];
      const carStatus = carStatuses[idx];
      const telemetry2 = telemetry2List?.[idx];
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
        telemetry2,
        isPlayer: idx === playerCarIndex,
      };
    });

    const result: ProcessedDriver[] = drivers.length > 0 ? drivers : [
      { carIndex: 0, position: laps[0]?.CarPosition || 1, gridPosition: laps[0]?.GridPosition || 1, name: 'Player Car', raceNumber: 1, teamId: 0, aiControlled: false, lap: laps[0], carStatus: carStatuses[0], telemetry2: telemetry2List?.[0], isPlayer: true }
    ];

    // Sort drivers
    if (isQualy) {
      result.sort((a, b) => {
        const timeA = effectiveBestTimes[a.carIndex] || (a.lap?.LastLapTimeInMS || 0);
        const timeB = effectiveBestTimes[b.carIndex] || (b.lap?.LastLapTimeInMS || 0);
        const resA = a.lap?.ResultStatus ?? RESULT_STATUS.ACTIVE;
        const resB = b.lap?.ResultStatus ?? RESULT_STATUS.ACTIVE;

        // Disqualified drivers at the very bottom
        const isDsqA = resA === RESULT_STATUS.DSQ;
        const isDsqB = resB === RESULT_STATUS.DSQ;
        if (isDsqA !== isDsqB) return isDsqA ? 1 : -1;

        // Both set lap times: rank strictly by best lap time ascending
        if (timeA > 0 && timeB > 0) {
          if (timeA !== timeB) return timeA - timeB;
          return a.carIndex - b.carIndex;
        }

        // Driver with a time always ranks ahead of driver without time
        if (timeA > 0 && timeB === 0) return -1;
        if (timeA === 0 && timeB > 0) return 1;

        // Both without lap time: check retired/DNF vs active un-timed
        const isRetA = resA === RESULT_STATUS.RETIRED || resA === RESULT_STATUS.DNF || resA === RESULT_STATUS.NOT_CLASSIFIED;
        const isRetB = resB === RESULT_STATUS.RETIRED || resB === RESULT_STATUS.DNF || resB === RESULT_STATUS.NOT_CLASSIFIED;
        if (isRetA !== isRetB) return isRetA ? 1 : -1;

        return a.carIndex - b.carIndex;
      });

      result.forEach((d, idx) => {
        d.position = idx + 1;
      });
    } else {
      result.sort((a, b) => {
        const resA = a.lap?.ResultStatus ?? RESULT_STATUS.ACTIVE;
        const resB = b.lap?.ResultStatus ?? RESULT_STATUS.ACTIVE;
        const isDsqA = resA === RESULT_STATUS.DSQ;
        const isDsqB = resB === RESULT_STATUS.DSQ;
        if (isDsqA !== isDsqB) return isDsqA ? 1 : -1;

        const isRetA = resA === RESULT_STATUS.RETIRED || resA === RESULT_STATUS.DNF;
        const isRetB = resB === RESULT_STATUS.RETIRED || resB === RESULT_STATUS.DNF;
        if (isRetA !== isRetB) return isRetA ? 1 : -1;

        return a.position - b.position;
      });
    }

    return result;
  }, [participants, laps, carStatuses, telemetry2List, playerCarIndex, isQualy, sessionKey]);

  // Detect position updates for flash animations with stabilized timers
  React.useEffect(() => {
    const newFlash: Record<number, 'up' | 'down'> = {};
    let hasChanges = false;

    displayDrivers.forEach((d) => {
      const prevPos = prevPosMapRef.current[d.carIndex];
      if (prevPos !== undefined && prevPos !== d.position) {
        newFlash[d.carIndex] = d.position < prevPos ? 'up' : 'down';
        hasChanges = true;
      }
      prevPosMapRef.current[d.carIndex] = d.position;
    });

    if (hasChanges) {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
      setPosFlashMap((prev) => ({ ...prev, ...newFlash }));
      flashTimerRef.current = setTimeout(() => {
        setPosFlashMap({});
        flashTimerRef.current = null;
      }, 1200);
    }
  }, [displayDrivers]);

  React.useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  // Find Pole Position lap time in Qualifying
  const p1CarIndex = displayDrivers[0]?.carIndex;
  const p1BestLap = isQualy && p1CarIndex !== undefined ? (bestLapTimesRef.current[p1CarIndex] || displayDrivers[0]?.lap?.LastLapTimeInMS || 0) : 0;
  const poleTimeMs = isQualy && p1BestLap > 0 ? p1BestLap : 0;

  const formatTime = (ms?: number) => {
    if (!ms || ms <= 0) return t('live.noTime');
    const mins = Math.floor(ms / TIME_CONSTANTS.MS_PER_MINUTE);
    const secs = Math.floor((ms % TIME_CONSTANTS.MS_PER_MINUTE) / TIME_CONSTANTS.MS_PER_SECOND);
    const millis = ms % TIME_CONSTANTS.MS_PER_SECOND;
    return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const formatQualyDelta = (driverMs?: number) => {
    if (!driverMs || driverMs <= 0) return '';
    if (!poleTimeMs || driverMs === poleTimeMs) return 'POLE';
    const delta = (driverMs - poleTimeMs) / TIME_CONSTANTS.MS_PER_SECOND;
    return `+${delta.toFixed(3)}s`;
  };

  const formatDelta = (msPart?: number, minsPart?: number) => {
    if (msPart === undefined && minsPart === undefined) return '--';
    const totalMs = (minsPart || 0) * TIME_CONSTANTS.MS_PER_MINUTE + (msPart || 0);
    if (totalMs === 0) return t('live.leaderBadge');
    return `+${(totalMs / TIME_CONSTANTS.MS_PER_SECOND).toFixed(3)}s`;
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
        <span key="sg" className="driver-penalty-badge penalty-stopgo" title={t('live.badges.stopGoTitle')}>
          SG
        </span>
      );
    } else if (lap.NumUnservedDriveThroughPens && lap.NumUnservedDriveThroughPens > 0) {
      elements.push(
        <span key="dt" className="driver-penalty-badge penalty-drivethrough" title={t('live.badges.driveThroughTitle')}>
          DT
        </span>
      );
    }

    if (lap.Penalties && lap.Penalties > 0) {
      elements.push(
        <span key="pen" className="driver-penalty-badge penalty-time" title={t('live.badges.timePenaltyTitle', { seconds: lap.Penalties })}>
          +{lap.Penalties}s
        </span>
      );
    }

    const warnings = lap.CornerCuttingWarnings || lap.TotalWarnings || 0;
    if (warnings > 0) {
      elements.push(
        <span key="warn" className="driver-warning-badge" title={t('live.badges.warningsTitle', { count: warnings })}>
          {warnings}W
        </span>
      );
    }

    if (elements.length === 0) return null;
    return <>{elements}</>;
  };

  const getDriverStatusBadge = (status?: number, pitStatus?: number, resultStatus?: number) => {
    if (resultStatus === RESULT_STATUS.RETIRED) {
      return (
        <span className="driver-status-badge status-retired" title={t('live.penaltyTypes.retired')}>
          {t('live.statusRetired')}
        </span>
      );
    }
    if (resultStatus === RESULT_STATUS.DNF) {
      return (
        <span className="driver-status-badge status-dnf" title={t('live.statusDnf')}>
          {t('live.statusDnf')}
        </span>
      );
    }
    if (resultStatus === RESULT_STATUS.DSQ) {
      return (
        <span className="driver-status-badge status-dsq" title={t('live.penaltyTypes.disqualified')}>
          {t('live.statusDsq')}
        </span>
      );
    }
    if (resultStatus === RESULT_STATUS.NOT_CLASSIFIED) {
      return (
        <span className="driver-status-badge status-nc">
          {t('live.statusNc')}
        </span>
      );
    }
    if (resultStatus === RESULT_STATUS.FINISHED) {
      return (
        <span className="driver-status-badge status-finished">
          {t('live.statusFinished')}
        </span>
      );
    }

    if (pitStatus === PIT_STATUS.PITTING || pitStatus === PIT_STATUS.IN_PIT_AREA) {
      return (
        <span className="driver-status-badge status-pit">
          <Wrench size={10} style={{ display: 'inline', marginRight: '2px' }} /> {t('live.statusPit')}
        </span>
      );
    }
    if (status === DRIVER_STATUS.FLYING_LAP) {
      return (
        <span className="driver-status-badge status-hotlap">
          <Flame size={10} style={{ display: 'inline', marginRight: '2px' }} /> {t('live.statusHotlap')}
        </span>
      );
    }
    if (status === DRIVER_STATUS.OUT_LAP) {
      return <span className="driver-status-badge status-outlap">{t('live.statusOutlap')}</span>;
    }
    if (status === DRIVER_STATUS.IN_GARAGE) {
      return <span className="driver-status-badge status-garage">{t('live.statusGarage')}</span>;
    }
    return null;
  };

  // Split drivers into 2 parallel columns (P1-P11 on left, P12-P22 on right)
  const col1Drivers = displayDrivers.slice(0, 11);
  const col2Drivers = displayDrivers.slice(11);

  const renderDriverRow = (driver: ProcessedDriver, indexInCol: number, colIndex: number) => {
    const overallIndex = colIndex === 0 ? indexInCol : indexInCol + col1Drivers.length;
    const isSelected = driver.carIndex === selectedCarIndex;
    const teamColor = TEAM_COLORS[driver.teamId] || 'var(--border-subtle)';
    const compound = driver.carStatus?.VisualTyreCompound ? TYRE_COMPOUNDS[driver.carStatus.VisualTyreCompound] : undefined;
    const driverBestLap = bestLapTimesRef.current[driver.carIndex] || driver.lap?.LastLapTimeInMS || 0;
    const isEliminated = isQualy && ((isQ1 && driver.position > 15) || (isQ2 && driver.position > 10));
    const flashClass = posFlashMap[driver.carIndex] ? `tower-flash-${posFlashMap[driver.carIndex]}` : '';

    return (
      <React.Fragment key={driver.carIndex}>
        <div
          className={`leaderboard-tower-card ${driver.isPlayer ? 'is-player' : ''} ${isSelected ? 'is-selected' : ''} ${isEliminated ? 'is-eliminated' : ''} ${flashClass}`}
          onClick={() => onSelectCar(driver.carIndex)}
          style={{
            borderLeft: `4px solid ${teamColor}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, justifyContent: 'space-between' }}>
            {/* Position & Delta */}
            <div className="tower-pos mono" style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '45px' }}>
              <span style={{ fontWeight: 700 }}>P{driver.position}</span>
              {!isQualy && getGridDeltaBadge(driver.gridPosition, driver.position)}
            </div>

            {/* Driver Info */}
            <div className="tower-driver-info" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="tower-name" style={{ fontSize: '0.82rem' }}>{driver.name}</span>
                <span className="tower-number mono" style={{ fontSize: '0.68rem' }}>#{driver.raceNumber}</span>
                {driver.isPlayer && <span className="player-tag">{t('live.youChip')}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px', flexWrap: 'wrap' }}>
                {getDriverStatusBadge(driver.lap?.DriverStatus, driver.lap?.PitStatus, driver.lap?.ResultStatus)}
                {getPenaltyBadge(driver.lap)}
                {driver.telemetry2?.ActiveAeroMode === ACTIVE_AERO_MODES.STRAIGHT && (
                  <span
                    className="mono font-bold"
                    style={{
                      fontSize: '0.60rem',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: 'rgba(0, 242, 254, 0.2)',
                      color: '#00f2fe',
                      border: '1px solid rgba(0, 242, 254, 0.4)',
                    }}
                    title="Active Aero: Straight Mode (Low Drag)"
                  >
                    {t('live.activeAeroStraight')}
                  </span>
                )}
                {driver.telemetry2?.OvertakeActive === 1 && (
                  <span
                    className="mono font-bold"
                    style={{
                      fontSize: '0.60rem',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: 'rgba(255, 215, 0, 0.25)',
                      color: '#ffd700',
                      border: '1px solid rgba(255, 215, 0, 0.5)',
                    }}
                    title="Boost / Override Mode Active"
                  >
                    {t('live.boostActive')}
                  </span>
                )}
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
                    {overallIndex === 0
                      ? t('live.leaderBadge')
                      : driver.lap?.ResultStatus === RESULT_STATUS.RETIRED
                      ? t('live.statusRetired')
                      : driver.lap?.ResultStatus === RESULT_STATUS.DNF
                      ? t('live.statusDnf')
                      : driver.lap?.ResultStatus === RESULT_STATUS.DSQ
                      ? t('live.statusDsq')
                      : formatDelta(driver.lap?.DeltaToRaceLeaderMSPart, driver.lap?.DeltaToRaceLeaderMinutesPart)}
                  </div>
                  {overallIndex > 0 && !(driver.lap?.ResultStatus === RESULT_STATUS.RETIRED || driver.lap?.ResultStatus === RESULT_STATUS.DNF || driver.lap?.ResultStatus === RESULT_STATUS.DSQ) && driver.lap?.DeltaToCarInFrontMSPart !== undefined && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                      INT {formatDelta(driver.lap.DeltaToCarInFrontMSPart, driver.lap.DeltaToCarInFrontMinutesPart)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Elimination Zone Line for Qualifying */}
        {isEliminated && (
          <div className="elimination-line" style={{ margin: '2px 0' }}>
            <span>{t('live.eliminationCutoff')}</span>
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
          {isQualy
            ? t('live.qualifyingStandings')
            : t('live.raceLeaderboard')}
        </h3>
        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {t('live.carsCount', { count: displayDrivers.length })}
        </span>
      </div>

      {/* Dynamic Columns Grid (1 Column if <= 11 drivers, 2 Columns if > 11 drivers) */}
      <div className="tower-two-cols-grid" style={{ display: 'grid', gridTemplateColumns: col2Drivers.length > 0 ? 'repeat(2, 1fr)' : '1fr', gap: '1rem' }}>
        {/* Left Column: P1 to P11 (or all drivers if <= 11) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {col1Drivers.map((driver, idx) => renderDriverRow(driver, idx, 0))}
        </div>

        {col2Drivers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {col2Drivers.map((driver, idx) => renderDriverRow(driver, idx, 1))}
          </div>
        )}
      </div>
    </div>
  );
});

LeaderboardTower.displayName = 'LeaderboardTower';

