import React from 'react';
import { Flag, CloudSun, Thermometer, ShieldAlert, Timer } from 'lucide-react';
import type { SessionData } from '../hooks/useTelemetry';

interface SessionHeaderProps {
  session: SessionData | null;
  connected: boolean;
}

const TRACK_NAMES: Record<number, string> = {
  0: 'Melbourne', 1: 'Paul Ricard', 2: 'Shanghai', 3: 'Bahrain',
  4: 'Catalunya', 5: 'Monaco', 6: 'Montreal', 7: 'Silverstone',
  8: 'Hockenheim', 9: 'Hungaroring', 10: 'Spa-Francorchamps', 11: 'Monza',
  12: 'Singapore', 13: 'Suzuka', 14: 'Abu Dhabi', 15: 'Austin',
  16: 'Interlagos', 17: 'Red Bull Ring', 18: 'Sochi', 19: 'Mexico City',
  20: 'Baku', 21: 'Sakhir Short', 22: 'Silverstone Short', 23: 'Austin Short',
  24: 'Suzuka Short', 25: 'Hanoi', 26: 'Zandvoort', 27: 'Imola',
  28: 'Portimão', 29: 'Jeddah', 30: 'Miami', 31: 'Las Vegas',
  32: 'Losail', 33: 'Lusail',
};

const WEATHER_NAMES: Record<number, string> = {
  0: 'Clear ☀️', 1: 'Light Cloud ⛅', 2: 'Overcast ☁️',
  3: 'Light Rain 🌧️', 4: 'Heavy Rain 🌧️', 5: 'Storm ⛈️',
};

const SESSION_TYPES: Record<number, { label: string; isRace: boolean; isQualy: boolean }> = {
  1: { label: 'PRACTICE 1', isRace: false, isQualy: false },
  2: { label: 'PRACTICE 2', isRace: false, isQualy: false },
  3: { label: 'PRACTICE 3', isRace: false, isQualy: false },
  4: { label: 'SHORT PRACTICE', isRace: false, isQualy: false },
  5: { label: 'QUALIFYING 1', isRace: false, isQualy: true },
  6: { label: 'QUALIFYING 2', isRace: false, isQualy: true },
  7: { label: 'QUALIFYING 3', isRace: false, isQualy: true },
  8: { label: 'SHORT QUALIFYING', isRace: false, isQualy: true },
  9: { label: 'ONE-SHOT QUALI', isRace: false, isQualy: true },
  10: { label: 'RACE', isRace: true, isQualy: false },
  11: { label: 'RACE 2', isRace: true, isQualy: false },
  12: { label: 'RACE 3', isRace: true, isQualy: false },
  13: { label: 'TIME TRIAL', isRace: false, isQualy: false },
};

export const SessionHeader: React.FC<SessionHeaderProps> = ({ session, connected }) => {
  const trackName = session?.TrackId !== undefined ? (TRACK_NAMES[session.TrackId] || `Track #${session.TrackId}`) : 'Albert Park';
  const sessionInfo = session?.SessionType !== undefined ? (SESSION_TYPES[session.SessionType] || { label: 'LIVE SESSION', isRace: false, isQualy: false }) : { label: 'LIVE SESSION', isRace: false, isQualy: false };
  const weatherText = session?.Weather !== undefined ? (WEATHER_NAMES[session.Weather] || 'Clear') : 'Clear ☀️';

  const formatSeconds = (secs: number) => {
    if (!secs) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderSafetyCarBadge = () => {
    if (!session || session.SafetyCarStatus === 0) {
      return (
        <span className="session-badge badge-green">
          <Flag size={14} /> GREEN FLAG
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
          <Flag size={14} /> FORMATION LAP
        </span>
      );
    }
    return null;
  };

  return (
    <header className="header session-header-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>{trackName}</h1>
            <span className={`session-badge ${sessionInfo.isRace ? 'badge-red' : sessionInfo.isQualy ? 'badge-purple' : 'badge-gray'}`}>
              {sessionInfo.label}
            </span>
          </div>
          <p className="mono" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            F1 Telemetry Command Center
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Session Progress / Timer */}
        <div className="header-stat-box">
          <Timer size={16} color="var(--text-secondary)" />
          {sessionInfo.isRace ? (
            <div>
              <div className="stat-label">TOTAL LAPS</div>
              <div className="stat-value mono">{session?.TotalLaps ? `${session.TotalLaps} LAPS` : 'TIME TRIAL'}</div>
            </div>
          ) : (
            <div>
              <div className="stat-label">TIME REMAINING</div>
              <div className="stat-value mono">{session?.SessionTimeLeft ? formatSeconds(session.SessionTimeLeft) : '--:--'}</div>
            </div>
          )}
        </div>

        {/* Weather & Temperatures */}
        <div className="header-stat-box">
          <CloudSun size={16} color="var(--text-secondary)" />
          <div>
            <div className="stat-label">CONDITIONS</div>
            <div className="stat-value" style={{ fontSize: '0.85rem' }}>{weatherText}</div>
          </div>
        </div>

        <div className="header-stat-box">
          <Thermometer size={16} color="var(--text-secondary)" />
          <div>
            <div className="stat-label">TRACK / AIR TEMP</div>
            <div className="stat-value mono">
              {session ? `${session.TrackTemperature}°C / ${session.AirTemperature}°C` : '--°C / --°C'}
            </div>
          </div>
        </div>

        {/* Safety Car Badge */}
        {renderSafetyCarBadge()}

        {/* WebSocket Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: '8px' }}>
          <span className={`status-dot ${connected ? 'status-live' : ''}`} />
          <span className="mono" style={{ marginLeft: '8px', color: connected ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </span>
        </div>
      </div>
    </header>
  );
};
