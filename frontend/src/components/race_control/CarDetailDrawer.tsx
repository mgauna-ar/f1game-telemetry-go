import React, { useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionStatusStore } from '../../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../../store/useTelemetryDataStore';
import { parseDriverName } from '../../store/useTelemetryStore';
import { useLiveCarLaps } from '../../hooks/useLiveCarLaps';
import { PIT_STATUS, TIME_CONSTANTS, getTeamColor, isRaceSession } from '../../constants/f1';
import { sessionBestSectors } from '../../utils/raceControl';
import { formatGapTime, formatLapTime, formatSectorTime } from '../../utils/formatters';
import { styleVars } from '../../styles/theme';
import type { LiveCarLaps } from '../../types/telemetry';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { IconButton } from '../ui/Button';
import { SKIP_AUTOFOCUS_ATTRIBUTE, useDialogLayer } from '../ui/useDialogLayer';
import styles from './CarDetailDrawer.module.css';

interface CarDetailDrawerProps {
  /** The car to show, or null when the drawer is closed. */
  carIndex: number | null;
  onClose: () => void;
}

/**
 * A side panel with one car's race: where it is now, its tyre stints and every completed lap with
 * its sectors (from the game's session history). The page stays usable around it, so picking
 * another car in the tower switches the drawer to that car.
 */
export const CarDetailDrawer: React.FC<CarDetailDrawerProps> = ({ carIndex, onClose }) => {
  const isOpen = carIndex !== null;
  const panelRef = useRef<HTMLElement | null>(null);
  useDialogLayer({ isOpen, onClose, containerRef: panelRef });
  if (!isOpen) return null;
  return (
    <aside ref={panelRef} className={styles.drawer} role="dialog" aria-labelledby={`car-drawer-${carIndex}`}>
      <DrawerContent carIndex={carIndex} onClose={onClose} />
    </aside>
  );
};

const DrawerContent: React.FC<{ carIndex: number; onClose: () => void }> = ({ carIndex, onClose }) => {
  const { t } = useI18n();
  const session = useSessionStatusStore((s) => s.session);
  const participant = useSessionStatusStore((s) => s.participants[carIndex]);
  const lap = useTelemetryDataStore((s) => s.allLaps[carIndex]);
  const status = useTelemetryDataStore((s) => s.allCarStatus[carIndex]);
  const bestLapMs = useTelemetryDataStore((s) => s.bestLapTimes[carIndex] ?? 0);
  const isPlayer = useTelemetryDataStore((s) => s.playerCarIndex === carIndex);
  const lapTimes = useTelemetryDataStore((s) => s.allLapTimes);
  const { data, failed } = useLiveCarLaps(carIndex);

  const name = parseDriverName(participant?.Name, t('live.events.car', { number: carIndex + 1 }), participant?.DriverId);
  const isRace = isRaceSession(session?.SessionType);
  const gapToLeader = lap
    ? lap.DeltaToRaceLeaderMinutesPart * TIME_CONSTANTS.MS_PER_MINUTE + lap.DeltaToRaceLeaderMSPart
    : 0;
  const sessionBests = sessionBestSectors(lapTimes).map((b) => b.time);

  return (
    <>
      <header className={styles.head} style={styleVars({ '--team-color': getTeamColor(participant?.TeamId) })}>
        <span className={styles.pos}>P{lap?.CarPosition || '–'}</span>
        <div className={styles.identity}>
          <h2 id={`car-drawer-${carIndex}`} className={styles.name}>
            {name}
            {isPlayer && <span className={styles.you}>{t('live.youChip')}</span>}
          </h2>
          {participant?.RaceNumber ? <p className={styles.number}>#{participant.RaceNumber}</p> : null}
        </div>
        <IconButton size="sm" label={t('live.raceControlView.closeCar')} onClick={onClose} {...{ [SKIP_AUTOFOCUS_ATTRIBUTE]: true }}>
          <X size={16} />
        </IconButton>
      </header>

      <div className={styles.scroll}>
        <dl className={styles.stats} aria-label={t('live.raceControlView.carNow')}>
          <div>
            <dt>{t('live.driver.lastLap')}</dt>
            <dd>{formatLapTime(lap?.LastLapTimeInMS ?? 0)}</dd>
          </div>
          <div>
            <dt>{t('live.driver.bestLap')}</dt>
            <dd>{formatLapTime(bestLapMs)}</dd>
          </div>
          {isRace && (
            <div>
              <dt>{t('live.raceControlView.gapToLeader')}</dt>
              <dd>{lap?.CarPosition === 1 ? t('live.raceControlView.leader') : formatGapTime(gapToLeader)}</dd>
            </div>
          )}
          <div>
            <dt>{t('live.driver.tyres')}</dt>
            <dd className={styles.tyre}>
              {status && <TyreCompoundBadge compound={status.VisualTyreCompound} />}
              {status ? t('live.driver.tyreAge', { laps: status.TyresAgeLaps }) : '–'}
            </dd>
          </div>
          <div>
            <dt>{t('live.raceControlView.pitStops')}</dt>
            <dd>
              {lap?.NumPitStops ?? 0}
              {lap && lap.PitStatus !== PIT_STATUS.NONE && <span className={styles.inPit}>{t('live.pitLane')}</span>}
            </dd>
          </div>
          {lap && lap.Penalties > 0 && (
            <div>
              <dt>{t('live.raceControlView.penalties')}</dt>
              <dd className={styles.penalty}>+{lap.Penalties}s</dd>
            </div>
          )}
        </dl>

        <LapHistory data={data} failed={failed} sessionBests={sessionBests} />
      </div>
    </>
  );
};

interface LapHistoryProps {
  data: LiveCarLaps | null;
  failed: boolean;
  /** The session's best S1, S2 and S3 in ms (0 when not set). */
  sessionBests: number[];
}

/** The car's stints and completed laps, newest first. Session-best sectors are purple, personal bests green. */
const LapHistory: React.FC<LapHistoryProps> = ({ data, failed, sessionBests }) => {
  const { t } = useI18n();
  const stintsId = useId();
  const lapsId = useId();
  if (!data) {
    return <p className={styles.note}>{failed ? t('live.raceControlView.lapsFailed') : t('live.raceControlView.lapsLoading')}</p>;
  }

  const laps = [...data.laps].reverse();
  const sectorKind = (lapNum: number, sector: number, ms: number) =>
    ms > 0 && sessionBests[sector] > 0 && ms <= sessionBests[sector]
      ? 'session'
      : data.best_sector_lap_nums[sector] === lapNum
        ? 'personal'
        : undefined;

  return (
    <>
      {data.stints.length > 0 && (
        <section aria-labelledby={stintsId}>
          <h3 id={stintsId} className={styles.sectionTitle}>
            {t('live.raceControlView.stints')}
          </h3>
          <ol className={styles.stints}>
            {data.stints.map((stint, i) => {
              const from = i === 0 ? 1 : (data.stints[i - 1].end_lap ?? 0) + 1;
              return (
                <li key={i} className={styles.stint}>
                  <TyreCompoundBadge compound={stint.visual_compound} />
                  {stint.end_lap === null
                    ? t('live.raceControlView.stintRunning', { from })
                    : t('live.raceControlView.stintLaps', { from, to: stint.end_lap })}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section aria-labelledby={lapsId}>
        <h3 id={lapsId} className={styles.sectionTitle}>
          {t('live.raceControlView.laps')}
        </h3>
        {laps.length === 0 ? (
          <p className={styles.note}>{t('live.raceControlView.noLaps')}</p>
        ) : (
          <table className={styles.laps}>
            <thead>
              <tr>
                <th scope="col">{t('live.raceControlView.lapColumn')}</th>
                <th scope="col">{t('live.raceControlView.timeColumn')}</th>
                <th scope="col">S1</th>
                <th scope="col">S2</th>
                <th scope="col">S3</th>
              </tr>
            </thead>
            <tbody>
              {laps.map((l) => (
                <tr key={l.lap} data-best={l.lap === data.best_lap_num || undefined} data-invalid={!l.valid || undefined}>
                  <th scope="row">{l.lap}</th>
                  <td>
                    {formatLapTime(l.lap_time_ms)}
                    {!l.valid && <span className={styles.invalid}>{t('live.raceControlView.invalidLap')}</span>}
                  </td>
                  {l.sectors_ms.map((ms, s) => (
                    <td key={s} data-sector={sectorKind(l.lap, s, ms)}>
                      {formatSectorTime(ms, false)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
};
