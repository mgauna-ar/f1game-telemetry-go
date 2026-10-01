import React from 'react';
import { Wrench } from 'lucide-react';
import { parseDriverName } from '../hooks/useTelemetry';
import { filterActiveLiveParticipants } from '../utils/driverFilter';
import { getTeamColor, RESULT_STATUS, PIT_STATUS, DEFAULT_PIT_STRATEGY_DEFAULTS } from '../constants/f1';
import { TyreCompoundBadge } from './common/TyreCompoundBadge';
import type { ParticipantData, LapData, CarStatusData, SessionData } from '../types/telemetry';
import { useI18n } from '../context/I18nContext';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import { styleVars } from '../styles/theme';
import { Badge } from './ui/Badge';
import { cx } from './ui/cx';
import { DataTable } from './ui/DataTable';
import { Panel, PanelHeader } from './ui/Panel';
import styles from './LivePitStrategy.module.css';

interface KpiProps {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  tone?: 'open' | 'rejoin' | 'driver';
}

/** One figure of the pit window strip: a label, the value and a short note. */
const Kpi: React.FC<KpiProps> = ({ label, value, sub, tone }) => (
  <dl className={styles.kpi}>
    <dt className={styles.kpiLabel}>{label}</dt>
    <dd className={styles.kpiValue} data-tone={tone}>
      {value}
    </dd>
    <dd className={styles.kpiSub}>{sub}</dd>
  </dl>
);

interface LivePitStrategyProps {
  className?: string;
  session?: SessionData | null;
  participants?: ParticipantData[];
  laps?: LapData[];
  carStatuses?: CarStatusData[];
  selectedCarIndex?: number;
  playerCarIndex?: number;
  onSelectCar?: (index: number) => void;
}

export const LivePitStrategy: React.FC<LivePitStrategyProps> = React.memo((props) => {
  const storeSession = useSessionStatusStore((s) => s.session);
  const storeParticipants = useSessionStatusStore((s) => s.participants);
  const storeLaps = useTelemetryDataStore((s) => s.allLaps);
  const storeCarStatuses = useTelemetryDataStore((s) => s.allCarStatus);
  const storePlayerCarIndex = useTelemetryDataStore((s) => s.playerCarIndex);
  const storeSelectedCarIndex = useTelemetryDataStore((s) => s.selectedCarIndex);
  const setSelectedCarIndex = useTelemetryDataStore((s) => s.setSelectedCarIndex);

  const session = props.session !== undefined ? props.session : storeSession;
  const participants = props.participants !== undefined ? props.participants : storeParticipants;
  const laps = props.laps !== undefined ? props.laps : storeLaps;
  const carStatuses = props.carStatuses !== undefined ? props.carStatuses : storeCarStatuses;
  const playerCarIndex = props.playerCarIndex !== undefined ? props.playerCarIndex : storePlayerCarIndex;
  const selectedCarIndex = props.selectedCarIndex !== undefined ? props.selectedCarIndex : storeSelectedCarIndex;
  const onSelectCar = props.onSelectCar !== undefined ? props.onSelectCar : setSelectedCarIndex;

  const { t } = useI18n();

  const idealLap = session?.PitStopWindowIdealLap || DEFAULT_PIT_STRATEGY_DEFAULTS.IDEAL_LAP;
  const latestLap = session?.PitStopWindowLatestLap || DEFAULT_PIT_STRATEGY_DEFAULTS.LATEST_LAP;
  const rejoinPos = session?.PitStopRejoinPosition || DEFAULT_PIT_STRATEGY_DEFAULTS.REJOIN_POSITION;
  const currentLeaderLap = Math.max(...laps.map((l) => l?.CurrentLapNum || 0), 1);

  // Check if current lap is inside the pit stop window
  const isWindowOpen = currentLeaderLap >= idealLap && currentLeaderLap <= latestLap;

  // Build sorted field data for active drivers
  const activeParticipants = filterActiveLiveParticipants(participants, laps, playerCarIndex);

  const drivers = activeParticipants.map(({ participant: p, carIndex: idx }) => {
    const lap = laps[idx];
    const status = carStatuses[idx];
    const rawName = p.Name;
    const defaultName = p.RaceNumber ? `Driver #${p.RaceNumber}` : t('live.events.car', { number: idx + 1 });
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
  const selectedDriver = drivers.find((d) => d.isSelected);

  const getPitStatusBadge = (pitStatus?: number, timerMs?: number, timeInLaneMs?: number, resultStatus?: number) => {
    const resultKey =
      resultStatus === RESULT_STATUS.RETIRED
        ? 'live.statusRetired'
        : resultStatus === RESULT_STATUS.DNF
          ? 'live.statusDnf'
          : resultStatus === RESULT_STATUS.DSQ
            ? 'live.statusDsq'
            : undefined;
    if (resultKey) {
      return (
        <Badge tone="danger" size="xs" square>
          {t(resultKey)}
        </Badge>
      );
    }
    if (pitStatus === PIT_STATUS.PITTING) {
      return (
        <Badge tone="warning" size="xs" square icon={<span className={styles.liveDot} aria-hidden="true" />}>
          {t('live.pitLane')} {timeInLaneMs ? `(${(timeInLaneMs / 1000).toFixed(1)}s)` : ''}
        </Badge>
      );
    }
    if (pitStatus === PIT_STATUS.IN_PIT_AREA) {
      return (
        <Badge tone="danger" size="xs" square icon={<span className={styles.liveDot} aria-hidden="true" />}>
          {t('live.inBox')} {timerMs ? `(${(timerMs / 1000).toFixed(1)}s)` : ''}
        </Badge>
      );
    }
    return <span className={`mono ${styles.trackStatus}`}>{t('live.trackStatus')}</span>;
  };

  const activePitsCount = laps.filter(
    (l) => l && (l.PitStatus === PIT_STATUS.PITTING || l.PitStatus === PIT_STATUS.IN_PIT_AREA)
  ).length;

  return (
    <Panel className={props.className}>
      <PanelHeader
        icon={<Wrench size={16} />}
        title={t('live.pitStrategyTitle')}
        subtitle={t('live.pitStrategySub')}
        actions={
          activePitsCount > 0 && (
            <Badge tone="warning" icon={<span className={styles.liveDot} aria-hidden="true" />}>
              {t('live.pittingNow', { count: activePitsCount })}
            </Badge>
          )
        }
      />

      {/* Pit window strip */}
      <div className={styles.kpis}>
        <Kpi
          label={t('live.estimatedPitWindow')}
          value={t('live.lapRange', { ideal: idealLap, latest: latestLap })}
          tone={isWindowOpen ? 'open' : undefined}
          sub={
            isWindowOpen
              ? t('live.windowOpenNow')
              : currentLeaderLap < idealLap
                ? t('live.windowOpensIn', { count: idealLap - currentLeaderLap })
                : t('live.windowClosed')
          }
        />
        <Kpi label={t('live.predictedRejoin')} value={`P${rejoinPos}`} tone="rejoin" sub={t('live.cleanAirEstimate')} />
        <Kpi
          label={t('live.selectedDriver')}
          value={selectedDriver?.name ?? '—'}
          tone="driver"
          sub={t('live.stopsMade', { count: selectedDriver?.lap?.NumPitStops || 0 })}
        />
      </div>

      {/* Field Tyre & Pit Matrix Table */}
      <DataTable
        className={styles.matrix}
        caption={t('live.pitMatrixCaption')}
        density="compact"
        stickyHeader
        rows={drivers}
        getRowKey={(d) => d.carIndex}
        getRowClassName={(d) => cx(d.isSelected && styles.selectedRow, d.isPlayer && styles.playerRow)}
        onRowClick={(d) => onSelectCar(d.carIndex)}
        columns={[
          {
            key: 'pos',
            header: t('live.thPos'),
            width: '42px',
            align: 'center',
            numeric: true,
            cell: (d) => (
              <span className={styles.pos} data-podium={d.position <= 3}>
                P{d.position}
              </span>
            ),
          },
          {
            key: 'driver',
            header: t('live.thDriver'),
            rowHeader: true,
            cell: (d) => (
              <div className={styles.driver} style={styleVars({ '--team-color': getTeamColor(d.teamId) })}>
                <span className={styles.teamBar} aria-hidden="true" />
                {/* The row is also clickable; this button is its keyboard and screen reader equivalent */}
                <button
                  type="button"
                  className={`button-reset ${styles.driverName}`}
                  aria-pressed={d.isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCar(d.carIndex);
                  }}
                >
                  {d.name}
                </button>
                {d.isPlayer && (
                  <Badge tone="you" size="xs" square>
                    {t('live.youChip')}
                  </Badge>
                )}
              </div>
            ),
          },
          {
            key: 'tyre',
            header: t('live.thTyre'),
            width: '70px',
            align: 'center',
            // No compound yet: a grey "?" rather than a guess
            cell: (d) =>
              d.status?.VisualTyreCompound ? (
                <TyreCompoundBadge compound={d.status.VisualTyreCompound} />
              ) : (
                <TyreCompoundBadge compound="?" title={t('live.badges.unknownCompoundTitle')} />
              ),
          },
          {
            key: 'age',
            header: t('live.thAge'),
            width: '75px',
            align: 'center',
            numeric: true,
            cell: (d) => {
              const tyreAge = d.status?.TyresAgeLaps ?? 0;
              return (
                <span className={styles.tyreAge} data-wear={tyreAge > 20 ? 'old' : tyreAge > 12 ? 'worn' : undefined}>
                  {tyreAge} L
                </span>
              );
            },
          },
          {
            key: 'stops',
            header: t('live.thStops'),
            width: '65px',
            align: 'center',
            numeric: true,
            cell: (d) => d.lap?.NumPitStops ?? 0,
          },
          {
            key: 'status',
            header: t('live.thStatus'),
            width: '130px',
            align: 'right',
            cell: (d) =>
              getPitStatusBadge(
                d.lap?.PitStatus,
                d.lap?.PitStopTimerInMS,
                d.lap?.PitLaneTimeInLaneInMS,
                d.lap?.ResultStatus
              ),
          },
        ]}
      />
    </Panel>
  );
});

LivePitStrategy.displayName = 'LivePitStrategy';
