import React from 'react';
import { UserRound } from 'lucide-react';
import type { SessionListItem } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { formatLapTime } from '../../utils/formatters';
import { placesKey } from '../../utils/player';
import { Button } from '../ui/Button';
import { openPlayerPicker } from './player/playerPickerStore';
import { sessionKind } from './sessionKind';
import { sessionTypeLabel } from '../../utils/sessionTypeLabel';
import styles from './YourResult.module.css';

interface YourResultProps {
  session: SessionListItem;
}

/**
 * The session list's "Your result": your position, places gained and best lap, or who won. A
 * session with no driver gets a "Pick" button that opens the "Who were you?" picker.
 */
export const YourResult: React.FC<YourResultProps> = ({ session }) => {
  const { t } = useI18n();
  const { summary, session_type: sessionType } = session;
  const me = summary.player;

  if (!me) {
    const leader = summary.leader;
    const kind = sessionKind(sessionType);
    const leaderKey =
      kind === 'race' || kind === 'sprint'
        ? 'history.player.winner'
        : kind === 'qualifying'
          ? 'history.player.pole'
          : 'history.player.leader';
    const noDriver = session.player_car_index === null;
    return (
      <div className={styles.result} data-player="none">
        <span className={styles.main}>
          <span className={styles.none} aria-hidden="true">
            —
          </span>
          {noDriver ? (
            <Button
              size="sm"
              variant="ghost"
              className={styles.pick}
              icon={<UserRound size={13} aria-hidden="true" />}
              aria-label={t('history.player.pickIn', { session: `${session.track_name} ${sessionTypeLabel(sessionType, t)}` })}
              title={t('history.player.noDriver')}
              onClick={(event) => {
                // The row opens the session on click
                event.stopPropagation();
                openPlayerPicker(session);
              }}
            >
              {t('history.player.pick')}
            </Button>
          ) : (
            <span className="sr-only">{t('history.player.noDriverShort')}</span>
          )}
        </span>
        {leader && <span className={styles.detail}>{t(leaderKey, { name: leader.driver_name })}</span>}
      </div>
    );
  }

  const gained = me.positions_gained;
  const out = me.is_dsq ? 'DSQ' : me.is_dnf ? 'DNF' : null;
  return (
    <div
      className={styles.result}
      data-player={me.source}
      title={me.source === 'chosen' ? t('history.player.chosenByYou') : undefined}
    >
      <span className={styles.main}>
        <span className={styles.position} data-podium={!out && me.position <= 3 ? me.position : undefined}>
          {out ?? `P${me.position}`}
        </span>
        <span className={styles.of}>/{me.classified_cars}</span>
        {!out && gained !== null && gained !== 0 && (
          <span className={styles.delta} data-trend={gained > 0 ? 'gained' : 'lost'}>
            <span aria-hidden="true">{gained > 0 ? `▲${gained}` : `▼${Math.abs(gained)}`}</span>
            <span className="sr-only">{t(placesKey(gained), { count: Math.abs(gained) })}</span>
          </span>
        )}
      </span>
      {me.best_lap_time_ms > 0 && (
        <span className={styles.detail}>
          {t('history.player.bestLap', { time: formatLapTime(me.best_lap_time_ms) })}
        </span>
      )}
    </div>
  );
};
