import React from 'react';
import { Wrench } from 'lucide-react';
import { parseDriverName } from '../hooks/useTelemetry';
import { filterActiveLiveParticipants } from '../utils/driverFilter';
import {
  getTeamColor,
  RESULT_STATUS,
  PIT_STATUS,
  TYRE_COMPOUND_IDS,
  DEFAULT_PIT_STRATEGY_DEFAULTS,
} from '../constants/f1';
import { TyreCompoundBadge } from './common/TyreCompoundBadge';
import type { ParticipantData, LapData, CarStatusData, SessionData } from '../types/telemetry';
import { useI18n } from '../context/I18nContext';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import { cx } from './ui/cx';
import { DataTable } from './ui/DataTable';
import { Panel, PanelHeader } from './ui/Panel';

interface LivePitStrategyProps {
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

  const getPitStatusBadge = (pitStatus?: number, timerMs?: number, timeInLaneMs?: number, resultStatus?: number) => {
    if (resultStatus === RESULT_STATUS.RETIRED) {
      return (
        <span className="pit-badge-lane mono" style={{ color: '#FF4D4D', borderColor: 'rgba(255, 77, 77, 0.4)' }}>
          {t('live.statusRetired')}
        </span>
      );
    }
    if (resultStatus === RESULT_STATUS.DNF) {
      return (
        <span className="pit-badge-lane mono" style={{ color: '#FF4D4D', borderColor: 'rgba(255, 77, 77, 0.4)' }}>
          {t('live.statusDnf')}
        </span>
      );
    }
    if (resultStatus === RESULT_STATUS.DSQ) {
      return (
        <span className="pit-badge-lane mono" style={{ color: '#FF3333', borderColor: 'rgba(255, 51, 51, 0.6)' }}>
          {t('live.statusDsq')}
        </span>
      );
    }
    if (pitStatus === PIT_STATUS.PITTING) {
      return (
        <span className="pit-badge-lane mono">
          <span className="pit-live-dot" />
          {t('live.pitLane')} {timeInLaneMs ? `(${(timeInLaneMs / 1000).toFixed(1)}s)` : ''}
        </span>
      );
    }
    if (pitStatus === PIT_STATUS.IN_PIT_AREA) {
      return (
        <span className="pit-badge-box mono">
          <span className="pit-live-dot box" />
          {t('live.inBox')} {timerMs ? `(${(timerMs / 1000).toFixed(1)}s)` : ''}
        </span>
      );
    }
    return <span className="pit-badge-track mono">{t('live.trackStatus')}</span>;
  };

  const activePitsCount = laps.filter((l) => l && (l.PitStatus === PIT_STATUS.PITTING || l.PitStatus === PIT_STATUS.IN_PIT_AREA)).length;

  return (
    <Panel className="race-hub-card live-pit-strategy-panel">
      <PanelHeader
        icon={<Wrench size={16} color="var(--accent-primary)" />}
        title={t('live.pitStrategyTitle')}
        subtitle={t('live.pitStrategySub')}
        actions={
          activePitsCount > 0 && (
            <span className="active-pits-pill mono">
              <span className="pit-live-dot" />
              {t('live.pittingNow', { count: activePitsCount })}
            </span>
          )
        }
      />

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
      <DataTable
        className="pit-matrix-table-container"
        caption={t('live.pitMatrixCaption')}
        density="compact"
        stickyHeader
        rows={drivers}
        getRowKey={(d) => d.carIndex}
        getRowClassName={(d) => cx('pit-matrix-row', d.isSelected && 'selected', d.isPlayer && 'player')}
        onRowClick={(d) => onSelectCar(d.carIndex)}
        columns={[
          {
            key: 'pos',
            header: t('live.thPos'),
            width: '42px',
            align: 'center',
            numeric: true,
            cell: (d) => <span className={cx('pit-pos', d.position <= 3 && 'is-podium')}>P{d.position}</span>,
          },
          {
            key: 'driver',
            header: t('live.thDriver'),
            rowHeader: true,
            cell: (d) => (
              <div className="pit-driver-cell">
                <span className="team-color-indicator" style={{ backgroundColor: getTeamColor(d.teamId) }} />
                {/* The row is also clickable; this button is its keyboard and screen reader equivalent */}
                <button
                  type="button"
                  className="button-reset pit-driver-name"
                  aria-pressed={d.isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCar(d.carIndex);
                  }}
                >
                  {d.name}
                </button>
                {d.isPlayer && <span className="player-indicator-chip">{t('live.youChip')}</span>}
              </div>
            ),
          },
          {
            key: 'tyre',
            header: t('live.thTyre'),
            width: '70px',
            align: 'center',
            cell: (d) => <TyreCompoundBadge compound={d.status?.VisualTyreCompound ?? TYRE_COMPOUND_IDS.MEDIUM} />,
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
                <span className={cx('pit-tyre-age', tyreAge > 20 && 'is-old', tyreAge > 12 && tyreAge <= 20 && 'is-worn')}>
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
              getPitStatusBadge(d.lap?.PitStatus, d.lap?.PitStopTimerInMS, d.lap?.PitLaneTimeInLaneInMS, d.lap?.ResultStatus),
          },
        ]}
      />
    </Panel>
  );
});

LivePitStrategy.displayName = 'LivePitStrategy';

