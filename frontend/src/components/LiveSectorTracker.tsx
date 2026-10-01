import React, { useMemo } from 'react';
import { Zap, Gauge, Target } from 'lucide-react';
import { parseDriverName } from '../hooks/useTelemetry';
import { getTeamColor, TIME_CONSTANTS } from '../constants/f1';
import type { ParticipantData, LapData, LapTimes } from '../types/telemetry';
import { sessionBestSectors, sessionFastestLap, theoreticalBest, type SessionBest } from '../utils/raceControl';
import { useI18n } from '../context/I18nContext';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import { styleVars } from '../styles/theme';
import { Panel, PanelHeader } from './ui/Panel';
import styles from './LiveSectorTracker.module.css';
import { useUnits } from '../hooks/useUnits';

interface BestTime {
  time: number;
  carIdx: number;
  driverName: string;
  teamId: number;
}

const NO_BEST_TIME: BestTime = { time: 0, carIdx: -1, driverName: '--', teamId: -1 };

interface BestTimeCardProps {
  label: string;
  best: BestTime;
  kind: 'sector' | 'lap';
  formatTime: (ms?: number) => string;
}

/** A session best (purple sector or fastest lap), with who set it. */
const BestTimeCard: React.FC<BestTimeCardProps> = ({ label, best, kind, formatTime }) => (
  <li className={styles.bestCard} data-kind={kind}>
    <div className={styles.bestHeader}>
      <span className={styles.bestLabel}>{label}</span>
      <span className={styles.bestTime}>{formatTime(best.time)}</span>
    </div>
    <div className={styles.holder} style={styleVars({ '--team-color': getTeamColor(best.teamId) })}>
      <span className={styles.teamDot} aria-hidden="true" />
      <span className={styles.holderName}>{best.driverName}</span>
    </div>
  </li>
);

interface SplitProps {
  label: string;
  time: string;
  note?: React.ReactNode;
  purple?: boolean;
}

/** One of the selected driver's splits: its time and the gap to the session best. */
const Split: React.FC<SplitProps> = ({ label, time, note, purple }) => (
  <div className={styles.split}>
    <dt className={styles.splitLabel}>{label}</dt>
    <dd className={styles.splitTime}>{time}</dd>
    {note !== undefined && (
      <dd className={styles.splitDelta} data-purple={purple}>
        {note}
      </dd>
    )}
  </div>
);

interface LiveSectorTrackerProps {
  className?: string;
  participants?: ParticipantData[];
  laps?: LapData[];
  /** Each car's completed-lap sectors and bests, by car index. */
  lapTimes?: LapTimes[];
  /** Each car's best lap in ms, by car index. */
  bestLapTimes?: number[];
  selectedCarIndex?: number;
  playerCarIndex?: number;
}

export const LiveSectorTracker: React.FC<LiveSectorTrackerProps> = React.memo((props) => {
  const storeParticipants = useSessionStatusStore((s) => s.participants);
  const storeLaps = useTelemetryDataStore((s) => s.allLaps);
  const storeLapTimes = useTelemetryDataStore((s) => s.allLapTimes);
  const storeBestLapTimes = useTelemetryDataStore((s) => s.bestLapTimes);
  const storeSelectedCarIndex = useTelemetryDataStore((s) => s.selectedCarIndex);
  const participants = props.participants !== undefined ? props.participants : storeParticipants;
  const laps = props.laps !== undefined ? props.laps : storeLaps;
  const lapTimes = props.lapTimes !== undefined ? props.lapTimes : storeLapTimes;
  const bestLapTimes = props.bestLapTimes !== undefined ? props.bestLapTimes : storeBestLapTimes;
  const selectedCarIndex = props.selectedCarIndex !== undefined ? props.selectedCarIndex : storeSelectedCarIndex;

  const { t } = useI18n();
  const units = useUnits();
  const splitsTitleId = React.useId();
  const speedTitleId = React.useId();

  const formatTime = (ms?: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const mins = Math.floor(ms / TIME_CONSTANTS.MS_PER_MINUTE);
    const secs = Math.floor((ms % TIME_CONSTANTS.MS_PER_MINUTE) / TIME_CONSTANTS.MS_PER_SECOND);
    const millis = ms % TIME_CONSTANTS.MS_PER_SECOND;

    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    }
    return `${secs}.${millis.toString().padStart(3, '0')}s`;
  };

  // Session bests from the session history: every car's best sectors and best lap
  const sectorAnalysis = useMemo(() => {
    const best = (b: SessionBest): BestTime => {
      if (b.carIndex < 0) return NO_BEST_TIME;
      const p = participants[b.carIndex];
      return {
        time: b.time,
        carIdx: b.carIndex,
        driverName: parseDriverName(p?.Name, t('live.events.car', { number: b.carIndex + 1 }), p?.DriverId),
        teamId: p?.TeamId ?? 0,
      };
    };
    const sectors = sessionBestSectors(lapTimes);
    const fastestLap = sessionFastestLap(bestLapTimes);
    return {
      sectors: sectors.map(best),
      fastestLap: best(fastestLap),
      theoreticalBest: theoreticalBest(sectors) || fastestLap.time,
    };
  }, [participants, lapTimes, bestLapTimes, t]);

  // Speed Trap Leaderboard (Sorted by Fastest Speed)
  const speedTraps = useMemo(() => {
    const list = participants.map((p, idx) => {
      const lap = laps[idx];
      const name = parseDriverName(p?.Name, t('live.events.car', { number: idx + 1 }), p?.DriverId);
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
  }, [participants, laps, selectedCarIndex, t]);

  // Selected driver: the sectors of their last completed lap
  const selectedLap = laps[selectedCarIndex];
  const selectedSectors = lapTimes[selectedCarIndex]?.LastSectorsMS;
  const selectedParticipant = participants[selectedCarIndex];
  const selectedName = parseDriverName(
    selectedParticipant?.Name,
    t('live.events.car', { number: selectedCarIndex + 1 }),
    selectedParticipant?.DriverId
  );

  // Gap of a selected-driver sector to the session best; purple when it is the best
  const sectorSplit = (label: string, ms: number | undefined, bestMs: number) => {
    const time = formatTime(ms);
    if (!(bestMs > 0 && ms)) return <Split label={label} time={time} />;
    const purple = ms <= bestMs;
    const note = purple ? t('live.purpleSplit') : `+${((ms - bestMs) / TIME_CONSTANTS.MS_PER_SECOND).toFixed(3)}s`;
    return <Split label={label} time={time} note={note} purple={purple} />;
  };

  return (
    <Panel className={props.className}>
      <PanelHeader
        icon={<Zap size={16} color="var(--f1-purple)" />}
        title={t('live.liveSectorsTitle')}
        subtitle={t('live.liveSectorsSub')}
        actions={
          <dl className={styles.theoretical}>
            <dt className={styles.theoreticalLabel}>{t('live.theoreticalBest')}</dt>
            <dd className={styles.theoreticalValue}>{formatTime(sectorAnalysis.theoreticalBest)}</dd>
          </dl>
        }
      />

      <ul className={styles.bests}>
        {sectorAnalysis.sectors.map((best, i) => (
          <BestTimeCard
            key={i}
            label={t(`live.sector${i + 1}`)}
            best={best}
            kind="sector"
            formatTime={formatTime}
          />
        ))}
        <BestTimeCard
          label={t('live.fastestLap')}
          best={sectorAnalysis.fastestLap}
          kind="lap"
          formatTime={formatTime}
        />
      </ul>

      <div className={styles.bottom}>
        {/* Selected driver splits */}
        <section className={styles.subcard} aria-labelledby={splitsTitleId}>
          <h4 id={splitsTitleId} className={styles.subcardTitle}>
            <Target size={14} color="var(--accent-primary)" aria-hidden="true" />
            {t('live.driverLastLapSplits', { driver: selectedName })}
          </h4>
          <dl className={styles.splits}>
            {sectorAnalysis.sectors.map((best, i) => (
              <React.Fragment key={i}>{sectorSplit(`S${i + 1}`, selectedSectors?.[i], best.time)}</React.Fragment>
            ))}
            <Split
              label={t('live.lastLap')}
              time={formatTime(selectedLap?.LastLapTimeInMS)}
              note={selectedLap?.CurrentLapInvalid ? t('live.invalidated') : t('live.valid')}
            />
          </dl>
        </section>

        {/* Speed trap top five */}
        <section className={styles.subcard} aria-labelledby={speedTitleId}>
          <h4 id={speedTitleId} className={styles.subcardTitle}>
            <Gauge size={14} color="var(--weather-rain)" aria-hidden="true" />
            {t('live.speedTrapLeaderboard')}
          </h4>
          {speedTraps.length === 0 ? (
            <div className={styles.speedEmpty}>{t('live.noSpeedTraps')}</div>
          ) : (
            <ol className={styles.speedList}>
              {speedTraps.map((st, i) => (
                <li
                  key={st.carIndex}
                  className={styles.speedItem}
                  aria-current={st.isSelected || undefined}
                  style={styleVars({ '--team-color': getTeamColor(st.teamId) })}
                >
                  <span className={styles.speedDriver}>
                    <span className={styles.speedRank}>#{i + 1}</span>
                    <span className={styles.teamBar} aria-hidden="true" />
                    <span className={styles.speedName}>{st.name}</span>
                  </span>
                  <span className={styles.speedValue}>
                    <span className={styles.speed}>
                      {units.speed(st.speed)}
                    </span>
                    {st.lapNum > 0 && <span className={styles.speedLap}>L{st.lapNum}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Panel>
  );
});

LiveSectorTracker.displayName = 'LiveSectorTracker';
