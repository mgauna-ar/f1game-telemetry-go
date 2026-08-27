import React from 'react';
import { Flag, CloudSun, Thermometer, ShieldAlert, Timer, LayoutDashboard, Mic, Radio } from 'lucide-react';
import type { SessionData } from '../hooks/useTelemetry';
import { useI18n } from '../context/I18nContext';
import { F1FormatBadge } from './F1FormatBadge';
import { TrackFlag } from './TrackFlag';
import { TRACK_NAMES, getTrackInfo, LIVE_VIEW_MODES } from '../constants/f1';
import type { LiveViewMode } from '../constants/f1';

import { useTelemetryStore } from '../store/useTelemetryStore';

interface SessionHeaderProps {
  session?: SessionData | null;
  connected?: boolean;
  packetFormat?: number | null;
  viewMode?: LiveViewMode;
  onViewModeChange?: (mode: LiveViewMode) => void;
}

const WEATHER_NAMES: Record<number, string> = {
  0: 'Clear ☀️', 1: 'Light Cloud ⛅', 2: 'Overcast ☁️',
  3: 'Light Rain 🌧️', 4: 'Heavy Rain 🌧️', 5: 'Storm ⛈️',
};

const SESSION_TYPES: Record<number, { label: string; isRace: boolean; isQualy: boolean; isSprint?: boolean }> = {
  1: { label: 'PRACTICE 1', isRace: false, isQualy: false },
  2: { label: 'PRACTICE 2', isRace: false, isQualy: false },
  3: { label: 'PRACTICE 3', isRace: false, isQualy: false },
  4: { label: 'SHORT PRACTICE', isRace: false, isQualy: false },
  5: { label: 'QUALIFYING 1', isRace: false, isQualy: true },
  6: { label: 'QUALIFYING 2', isRace: false, isQualy: true },
  7: { label: 'QUALIFYING 3', isRace: false, isQualy: true },
  8: { label: 'SHORT QUALIFYING', isRace: false, isQualy: true },
  9: { label: 'ONE-SHOT QUALI', isRace: false, isQualy: true },
  10: { label: 'SPRINT QUALI 1', isRace: false, isQualy: true, isSprint: true },
  11: { label: 'SPRINT QUALI 2', isRace: false, isQualy: true, isSprint: true },
  12: { label: 'SPRINT QUALI 3', isRace: false, isQualy: true, isSprint: true },
  13: { label: 'SHORT SPRINT QUALI', isRace: false, isQualy: true, isSprint: true },
  14: { label: 'ONE-SHOT SPRINT QUALI', isRace: false, isQualy: true, isSprint: true },
  15: { label: 'RACE', isRace: true, isQualy: false },
  16: { label: 'RACE 2', isRace: true, isQualy: false },
  17: { label: 'RACE 3', isRace: true, isQualy: false },
  18: { label: 'TIME TRIAL', isRace: false, isQualy: false },
  19: { label: 'SPRINT RACE', isRace: true, isQualy: false, isSprint: true },
  20: { label: 'EQUAL SPRINT RACE', isRace: true, isQualy: false, isSprint: true },
};

export const SessionHeader: React.FC<SessionHeaderProps> = React.memo((props) => {
  const storeSession = useTelemetryStore((s) => s.session);
  const storeConnected = useTelemetryStore((s) => s.connected);
  const storePacketFormat = useTelemetryStore((s) => s.packetFormat);

  const session = props.session !== undefined ? props.session : storeSession;
  const connected = props.connected !== undefined ? props.connected : storeConnected;
  const packetFormat = props.packetFormat !== undefined ? props.packetFormat : storePacketFormat;
  const viewMode = props.viewMode ?? LIVE_VIEW_MODES.DASHBOARD;
  const onViewModeChange = props.onViewModeChange;

  const { t } = useI18n();

  // If no active session yet (waiting for data)
  if (!session) {
    return (
      <header className="header session-header-panel session-header-standby">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="standby-header-pulse">
              <Radio size={18} className="text-cyan-400" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'nowrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {t('live.liveHub')}
                </h1>
                <span className={`session-badge ${connected ? 'badge-green' : 'badge-yellow'}`}>
                  {connected ? t('live.backendConnected') : t('live.connectingToBackend')}
                </span>
              </div>
              <p className="mono" style={{ color: 'var(--text-secondary)', margin: '2px 0 0 0', fontSize: '0.80rem' }}>
                {t('live.commandCenter')} • UDP 20777
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'nowrap' }}>
          {/* Live View Mode Segmented Switcher */}
          {onViewModeChange && (
            <div className="live-view-mode-toggle" role="group" aria-label="Live View Mode">
              <button
                type="button"
                className={`live-view-toggle-btn ${viewMode === LIVE_VIEW_MODES.DASHBOARD ? 'active' : ''}`}
                onClick={() => onViewModeChange(LIVE_VIEW_MODES.DASHBOARD)}
                title={t('live.viewModeDashboard')}
                data-testid="live-view-toggle-dashboard"
              >
                <LayoutDashboard size={14} />
                <span>{t('live.viewModeDashboard')}</span>
              </button>
              <button
                type="button"
                className={`live-view-toggle-btn ${viewMode === LIVE_VIEW_MODES.COCKPIT ? 'active' : ''}`}
                onClick={() => onViewModeChange(LIVE_VIEW_MODES.COCKPIT)}
                title={t('live.viewModeCockpit')}
                data-testid="live-view-toggle-cockpit"
              >
                <Mic size={14} />
                <span>{t('live.viewModeCockpit')}</span>
              </button>
            </div>
          )}

          {/* WebSocket Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
            <span className={`status-dot ${connected ? 'status-live' : ''}`} />
            <span className="mono" style={{ marginLeft: '8px', color: connected ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
              {connected ? t('live.liveStatus') : t('live.reconnecting')}
            </span>
          </div>
        </div>
      </header>
    );
  }

  // Active Session rendering
  const trackInfo = getTrackInfo(session.TrackId);
  const trackName = trackInfo?.name || TRACK_NAMES[session.TrackId] || `Track #${session.TrackId}`;
  const sessionInfo = SESSION_TYPES[session.SessionType] || { label: 'LIVE SESSION', isRace: false, isQualy: false };
  const weatherText = WEATHER_NAMES[session.Weather] || 'Clear ☀️';
  const effectiveFormat = packetFormat || session?.PacketFormat;

  const formatSeconds = (secs: number) => {
    if (!secs) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderSafetyCarBadge = () => {
    if (session.SafetyCarStatus === 0) {
      return (
        <span className="session-badge badge-green">
          <Flag size={14} /> {t('live.greenFlag')}
        </span>
      );
    }
    if (session.SafetyCarStatus === 1) {
      return (
        <span className="session-badge badge-yellow glow-yellow">
          <ShieldAlert size={14} /> SAFETY CAR
        </span>
      );
    }
    if (session.SafetyCarStatus === 2) {
      return (
        <span className="session-badge badge-orange">
          <ShieldAlert size={14} /> VIRTUAL SAFETY CAR
        </span>
      );
    }
    if (session.SafetyCarStatus === 3) {
      return (
        <span className="session-badge badge-blue">
          <Flag size={14} /> {t('live.formationLap')}
        </span>
      );
    }
    return null;
  };

  const getHeaderBadgeClass = () => {
    if (sessionInfo.isSprint) return 'badge-orange';
    if (sessionInfo.isRace) return 'badge-red';
    if (sessionInfo.isQualy) return 'badge-purple';
    return 'badge-gray';
  };

  return (
    <header className="header session-header-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <TrackFlag track={session.TrackId} width={26} height={18} />
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>{trackName}</h1>

            <F1FormatBadge format={effectiveFormat} size="sm" />
            <span className={`session-badge ${getHeaderBadgeClass()}`}>
              {sessionInfo.label}
            </span>
          </div>
          <p className="mono" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            {t('live.commandCenter')}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Live View Mode Segmented Switcher */}
        {onViewModeChange && (
          <div className="live-view-mode-toggle" role="group" aria-label="Live View Mode">
            <button
              type="button"
              className={`live-view-toggle-btn ${viewMode === LIVE_VIEW_MODES.DASHBOARD ? 'active' : ''}`}
              onClick={() => onViewModeChange(LIVE_VIEW_MODES.DASHBOARD)}
              title={t('live.viewModeDashboard')}
              data-testid="live-view-toggle-dashboard"
            >
              <LayoutDashboard size={14} />
              <span>{t('live.viewModeDashboard')}</span>
            </button>
            <button
              type="button"
              className={`live-view-toggle-btn ${viewMode === LIVE_VIEW_MODES.COCKPIT ? 'active' : ''}`}
              onClick={() => onViewModeChange(LIVE_VIEW_MODES.COCKPIT)}
              title={t('live.viewModeCockpit')}
              data-testid="live-view-toggle-cockpit"
            >
              <Mic size={14} />
              <span>{t('live.viewModeCockpit')}</span>
            </button>
          </div>
        )}

        {/* Session Progress / Timer */}
        <div className="header-stat-box">
          <Timer size={16} color="var(--text-secondary)" />
          {sessionInfo.isRace ? (
            <div>
              <div className="stat-label">{t('live.totalLaps')}</div>
              <div className="stat-value mono">{session.TotalLaps ? `${session.TotalLaps} ${t('common.laps').toUpperCase()}` : 'TIME TRIAL'}</div>
            </div>
          ) : (
            <div>
              <div className="stat-label">{t('live.timeRemaining')}</div>
              <div className="stat-value mono">{session.SessionTimeLeft ? formatSeconds(session.SessionTimeLeft) : '--:--'}</div>
            </div>
          )}
        </div>

        {/* Weather & Temperatures */}
        <div className="header-stat-box">
          <CloudSun size={16} color="var(--text-secondary)" />
          <div>
            <div className="stat-label">{t('live.conditions')}</div>
            <div className="stat-value" style={{ fontSize: '0.85rem' }}>{weatherText}</div>
          </div>
        </div>

        <div className="header-stat-box">
          <Thermometer size={16} color="var(--text-secondary)" />
          <div>
            <div className="stat-label">{t('live.trackAirTemp')}</div>
            <div className="stat-value mono">
              {`${session.TrackTemperature}°C / ${session.AirTemperature}°C`}
            </div>
          </div>
        </div>

        {/* Safety Car Badge */}
        {renderSafetyCarBadge()}

        {/* WebSocket Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: '8px' }}>
          <span className={`status-dot ${connected ? 'status-live' : ''}`} />
          <span className="mono" style={{ marginLeft: '8px', color: connected ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            {connected ? t('live.liveStatus') : t('live.reconnecting')}
          </span>
        </div>
      </div>
    </header>
  );
});

SessionHeader.displayName = 'SessionHeader';




