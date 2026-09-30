import React, { useMemo } from 'react';
import { Route } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionStatusStore } from '../../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../../store/useTelemetryDataStore';
import { parseDriverName } from '../../store/useTelemetryStore';
import { getTeamColor } from '../../constants/f1';
import { trackPositions, type TrackDot } from '../../utils/raceControl';
import { driverCode } from '../../utils/player';
import { styleVars } from '../../styles/theme';
import { Panel, PanelHeader } from '../ui/Panel';
import styles from './TrackPositionStrip.module.css';

interface TrackPositionStripProps {
  className?: string;
  onSelectCar?: (carIndex: number) => void;
}

type DotRole = 'you' | 'neighbour' | 'other';

/**
 * Every running car round the lap, from the start/finish line on the left, by lap distance. Cars in
 * the pit lane sit on their own row. You and the cars either side of you are labelled.
 */
export const TrackPositionStrip: React.FC<TrackPositionStripProps> = ({ className, onSelectCar }) => {
  const { t } = useI18n();
  const trackLength = useSessionStatusStore((s) => s.session?.TrackLength ?? 0);
  const participants = useSessionStatusStore((s) => s.participants);
  const laps = useTelemetryDataStore((s) => s.allLaps);
  const playerIdx = useTelemetryDataStore((s) => s.playerCarIndex);

  const dots = useMemo(() => trackPositions(laps, trackLength), [laps, trackLength]);
  const playerPosition = laps[playerIdx]?.CarPosition ?? 0;
  const roleOf = (dot: TrackDot): DotRole =>
    dot.carIndex === playerIdx ? 'you' : Math.abs(dot.position - playerPosition) === 1 ? 'neighbour' : 'other';
  // You on top, then your neighbours
  const order: Record<DotRole, number> = { other: 0, neighbour: 1, you: 2 };
  const sorted = [...dots].sort((a, b) => order[roleOf(a)] - order[roleOf(b)] || b.position - a.position);
  const onTrack = sorted.filter((d) => !d.inPit);
  const inPit = sorted.filter((d) => d.inPit);

  const renderDot = (dot: TrackDot) => {
    const p = participants[dot.carIndex];
    const name = parseDriverName(p?.Name, t('live.events.car', { number: dot.carIndex + 1 }), p?.DriverId);
    const role = roleOf(dot);
    const label = t('live.raceControlView.trackDot', { position: dot.position, driver: name });
    const style = styleVars({ '--at': dot.fraction.toFixed(4), '--team-color': getTeamColor(p?.TeamId) });
    const body = role !== 'other' && <span className={styles.code}>{driverCode(name, p?.RaceNumber)}</span>;
    return onSelectCar ? (
      <button
        key={dot.carIndex}
        type="button"
        className={`button-reset ${styles.dot}`}
        data-role={role}
        style={style}
        title={label}
        aria-label={label}
        onClick={() => onSelectCar(dot.carIndex)}
      >
        {body}
      </button>
    ) : (
      <span key={dot.carIndex} className={styles.dot} data-role={role} style={style} title={label}>
        {body}
      </span>
    );
  };

  return (
    <Panel className={className} padding="compact" data-testid="track-position-strip">
      <PanelHeader icon={<Route size={16} />} title={t('live.raceControlView.trackPosition')} />
      {trackLength > 0 ? (
        <div className={styles.strip}>
          <div className={styles.lane} data-lane="track">
            <span className={styles.line} aria-hidden="true" />
            <span className={styles.laneLabel}>{t('live.raceControlView.startFinish')}</span>
            {onTrack.map(renderDot)}
          </div>
          <div className={styles.lane} data-lane="pit">
            <span className={styles.line} aria-hidden="true" />
            <span className={styles.laneLabel}>{t('live.raceControlView.pitLane')}</span>
            {inPit.map(renderDot)}
          </div>
        </div>
      ) : (
        <p className={styles.waiting}>{t('live.raceControlView.waitingForTrack')}</p>
      )}
    </Panel>
  );
};
