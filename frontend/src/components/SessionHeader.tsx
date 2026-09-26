import React from 'react';
import { Flag, CloudSun, Thermometer, ShieldAlert, Timer, LayoutDashboard, Mic, Radio } from 'lucide-react';
import type { SessionData } from '../hooks/useTelemetry';
import { useI18n } from '../context/I18nContext';
import { F1FormatBadge } from './F1FormatBadge';
import { TrackFlag } from './TrackFlag';
import { LiveStatusIndicator } from './common/LiveStatusIndicator';
import { SessionTypeBadge } from './common/SessionTypeBadge';
import { Badge } from './ui/Badge';
import { SegmentedControl } from './ui/SegmentedControl';
import { Stat } from './ui/Stat';
import {
  TRACK_NAMES,
  getTrackInfo,
  LIVE_VIEW_MODES,
  SAFETY_CAR_STATUS,
  SESSION_TYPE_LABELS,
  WEATHER_CODES,
  WEATHER_LABEL_KEYS,
  TIME_CONSTANTS,
  isRaceSession,
} from '../constants/f1';
import type { LiveViewMode } from '../constants/f1';

import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryEndpointStore } from '../store/useTelemetryEndpointStore';

/** Switches the live page between the race control dashboard and the voice cockpit. */
const ViewModeSwitch: React.FC<{ value: LiveViewMode; onChange: (mode: LiveViewMode) => void }> = ({
  value,
  onChange,
}) => {
  const { t } = useI18n();
  return (
    <SegmentedControl
      aria-label={t('live.viewModeLabel')}
      value={value}
      onChange={onChange}
      options={[
        {
          value: LIVE_VIEW_MODES.DASHBOARD,
          label: t('live.viewModeDashboard'),
          icon: <LayoutDashboard size={14} aria-hidden="true" />,
          'data-testid': 'live-view-toggle-dashboard',
        },
        {
          value: LIVE_VIEW_MODES.COCKPIT,
          label: t('live.viewModeCockpit'),
          icon: <Mic size={14} aria-hidden="true" />,
          'data-testid': 'live-view-toggle-cockpit',
        },
      ]}
    />
  );
};

interface SessionHeaderProps {
  session?: SessionData | null;
  connected?: boolean;
  packetFormat?: number | null;
  viewMode?: LiveViewMode;
  onViewModeChange?: (mode: LiveViewMode) => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = React.memo((props) => {
  const storeSession = useSessionStatusStore((s) => s.session);
  const storeConnected = useSessionStatusStore((s) => s.connected);
  const storePacketFormat = useSessionStatusStore((s) => s.packetFormat);

  const session = props.session !== undefined ? props.session : storeSession;
  const connected = props.connected !== undefined ? props.connected : storeConnected;
  const packetFormat = props.packetFormat !== undefined ? props.packetFormat : storePacketFormat;
  const viewMode = props.viewMode ?? LIVE_VIEW_MODES.DASHBOARD;
  const onViewModeChange = props.onViewModeChange;

  const { t } = useI18n();
  const udpPort = useTelemetryEndpointStore((s) => s.endpoint.udp_port);

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
                <Badge tone={connected ? 'success' : 'warning'} uppercase>
                  {connected ? t('live.backendConnected') : t('live.connectingToBackend')}
                </Badge>
              </div>
              <p className="mono" style={{ color: 'var(--text-secondary)', margin: '2px 0 0 0', fontSize: '0.80rem' }}>
                {t('live.commandCenter')} • UDP {udpPort}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'nowrap' }}>
          {onViewModeChange && <ViewModeSwitch value={viewMode} onChange={onViewModeChange} />}

          {/* Live feed state */}
          <LiveStatusIndicator />
        </div>
      </header>
    );
  }

  // Active Session rendering
  const trackInfo = getTrackInfo(session.TrackId);
  const trackName = trackInfo?.name || TRACK_NAMES[session.TrackId] || `Track #${session.TrackId}`;
  const sessionLabel = SESSION_TYPE_LABELS[session.SessionType] || t('nav.tabs.live');
  const isRace = isRaceSession(session.SessionType);
  const weatherText = t(WEATHER_LABEL_KEYS[session.Weather] ?? WEATHER_LABEL_KEYS[WEATHER_CODES.CLEAR]);
  const effectiveFormat = packetFormat || session?.PacketFormat;

  const formatSeconds = (secs: number) => {
    if (!secs) return '--:--';
    const m = Math.floor(secs / TIME_CONSTANTS.SECONDS_PER_MINUTE);
    const s = secs % TIME_CONSTANTS.SECONDS_PER_MINUTE;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderSafetyCarBadge = () => {
    if (session.SafetyCarStatus === SAFETY_CAR_STATUS.CLEAR) {
      return (
        <Badge tone="success" size="md" uppercase icon={<Flag size={14} aria-hidden="true" />}>
          {t('live.greenFlag')}
        </Badge>
      );
    }
    if (session.SafetyCarStatus === SAFETY_CAR_STATUS.FULL) {
      return (
        <Badge tone="warning" size="md" uppercase className="glow-yellow" icon={<ShieldAlert size={14} aria-hidden="true" />}>
          {t('live.safetyCarStatus')}
        </Badge>
      );
    }
    if (session.SafetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL) {
      return (
        <Badge tone="orange" size="md" uppercase icon={<ShieldAlert size={14} aria-hidden="true" />}>
          {t('live.vscStatus')}
        </Badge>
      );
    }
    if (session.SafetyCarStatus === SAFETY_CAR_STATUS.FORMATION_LAP) {
      return (
        <Badge tone="info" size="md" uppercase icon={<Flag size={14} aria-hidden="true" />}>
          {t('live.formationLap')}
        </Badge>
      );
    }
    return null;
  };

  return (
    <header className="header session-header-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <TrackFlag track={session.TrackId} width={26} height={18} />
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>{trackName}</h1>

            <F1FormatBadge format={effectiveFormat} size="sm" />
            <SessionTypeBadge sessionType={sessionLabel} size="sm" />
          </div>
          <p className="mono" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            {t('live.commandCenter')}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {onViewModeChange && <ViewModeSwitch value={viewMode} onChange={onViewModeChange} />}

        {/* Session Progress / Timer */}
        {isRace ? (
          <Stat
            icon={<Timer size={16} />}
            label={t('live.totalLaps')}
            value={session.TotalLaps ? `${session.TotalLaps} ${t('common.laps').toUpperCase()}` : '--'}
          />
        ) : (
          <Stat
            icon={<Timer size={16} />}
            label={t('live.timeRemaining')}
            value={session.SessionTimeLeft ? formatSeconds(session.SessionTimeLeft) : '--:--'}
          />
        )}

        {/* Weather & Temperatures */}
        <Stat icon={<CloudSun size={16} />} label={t('live.conditions')} value={weatherText} mono={false} />
        <Stat
          icon={<Thermometer size={16} />}
          label={t('live.trackAirTemp')}
          value={`${session.TrackTemperature}°C / ${session.AirTemperature}°C`}
        />

        {/* Safety Car Badge */}
        {renderSafetyCarBadge()}

        {/* Live feed state */}
        <LiveStatusIndicator />
      </div>
    </header>
  );
});

SessionHeader.displayName = 'SessionHeader';




