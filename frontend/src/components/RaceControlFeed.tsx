import React, { useState, useMemo } from 'react';
import { ShieldAlert, Flag, Zap, Swords, Wrench, AlertTriangle, Radio, Trash2 } from 'lucide-react';
import type { RaceEvent, SessionData } from '../hooks/useTelemetry';
import { SAFETY_CAR_STATUS, TIME_CONSTANTS } from '../constants/f1';
import { useI18n } from '../context/I18nContext';
import { getLocalizedRaceEventDescription, getLocalizedPenaltyTag } from '../utils/raceEvents';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { IconButton } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Panel, PanelHeader } from './ui/Panel';
import { SegmentedControl } from './ui/SegmentedControl';

type FeedFilter = 'all' | 'flag' | 'penalty' | 'overtake' | 'fastest_lap';

const FEED_FILTERS: ReadonlyArray<{ value: FeedFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'live.filterAll' },
  { value: 'flag', labelKey: 'live.filterFlags' },
  { value: 'penalty', labelKey: 'live.filterPenalties' },
  { value: 'overtake', labelKey: 'live.filterOvertakes' },
  { value: 'fastest_lap', labelKey: 'live.filterFastestLaps' },
];

interface RaceControlFeedProps {
  events?: RaceEvent[];
  session?: SessionData | null;
  onClearEvents?: () => void;
}

export const RaceControlFeed: React.FC<RaceControlFeedProps> = React.memo((props) => {
  const storeEvents = useSessionStatusStore((s) => s.events);
  const storeSession = useSessionStatusStore((s) => s.session);
  const storeClearEvents = useSessionStatusStore((s) => s.clearEvents);

  const events = props.events !== undefined ? props.events : storeEvents;
  const session = props.session !== undefined ? props.session : storeSession;
  const onClearEvents = props.onClearEvents !== undefined ? props.onClearEvents : storeClearEvents;

  const { t } = useI18n();
  const [filter, setFilter] = useState<FeedFilter>('all');

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  const getSafetyCarStatusBadge = (scStatus?: number) => {
    switch (scStatus) {
      case SAFETY_CAR_STATUS.FULL:
        return (
          <span className="sc-status-pill full-sc">
            <AlertTriangle size={13} />
            SAFETY CAR
          </span>
        );
      case SAFETY_CAR_STATUS.VIRTUAL:
        return (
          <span className="sc-status-pill vsc">
            <AlertTriangle size={13} />
            VIRTUAL SC
          </span>
        );
      case SAFETY_CAR_STATUS.FORMATION_LAP:
        return (
          <span className="sc-status-pill formation">
            <Flag size={13} />
            {t('live.formationLap')}
          </span>
        );
      default:
        return (
          <span className="sc-status-pill green-flag">
            <span className="sc-dot-live" />
            {t('live.trackClear')}
          </span>
        );
    }
  };

  const getEventIcon = (type: RaceEvent['type']) => {
    switch (type) {
      case 'fastest_lap':
        return <Zap size={14} className="event-icon-purple" />;
      case 'overtake':
        return <Swords size={14} className="event-icon-cyan" />;
      case 'penalty':
        return <AlertTriangle size={14} className="event-icon-red" />;
      case 'pit':
        return <Wrench size={14} className="event-icon-yellow" />;
      case 'flag':
      case 'retirement':
        return <ShieldAlert size={14} className="event-icon-orange" />;
      default:
        return <Flag size={14} className="event-icon-default" />;
    }
  };

  const formatEventTime = (timestamp: number, sessionTime?: number) => {
    if (sessionTime !== undefined && sessionTime > 0) {
      const mins = Math.floor(sessionTime / TIME_CONSTANTS.SECONDS_PER_MINUTE);
      const secs = Math.floor(sessionTime % TIME_CONSTANTS.SECONDS_PER_MINUTE);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Panel className="race-hub-card race-control-feed-panel">
      <PanelHeader
        icon={<Radio size={16} color="var(--accent-primary)" />}
        title={t('live.raceControlTitle')}
        subtitle={t('live.raceControlSub')}
        actions={
          <>
            {getSafetyCarStatusBadge(session?.SafetyCarStatus)}
            {events.length > 0 && onClearEvents && (
              <IconButton size="sm" label={t('live.clearFeedEvents')} onClick={onClearEvents}>
                <Trash2 size={13} />
              </IconButton>
            )}
          </>
        }
      />

      <div className="race-feed-filters">
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
                <span className="mono count-badge">
                  {value === 'all' ? events.length : events.filter((e) => e.type === value).length}
                </span>
              </>
            ),
          }))}
        />
      </div>

      {/* Event Stream Container */}
      <div className="race-feed-stream" role="log" aria-live="polite">
        {filteredEvents.length === 0 ? (
          <EmptyState
            compact
            icon={<Radio size={24} className="pulse-slow" />}
            title={t('live.monitoringSignals')}
            description={t('live.monitoringSignalsSub')}
          />
        ) : (
          filteredEvents.map((evt) => {
            const desc = getLocalizedRaceEventDescription(evt, t);
            return (
              <div key={evt.id} className={`race-feed-item severity-${evt.severity}`}>
                <div className="race-feed-item-left">
                  <span className="race-feed-item-icon">{getEventIcon(evt.type)}</span>
                  <span className="race-feed-item-time mono">{formatEventTime(evt.timestamp, evt.sessionTime)}</span>
                </div>
                <div className="race-feed-item-content">
                  <span className={`race-feed-tag tag-${evt.type}`}>
                    {getLocalizedPenaltyTag(evt, t)}
                  </span>
                  <span className="race-feed-item-text">{desc}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
});

RaceControlFeed.displayName = 'RaceControlFeed';

