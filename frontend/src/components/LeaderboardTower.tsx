import React from 'react';
import { Trophy, Wrench, Flame } from 'lucide-react';
import { parseDriverName } from '../hooks/useTelemetry';
import { filterActiveLiveParticipants } from '../utils/driverFilter';
import type { ParticipantData, LapData, CarStatusData, SessionData, CarTelemetry2Data } from '../types/telemetry';
import {
  getTeamColor,
  SESSION_TYPES,
  RESULT_STATUS,
  PIT_STATUS,
  DRIVER_STATUS,
  ACTIVE_AERO_MODES,
  TIME_CONSTANTS,
  LEADERBOARD_COLUMN_SPLIT,
  getQualifyingCutoffPosition,
} from '../constants/f1';
import { useI18n } from '../context/I18nContext';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import { styleVars } from '../styles/theme';
import { TyreCompoundBadge } from './common/TyreCompoundBadge';
import { Badge, type BadgeTone } from './ui/Badge';
import { Panel, PanelHeader } from './ui/Panel';
import styles from './LeaderboardTower.module.css';

const DRIVER_STATUS_LABELS: Record<number, string> = {
  [RESULT_STATUS.RETIRED]: 'live.statusRetired',
  [RESULT_STATUS.DNF]: 'live.statusDnf',
  [RESULT_STATUS.DSQ]: 'live.statusDsq',
};

const getDriverDeltaLabel = (
  driver: ProcessedDriver,
  overallIndex: number,
  formatDeltaFn: (ms?: number, minutes?: number) => string,
  t: (key: string, params?: Record<string, string | number>) => string
): string => {
  if (overallIndex === 0) return t('live.leaderBadge');
  const statusKey = driver.lap?.ResultStatus !== undefined ? DRIVER_STATUS_LABELS[driver.lap.ResultStatus] : undefined;
  if (statusKey) return t(statusKey);
  return formatDeltaFn(driver.lap?.DeltaToRaceLeaderMSPart, driver.lap?.DeltaToRaceLeaderMinutesPart);
};

interface LeaderboardTowerProps {
  className?: string;
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
  const isQualy =
    session?.SessionType !== undefined &&
    ((session.SessionType >= SESSION_TYPES.Q1 && session.SessionType <= SESSION_TYPES.OSQ) ||
      (session.SessionType >= SESSION_TYPES.SPRINT_Q1 && session.SessionType <= SESSION_TYPES.OS_SPRINT_Q));

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
      const defaultName = p.RaceNumber ? `Driver #${p.RaceNumber}` : t('live.events.car', { number: idx + 1 });
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

    const result: ProcessedDriver[] =
      drivers.length > 0
        ? drivers
        : [
            {
              carIndex: 0,
              position: laps[0]?.CarPosition || 1,
              gridPosition: laps[0]?.GridPosition || 1,
              name: 'Player Car',
              raceNumber: 1,
              teamId: 0,
              aiControlled: false,
              lap: laps[0],
              carStatus: carStatuses[0],
              telemetry2: telemetry2List?.[0],
              isPlayer: true,
            },
          ];

    // Sort drivers
    if (isQualy) {
      result.sort((a, b) => {
        const timeA = effectiveBestTimes[a.carIndex] || a.lap?.LastLapTimeInMS || 0;
        const timeB = effectiveBestTimes[b.carIndex] || b.lap?.LastLapTimeInMS || 0;
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
        const isRetA =
          resA === RESULT_STATUS.RETIRED || resA === RESULT_STATUS.DNF || resA === RESULT_STATUS.NOT_CLASSIFIED;
        const isRetB =
          resB === RESULT_STATUS.RETIRED || resB === RESULT_STATUS.DNF || resB === RESULT_STATUS.NOT_CLASSIFIED;
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
  }, [participants, laps, carStatuses, telemetry2List, playerCarIndex, isQualy, sessionKey, t]);

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
  const p1BestLap =
    isQualy && p1CarIndex !== undefined
      ? bestLapTimesRef.current[p1CarIndex] || displayDrivers[0]?.lap?.LastLapTimeInMS || 0
      : 0;
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
    const movedTitle = t('live.badges.gridDeltaTitle', { grid: gridPos, now: curPos });
    if (delta > 0) {
      return (
        <Badge tone="success" size="xs" square title={movedTitle}>
          ▲{delta}
        </Badge>
      );
    }
    if (delta < 0) {
      return (
        <Badge tone="danger" size="xs" square title={movedTitle}>
          ▼{Math.abs(delta)}
        </Badge>
      );
    }
    return (
      <Badge size="xs" square title={t('live.badges.gridSameTitle', { grid: gridPos })}>
        =
      </Badge>
    );
  };

  const getPenaltyBadge = (lap?: LapData) => {
    if (!lap) return null;
    const elements: React.ReactNode[] = [];

    if (lap.NumUnservedStopGoPens && lap.NumUnservedStopGoPens > 0) {
      elements.push(
        <Badge key="sg" tone="orange" size="xs" square title={t('live.badges.stopGoTitle')}>
          SG
        </Badge>
      );
    } else if (lap.NumUnservedDriveThroughPens && lap.NumUnservedDriveThroughPens > 0) {
      elements.push(
        <Badge key="dt" tone="orange" size="xs" square title={t('live.badges.driveThroughTitle')}>
          DT
        </Badge>
      );
    }

    if (lap.Penalties && lap.Penalties > 0) {
      elements.push(
        <Badge
          key="pen"
          tone="danger"
          size="xs"
          square
          title={t('live.badges.timePenaltyTitle', { seconds: lap.Penalties })}
        >
          +{lap.Penalties}s
        </Badge>
      );
    }

    const warnings = lap.CornerCuttingWarnings || lap.TotalWarnings || 0;
    if (warnings > 0) {
      elements.push(
        <Badge key="warn" tone="warning" size="xs" square title={t('live.badges.warningsTitle', { count: warnings })}>
          {warnings}W
        </Badge>
      );
    }

    if (elements.length === 0) return null;
    return <>{elements}</>;
  };

  const getDriverStatusBadge = (status?: number, pitStatus?: number, resultStatus?: number) => {
    const badge = (tone: BadgeTone, label: string, title?: string, icon?: React.ReactNode) => (
      <Badge tone={tone} size="xs" square title={title} icon={icon}>
        {label}
      </Badge>
    );

    if (resultStatus === RESULT_STATUS.RETIRED) {
      return badge('danger', t('live.statusRetired'), t('live.penaltyTypes.retired'));
    }
    if (resultStatus === RESULT_STATUS.DNF) return badge('danger', t('live.statusDnf'), t('live.statusDnf'));
    if (resultStatus === RESULT_STATUS.DSQ) {
      return badge('danger', t('live.statusDsq'), t('live.penaltyTypes.disqualified'));
    }
    if (resultStatus === RESULT_STATUS.NOT_CLASSIFIED) return badge('neutral', t('live.statusNc'));
    if (resultStatus === RESULT_STATUS.FINISHED) return badge('success', t('live.statusFinished'));

    if (pitStatus === PIT_STATUS.PITTING || pitStatus === PIT_STATUS.IN_PIT_AREA) {
      return badge('warning', t('live.statusPit'), undefined, <Wrench size={10} aria-hidden="true" />);
    }
    if (status === DRIVER_STATUS.FLYING_LAP) {
      return badge('danger', t('live.statusHotlap'), undefined, <Flame size={10} aria-hidden="true" />);
    }
    if (status === DRIVER_STATUS.OUT_LAP) return badge('info', t('live.statusOutlap'));
    if (status === DRIVER_STATUS.IN_GARAGE) return badge('neutral', t('live.statusGarage'));
    return null;
  };

  // Last position that goes through to the next qualifying segment (null when nobody is knocked out)
  const cutoffPosition = getQualifyingCutoffPosition(session?.SessionType, displayDrivers.length);

  // Split drivers into 2 parallel columns (P1-P11 on left, P12-P22 on right)
  const col1Drivers = displayDrivers.slice(0, LEADERBOARD_COLUMN_SPLIT);
  const col2Drivers = displayDrivers.slice(LEADERBOARD_COLUMN_SPLIT);

  const renderColumn = (drivers: ProcessedDriver[], offset: number) => (
    <ol className={styles.column} start={offset + 1}>
      {drivers.map((driver, idx) => (
        <DriverRow
          key={driver.carIndex}
          driver={driver}
          overallIndex={idx + offset}
          isSelected={driver.carIndex === selectedCarIndex}
          teamColor={getTeamColor(driver.teamId)}
          driverBestLap={bestLapTimesRef.current[driver.carIndex] || driver.lap?.LastLapTimeInMS || 0}
          isEliminated={cutoffPosition !== null && driver.position > cutoffPosition}
          isLastBeforeCutoff={driver.position === cutoffPosition}
          flash={posFlashMap[driver.carIndex]}
          isQualy={isQualy}
          onSelectCar={onSelectCar}
          getGridDeltaBadge={getGridDeltaBadge}
          getDriverStatusBadge={getDriverStatusBadge}
          getPenaltyBadge={getPenaltyBadge}
          formatDelta={formatDelta}
          formatQualyDelta={formatQualyDelta}
          formatTime={formatTime}
          t={t}
        />
      ))}
    </ol>
  );

  return (
    <Panel className={props.className}>
      <PanelHeader
        icon={<Trophy size={18} color="var(--accent-primary)" />}
        title={isQualy ? t('live.qualifyingStandings') : t('live.raceLeaderboard')}
        actions={<span className={styles.count}>{t('live.carsCount', { count: displayDrivers.length })}</span>}
      />

      {/* One column up to 11 cars (P1-P11), a second for P12 onwards */}
      <div className={styles.columns} data-columns={col2Drivers.length > 0 ? 2 : 1}>
        {renderColumn(col1Drivers, 0)}
        {col2Drivers.length > 0 && renderColumn(col2Drivers, col1Drivers.length)}
      </div>
    </Panel>
  );
});

interface DriverRowProps {
  driver: ProcessedDriver;
  overallIndex: number;
  isSelected: boolean;
  teamColor: string;
  driverBestLap: number;
  isEliminated: boolean;
  /** Draws the elimination cut-off line under this row. */
  isLastBeforeCutoff: boolean;
  /** Set for a moment after the car gains or loses a position. */
  flash?: 'up' | 'down';
  isQualy: boolean;
  onSelectCar: (carIndex: number) => void;
  getGridDeltaBadge: (gridPos: number, currentPos: number) => React.ReactNode;
  getDriverStatusBadge: (status?: number, pitStatus?: number, resultStatus?: number) => React.ReactNode;
  getPenaltyBadge: (lap?: LapData) => React.ReactNode;
  formatDelta: (ms?: number, minutes?: number) => string;
  formatQualyDelta: (bestLapMs: number) => string;
  formatTime: (ms: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const DriverRow: React.FC<DriverRowProps> = React.memo(
  ({
    driver,
    overallIndex,
    isSelected,
    teamColor,
    driverBestLap,
    isEliminated,
    isLastBeforeCutoff,
    flash,
    isQualy,
    onSelectCar,
    getGridDeltaBadge,
    getDriverStatusBadge,
    getPenaltyBadge,
    formatDelta,
    formatQualyDelta,
    formatTime,
    t,
  }) => {
    const isLeader = overallIndex === 0;
    const isOut =
      driver.lap?.ResultStatus === RESULT_STATUS.RETIRED ||
      driver.lap?.ResultStatus === RESULT_STATUS.DNF ||
      driver.lap?.ResultStatus === RESULT_STATUS.DSQ;
    const compound = driver.carStatus?.VisualTyreCompound;

    return (
      <li>
        <button
          type="button"
          className={`button-reset ${styles.card}`}
          aria-pressed={isSelected}
          data-player={driver.isPlayer || undefined}
          data-eliminated={isEliminated || undefined}
          data-flash={flash}
          onClick={() => onSelectCar(driver.carIndex)}
          style={styleVars({ '--team-color': teamColor })}
        >
          {/* Position and places gained since the start */}
          <span className={styles.pos}>
            P{driver.position}
            {!isQualy && getGridDeltaBadge(driver.gridPosition, driver.position)}
          </span>

          <span className={styles.driver}>
            <span className={styles.nameRow}>
              <span className={styles.name}>{driver.name}</span>
              <span className={styles.number}>#{driver.raceNumber}</span>
              {driver.isPlayer && <span className={styles.playerTag}>{t('live.youChip')}</span>}
            </span>
            <span className={styles.badges}>
              {getDriverStatusBadge(driver.lap?.DriverStatus, driver.lap?.PitStatus, driver.lap?.ResultStatus)}
              {getPenaltyBadge(driver.lap)}
              {driver.telemetry2?.ActiveAeroMode === ACTIVE_AERO_MODES.STRAIGHT && (
                <Badge tone="accent" size="xs" square title={t('live.badges.activeAeroTitle')}>
                  {t('live.activeAeroStraight')}
                </Badge>
              )}
              {driver.telemetry2?.OvertakeActive === 1 && (
                <Badge color="var(--f1-yellow)" size="xs" square title={t('live.badges.boostTitle')}>
                  {t('live.boostActive')}
                </Badge>
              )}
            </span>
          </span>

          {/* Tyre compound and age */}
          <span className={styles.tyre}>
            {compound ? (
              <>
                <TyreCompoundBadge compound={compound} size="md" />
                <span className={styles.tyreAge}>{driver.carStatus?.TyresAgeLaps || 0}L</span>
              </>
            ) : (
              <span className={styles.noTyre}>-</span>
            )}
          </span>

          {/* Best lap and gap to pole in qualifying; gap to the leader and interval in a race */}
          <span className={styles.time}>
            {isQualy ? (
              <>
                <span className={styles.timeMain} data-muted={!(driverBestLap > 0)}>
                  {formatTime(driverBestLap)}
                </span>
                {driverBestLap > 0 && (
                  <span className={styles.timeSub} data-leader={isLeader}>
                    {formatQualyDelta(driverBestLap)}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className={styles.timeMain} data-leader={isLeader}>
                  {getDriverDeltaLabel(driver, overallIndex, formatDelta, t)}
                </span>
                {!isLeader && !isOut && driver.lap?.DeltaToCarInFrontMSPart !== undefined && (
                  <span className={styles.timeSub}>
                    INT {formatDelta(driver.lap.DeltaToCarInFrontMSPart, driver.lap.DeltaToCarInFrontMinutesPart)}
                  </span>
                )}
              </>
            )}
          </span>
        </button>

        {/* Qualifying cut-off between the last car through and the first one out */}
        {isLastBeforeCutoff && (
          <div className={styles.cutoff} data-testid="elimination-line">
            <span>{t('live.eliminationCutoff')}</span>
          </div>
        )}
      </li>
    );
  }
);

DriverRow.displayName = 'DriverRow';
