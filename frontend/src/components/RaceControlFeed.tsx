import React, { useState, useMemo } from 'react';
import { ShieldAlert, Flag, Zap, Swords, Wrench, AlertTriangle, Radio, Trash2 } from 'lucide-react';
import type { RaceEvent, SessionData } from '../hooks/useTelemetry';

interface RaceControlFeedProps {
  events: RaceEvent[];
  session: SessionData | null;
  onClearEvents?: () => void;
}

export const RaceControlFeed: React.FC<RaceControlFeedProps> = ({
  events = [],
  session = null,
  onClearEvents,
}) => {
  const [filter, setFilter] = useState<'all' | 'flag' | 'penalty' | 'overtake' | 'fastest_lap'>('all');

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  const getSafetyCarStatusBadge = (scStatus?: number) => {
    switch (scStatus) {
      case 1:
        return (
          <span className="sc-status-pill full-sc">
            <AlertTriangle size={13} />
            SAFETY CAR
          </span>
        );
      case 2:
        return (
          <span className="sc-status-pill vsc">
            <AlertTriangle size={13} />
            VIRTUAL SC
          </span>
        );
      case 3:
        return (
          <span className="sc-status-pill formation">
            <Flag size={13} />
            FORMATION LAP
          </span>
        );
      default:
        return (
          <span className="sc-status-pill green-flag">
            <span className="sc-dot-live" />
            TRACK CLEAR
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
      const mins = Math.floor(sessionTime / 60);
      const secs = Math.floor(sessionTime % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="glass-panel race-hub-card race-control-feed-panel">
      {/* Panel Header */}
      <div className="race-hub-header">
        <div className="race-hub-title-group">
          <div className="race-hub-icon-wrap">
            <Radio size={16} color="var(--accent-primary)" />
          </div>
          <div>
            <h3 className="race-hub-title">Race Control & Incidents</h3>
            <div className="race-hub-subtitle mono">Live Official Timeline & Flag Status</div>
          </div>
        </div>

        <div className="race-hub-header-actions">
          {getSafetyCarStatusBadge(session?.SafetyCarStatus)}
          {events.length > 0 && onClearEvents && (
            <button
              onClick={onClearEvents}
              className="btn-feed-clear"
              title="Clear feed events"
              aria-label="Clear all race control events"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="race-feed-filters">
        <div className="race-feed-filter-tabs">
          <button
            className={`race-feed-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All <span className="mono count-badge">{events.length}</span>
          </button>
          <button
            className={`race-feed-filter-btn ${filter === 'flag' ? 'active' : ''}`}
            onClick={() => setFilter('flag')}
          >
            Flags / SC{' '}
            <span className="mono count-badge">{events.filter((e) => e.type === 'flag').length}</span>
          </button>
          <button
            className={`race-feed-filter-btn ${filter === 'penalty' ? 'active' : ''}`}
            onClick={() => setFilter('penalty')}
          >
            Penalties{' '}
            <span className="mono count-badge">{events.filter((e) => e.type === 'penalty').length}</span>
          </button>
          <button
            className={`race-feed-filter-btn ${filter === 'overtake' ? 'active' : ''}`}
            onClick={() => setFilter('overtake')}
          >
            Overtakes{' '}
            <span className="mono count-badge">{events.filter((e) => e.type === 'overtake').length}</span>
          </button>
          <button
            className={`race-feed-filter-btn ${filter === 'fastest_lap' ? 'active' : ''}`}
            onClick={() => setFilter('fastest_lap')}
          >
            Fastest Laps{' '}
            <span className="mono count-badge">{events.filter((e) => e.type === 'fastest_lap').length}</span>
          </button>
        </div>
      </div>

      {/* Event Stream Container */}
      <div className="race-feed-stream" role="log" aria-live="polite">
        {filteredEvents.length === 0 ? (
          <div className="race-feed-empty">
            <Radio size={24} className="pulse-slow" color="var(--text-muted)" />
            <div className="race-feed-empty-title">Monitoring Race Control Signals</div>
            <div className="race-feed-empty-desc">
              Live steward notices, overtakes, fastest laps, and penalties will stream here in real-time.
            </div>
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div key={evt.id} className={`race-feed-item severity-${evt.severity}`}>
              <div className="race-feed-item-left">
                <span className="race-feed-item-icon">{getEventIcon(evt.type)}</span>
                <span className="race-feed-item-time mono">{formatEventTime(evt.timestamp, evt.sessionTime)}</span>
              </div>
              <div className="race-feed-item-content">
                <span className={`race-feed-tag tag-${evt.type}`}>
                  {evt.type.replace('_', ' ').toUpperCase()}
                </span>
                <span className="race-feed-item-text">{evt.description}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
