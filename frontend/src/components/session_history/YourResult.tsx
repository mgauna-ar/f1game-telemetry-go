import React from 'react';
import type { SessionSummary } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { formatLapTime } from '../../utils/formatters';
import { placesKey } from '../../utils/player';
import { sessionKind } from './sessionKind';
import styles from './YourResult.module.css';

interface YourResultProps {
  summary: SessionSummary;
  sessionType: string;
}

/** The session list's "Your result": your position, places gained and best lap, or who won. */
export const YourResult: React.FC<YourResultProps> = ({ summary, sessionType }) => {
  const { t } = useI18n();
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
    return (
      <div className={styles.result} data-player="none" title={t('history.player.notRecorded')}>
        <span className={styles.none} aria-hidden="true">
          —
        </span>
        <span className="sr-only">{t('history.player.notRecordedShort')}</span>
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
      title={me.source === 'driver_name' ? t('history.player.matchedByName') : undefined}
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
        {me.source === 'driver_name' && (
          <span className={styles.byName} aria-hidden="true">
            *
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
