import React, { useMemo, useState } from 'react';
import { AlertTriangle, Flag, History, ShieldAlert, Swords, Wrench, Zap } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import type { FeedEvent } from '../../../types/session';
import { getLocalizedRaceEventDescription } from '../../../utils/raceEvents';
import { keyMoments, momentsByLap, raceControlPeriods } from '../../../utils/raceStory';
import { Badge } from '../../ui/Badge';
import { EmptyState } from '../../ui/EmptyState';
import { Panel, PanelHeader } from '../../ui/Panel';
import { SegmentedControl } from '../../ui/SegmentedControl';
import styles from './KeyMomentsTimeline.module.css';

type MomentFilter = 'all' | 'mine';

const MomentIcon: React.FC<{ event: FeedEvent }> = ({ event }) => {
  switch (event.type) {
    case 'fastest_lap':
      return <Zap size={14} />;
    case 'overtake':
      return <Swords size={14} />;
    case 'penalty':
      return <AlertTriangle size={14} />;
    case 'pit':
      return <Wrench size={14} />;
    case 'retirement':
      return <ShieldAlert size={14} />;
    default:
      return <Flag size={14} />;
  }
};

interface KeyMomentsTimelineProps {
  events: FeedEvent[];
  playerCarIndex: number | null;
}

/**
 * The race told through its race-control feed: the start, safety cars and flags, retirements and
 * penalties, the fastest lap, and your own overtakes, stops and incidents, grouped by the
 * leader's lap. Only sessions recorded since the feed is stored have one.
 */
export const KeyMomentsTimeline: React.FC<KeyMomentsTimelineProps> = ({ events, playerCarIndex }) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<MomentFilter>('all');

  const moments = useMemo(() => keyMoments(events, playerCarIndex), [events, playerCarIndex]);
  const mineCount = moments.filter((m) => m.mine).length;
  const shown = filter === 'mine' ? moments.filter((m) => m.mine) : moments;
  const groups = useMemo(() => momentsByLap(shown), [shown]);

  const summary = useMemo(() => {
    const periods = raceControlPeriods(events);
    const count = (code: FeedEvent['eventCode']) => events.filter((e) => e.eventCode === code).length;
    return [
      { key: 'sc', value: periods.filter((p) => p.kind === 'sc').length },
      { key: 'vsc', value: periods.filter((p) => p.kind === 'vsc').length },
      { key: 'retirements', value: count('RTMT') + count('DSQ') },
      { key: 'penalties', value: moments.filter((m) => m.event.eventCode === 'PENA').length },
    ].filter((s) => s.value > 0);
  }, [events, moments]);

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        level={2}
        icon={<History size={16} />}
        title={t('history.story.momentsTitle')}
        subtitle={
          summary.length > 0
            ? summary.map((s) => t(`history.story.summary.${s.key}`, { count: s.value })).join(' · ')
            : t('history.story.momentsQuiet')
        }
        actions={
          playerCarIndex !== null && mineCount > 0 ? (
            <SegmentedControl
              size="xs"
              aria-label={t('history.story.momentsFilterLabel')}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('history.story.momentsAll') },
                { value: 'mine', label: t('history.story.momentsMine', { count: mineCount }) },
              ]}
            />
          ) : undefined
        }
      />
      {groups.length === 0 ? (
        <EmptyState compact title={t('history.story.momentsNone')} />
      ) : (
        <ol className={styles.laps} aria-label={t('history.story.momentsTitle')}>
          {groups.map((group) => (
            <li key={group.lap} className={styles.lap}>
              <span className={styles.lapNumber}>
                {group.lap > 0 ? t('history.story.lapLabel', { lap: group.lap }) : t('history.story.start')}
              </span>
              <ul className={styles.moments}>
                {group.moments.map((m, i) => (
                  <li
                    key={`${m.event.eventCode}-${m.event.sessionTime ?? 0}-${i}`}
                    className={styles.moment}
                    data-severity={m.event.severity}
                    data-mine={m.mine || undefined}
                  >
                    <span className={styles.icon} data-type={m.event.type} aria-hidden="true">
                      <MomentIcon event={m.event} />
                    </span>
                    <span className={styles.text}>{getLocalizedRaceEventDescription(m.event, t)}</span>
                    {m.mine && (
                      <Badge tone="info" size="sm" className={styles.you}>
                        {t('history.player.you')}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
};
