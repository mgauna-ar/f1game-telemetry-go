import React, { useState, useMemo } from 'react';
import { ShieldAlert, Flag, Zap, Swords, Wrench, AlertTriangle, Radio, Trash2 } from 'lucide-react';
import type { RaceEvent, SessionData } from '../hooks/useTelemetry';
import { TIME_CONSTANTS } from '../constants/f1';
import { useI18n } from '../context/I18nContext';
import { getLocalizedRaceEventDescription, getLocalizedPenaltyTag } from '../utils/raceEvents';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { SafetyCarBadge } from './common/SafetyCarBadge';
import { Badge, type BadgeTone } from './ui/Badge';
import { IconButton } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Panel, PanelHeader } from './ui/Panel';
import { SegmentedControl } from './ui/SegmentedControl';
import styles from './RaceControlFeed.module.css';
import { useUnits } from '../hooks/useUnits';

type FeedFilter = 'all' | 'flag' | 'penalty' | 'overtake' | 'fastest_lap';

const FEED_FILTERS: ReadonlyArray<{ value: FeedFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'live.filterAll' },
  { value: 'flag', labelKey: 'live.filterFlags' },
  { value: 'penalty', labelKey: 'live.filterPenalties' },
  { value: 'overtake', labelKey: 'live.filterOvertakes' },
  { value: 'fastest_lap', labelKey: 'live.filterFastestLaps' },
];

const EVENT_TAG_TONES: Partial<Record<RaceEvent['type'], BadgeTone>> = {
  fastest_lap: 'purple',
  overtake: 'info',
  penalty: 'danger',
  pit: 'warning',
  flag: 'orange',
  retirement: 'orange',
};

const EventIcon: React.FC<{ type: RaceEvent['type'] }> = ({ type }) => {
  switch (type) {
    case 'fastest_lap':
      return <Zap size={14} />;
    case 'overtake':
      return <Swords size={14} />;
    case 'penalty':
      return <AlertTriangle size={14} />;
    case 'pit':
      return <Wrench size={14} />;
    case 'flag':
    case 'retirement':
      return <ShieldAlert size={14} />;
    default:
      return <Flag size={14} />;
  }
};

interface RaceControlFeedProps {
  className?: string;
  events?: RaceEvent[];
  session?: SessionData | null;
  onClearEvents?: () => void;
}

export const RaceControlFeed: React.FC<RaceControlFeedProps> = React.memo((props) => {
  const { className } = props;
  const storeEvents = useSessionStatusStore((s) => s.events);
  const storeSession = useSessionStatusStore((s) => s.session);
  const storeClearEvents = useSessionStatusStore((s) => s.clearEvents);

  const events = props.events !== undefined ? props.events : storeEvents;
  const session = props.session !== undefined ? props.session : storeSession;
  const onClearEvents = props.onClearEvents !== undefined ? props.onClearEvents : storeClearEvents;

  const { t } = useI18n();
  const units = useUnits();
  const [filter, setFilter] = useState<FeedFilter>('all');

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  const formatEventTime = (timestamp: number, sessionTime?: number) => {
    if (sessionTime !== undefined && sessionTime > 0) {
      const mins = Math.floor(sessionTime / TIME_CONSTANTS.SECONDS_PER_MINUTE);
      const secs = Math.floor(sessionTime % TIME_CONSTANTS.SECONDS_PER_MINUTE);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return units.time(timestamp, true);
  };

  return (
    <Panel className={className}>
      <PanelHeader
        icon={<Radio size={16} color="var(--accent-primary)" />}
        title={t('live.raceControlTitle')}
        subtitle={t('live.raceControlSub')}
        actions={
          <>
            <SafetyCarBadge status={session?.SafetyCarStatus} clearLabel={t('live.trackClear')} />
            {events.length > 0 && onClearEvents && (
              <IconButton size="sm" label={t('live.clearFeedEvents')} onClick={onClearEvents}>
                <Trash2 size={13} />
              </IconButton>
            )}
          </>
        }
      />

      <div className={styles.filters}>
        <SegmentedControl
          size="xs"
          aria-label={t('live.feedFilterLabel')}
          value={filter}
          onChange={setFilter}
          options={FEED_FILTERS.map(({ value, labelKey }) => ({
            value,
            label: (
              <>
                {t(labelKey)}{' '}
                <span className={`mono ${styles.count}`}>
                  {value === 'all' ? events.length : events.filter((e) => e.type === value).length}
                </span>
              </>
            ),
          }))}
        />
      </div>

      {/* Event Stream Container */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          compact
          icon={<Radio size={24} />}
          title={t('live.monitoringSignals')}
          description={t('live.monitoringSignalsSub')}
        />
      ) : (
        <ol className={styles.stream} role="log" aria-live="polite" aria-label={t('live.raceControlTitle')}>
          {filteredEvents.map((evt) => (
            <li key={evt.id} className={styles.item} data-severity={evt.severity}>
              <div className={styles.meta}>
                <span className={styles.icon} data-type={evt.type} aria-hidden="true">
                  <EventIcon type={evt.type} />
                </span>
                <span className={`mono ${styles.time}`}>{formatEventTime(evt.timestamp, evt.sessionTime)}</span>
              </div>
              <div className={styles.content}>
                <Badge tone={EVENT_TAG_TONES[evt.type] ?? 'neutral'} size="xs" square uppercase>
                  {getLocalizedPenaltyTag(evt, t)}
                </Badge>
                <span className={styles.text}>{getLocalizedRaceEventDescription(evt, t, units)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
});

RaceControlFeed.displayName = 'RaceControlFeed';
