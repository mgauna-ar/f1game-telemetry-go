import React from 'react';
import { Calendar, Flag, MapPin, Trophy } from 'lucide-react';
import type { Session } from '../SessionHistory';

interface SessionKPIBarProps {
  sessions: Session[];
}

export const SessionKPIBar: React.FC<SessionKPIBarProps> = ({ sessions }) => {
  const totalSessions = sessions.length;

  // Track frequency calculation
  const trackCounts: Record<string, number> = {};
  sessions.forEach((s) => {
    const track = s.track_name || 'Unknown Track';
    trackCounts[track] = (trackCounts[track] || 0) + 1;
  });

  let topTrack = '--';
  let maxTrackCount = 0;
  Object.entries(trackCounts).forEach(([track, count]) => {
    if (count > maxTrackCount) {
      maxTrackCount = count;
      topTrack = track;
    }
  });

  // Session type breakdown
  const raceCount = sessions.filter((s) => s.session_type?.toLowerCase().includes('race')).length;
  const qualiCount = sessions.filter((s) => s.session_type?.toLowerCase().includes('qual')).length;

  return (
    <div className="session-kpi-grid">
      {/* KPI 1: Total Sessions */}
      <div className="glass-panel session-kpi-card">
        <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(225, 6, 0, 0.12)', color: 'var(--accent-primary)' }}>
          <Calendar size={22} />
        </div>
        <div className="kpi-content">
          <div className="kpi-label">TOTAL SESSIONS</div>
          <div className="kpi-value mono">{totalSessions}</div>
          <div className="kpi-subtext">
            {raceCount} Races • {qualiCount} Qualifying
          </div>
        </div>
      </div>

      {/* KPI 2: Most Visited Circuit */}
      <div className="glass-panel session-kpi-card">
        <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(0, 242, 254, 0.12)', color: 'var(--accent-secondary)' }}>
          <MapPin size={22} />
        </div>
        <div className="kpi-content">
          <div className="kpi-label">MOST VISITED CIRCUIT</div>
          <div className="kpi-value" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={topTrack}>
            {topTrack}
          </div>
          <div className="kpi-subtext">
            {maxTrackCount > 0 ? `${maxTrackCount} session${maxTrackCount > 1 ? 's' : ''} logged` : 'No track data'}
          </div>
        </div>
      </div>

      {/* KPI 3: Database Telemetry Status */}
      <div className="glass-panel session-kpi-card">
        <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(51, 255, 119, 0.12)', color: 'var(--accent-tertiary)' }}>
          <Flag size={22} />
        </div>
        <div className="kpi-content">
          <div className="kpi-label">TELEMETRY REPOSITORY</div>
          <div className="kpi-value mono" style={{ fontSize: '1.25rem', color: 'var(--accent-tertiary)' }}>
            ONLINE
          </div>
          <div className="kpi-subtext">
            F1 2025/2026 SQLite Storage
          </div>
        </div>
      </div>

      {/* KPI 4: Historical Analysis */}
      <div className="glass-panel session-kpi-card">
        <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(255, 215, 0, 0.12)', color: '#ffd700' }}>
          <Trophy size={22} />
        </div>
        <div className="kpi-content">
          <div className="kpi-label">HISTORICAL ANALYSIS</div>
          <div className="kpi-value" style={{ fontSize: '1.1rem' }}>
            Deep Analytics
          </div>
          <div className="kpi-subtext">
            Sectors • Stints • AI Debrief
          </div>
        </div>
      </div>
    </div>
  );
};
