import React from 'react';
import { GitCompareArrows, UserRound } from 'lucide-react';
import { getTeamColor } from '../../../constants/f1';
import { useI18n } from '../../../context/I18nContext';
import { openComparator } from '../../../router/router';
import { placesKey } from '../../../utils/player';
import { styleVars } from '../../../styles/theme';
import type { DriverStanding, PlayerSource } from '../../../types/session';
import { Button } from '../../ui/Button';
import { Panel, PanelHeader } from '../../ui/Panel';
import { Stat } from '../../ui/Stat';
import styles from './YourRaceCard.module.css';

interface YourRaceCardProps {
  sessionId: number;
  driverStandings: DriverStanding[];
  playerCarIndex: number;
  playerSource: PlayerSource | null;
  isRaceSession: boolean;
  formatLapTime: (ms: number) => string;
}

const seconds = (ms: number) => (ms / 1000).toFixed(3);

/** The gap between two neighbouring cars, when both finished on the same lap. */
const neighbourGap = (ahead: DriverStanding, behind: DriverStanding, isRaceSession: boolean): string | null => {
  const interval = behind.intervalMS ?? 0;
  if (interval <= 0) return null;
  if (isRaceSession && (ahead.isDNF || ahead.isDSQ || behind.isDNF || behind.isDSQ)) return null;
  if (isRaceSession && ahead.laps.length !== behind.laps.length) return null;
  return `+${seconds(interval)}s`;
};

/** Your own result in a session: position, grid, best lap, the cars either side, and a comparison. */
export const YourRaceCard: React.FC<YourRaceCardProps> = ({
  sessionId,
  driverStandings,
  playerCarIndex,
  playerSource,
  isRaceSession,
  formatLapTime,
}) => {
  const { t } = useI18n();
  const at = driverStandings.findIndex((d) => d.participant.car_index === playerCarIndex);
  if (at < 0) return null;
  const me = driverStandings[at];
  const ahead = at > 0 ? driverStandings[at - 1] : undefined;
  const behind = driverStandings[at + 1];

  // The benchmark: the session's fastest lap, or the next fastest when it's yours
  const byPace = driverStandings
    .filter((d) => d.bestLapTimeMS > 0 && d.bestLapId)
    .sort((a, b) => a.bestLapTimeMS - b.bestLapTimeMS);
  const fastest = byPace[0];
  const isFastest = fastest?.participant.car_index === playerCarIndex;
  const benchmark = isFastest ? byPace[1] : fastest;

  const out = isRaceSession && (me.isDSQ ? 'DSQ' : me.isDNF ? 'DNF' : null);
  const gained = me.positionsGained;
  const gridDetail =
    gained === undefined || gained === 0 ? undefined : t(placesKey(gained), { count: Math.abs(gained) });

  const bestLapDetail = [
    me.bestLapNumber ? t('history.player.lapNumber', { lap: me.bestLapNumber }) : null,
    isFastest
      ? t('history.player.fastestOfSession')
      : fastest && me.bestLapTimeMS > 0
        ? t('history.player.toFastest', { gap: seconds(me.bestLapTimeMS - fastest.bestLapTimeMS) })
        : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Panel
      className={styles.card}
      style={styleVars({ '--team-color': getTeamColor(me.participant.team_id) })}
      data-testid="your-race"
    >
      <PanelHeader
        icon={<UserRound size={20} />}
        title={t('history.player.yourRace')}
        subtitle={
          <span className={styles.driver}>
            <span className={styles.teamBar} aria-hidden="true" />
            {me.participant.name}
            <span className={styles.muted}>
              {t('history.player.driverDetail', { number: me.participant.race_number, team: me.teamName || '—' })}
            </span>
            {playerSource === 'driver_name' && (
              <span className={styles.muted}>· {t('history.player.matchedByName')}</span>
            )}
          </span>
        }
        actions={
          me.bestLapId && benchmark?.bestLapId ? (
            <Button
              size="sm"
              icon={<GitCompareArrows size={15} aria-hidden="true" />}
              onClick={() => openComparator({ sessionA: sessionId, lapA: me.bestLapId, lapB: benchmark.bestLapId })}
            >
              {t(isFastest ? 'history.player.compareWithSecond' : 'history.player.compareWithFastest')}
            </Button>
          ) : undefined
        }
      />

      <div className={styles.stats}>
        <Stat
          className={styles.stat}
          label={t('history.player.result')}
          value={out || `P${me.position}`}
          detail={out ? undefined : t('history.player.resultOf', { count: driverStandings.length })}
          valueClassName={styles.result}
        />
        {isRaceSession && (
          <Stat
            label={t('history.player.grid')}
            value={me.gridPosition ? `P${me.gridPosition}` : '—'}
            detail={me.gridPosition ? gridDetail : t('history.player.noGrid')}
          />
        )}
        <Stat
          className={styles.stat}
          label={t('history.player.bestLapLabel')}
          value={me.bestLapTimeMS > 0 ? formatLapTime(me.bestLapTimeMS) : '—'}
          detail={bestLapDetail || undefined}
          valueClassName={isFastest ? styles.fastest : undefined}
        />
        <Stat className={styles.stat} label={t('history.player.laps')} value={me.laps.length} />
        {isRaceSession && (
          <Stat className={styles.stat} label={t('history.player.pitStops')} value={me.pitStopsCount ?? 0} />
        )}
        {ahead && (
          <Stat
            className={styles.stat}
            mono={false}
            label={t('history.player.carAhead')}
            value={`P${ahead.position} ${ahead.participant.name}`}
            detail={neighbourGap(ahead, me, isRaceSession) ?? undefined}
          />
        )}
        {behind && (
          <Stat
            className={styles.stat}
            mono={false}
            label={t('history.player.carBehind')}
            value={`P${behind.position} ${behind.participant.name}`}
            detail={neighbourGap(me, behind, isRaceSession) ?? undefined}
          />
        )}
      </div>
    </Panel>
  );
};
