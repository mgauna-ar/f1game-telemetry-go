import React from 'react';
import { Calendar, Flag, MapPin, Trophy } from 'lucide-react';
import type { Session } from '../SessionHistory';
import { useI18n } from '../../context/I18nContext';

interface SessionKPIBarProps {
  sessions: Session[];
}

export const SessionKPIBar: React.FC<SessionKPIBarProps> = ({ sessions }) => {
  const { t } = useI18n();
  const totalSessions = sessions.length;

  // Track frequency calculation
  const trackCounts: Record<string, number> = {};
  sessions.forEach((s) => {
    const track = s.track_name || t('common.unknownTrack');
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
          <div className="kpi-label">{t('history.kpi.totalSessionsLabel')}</div>
          <div className="kpi-value mono">{totalSessions}</div>
          <div className="kpi-subtext">
            {t('history.kpi.racesQualifying', { races: raceCount, quali: qualiCount })}
          </div>
        </div>
      </div>

      {/* KPI 2: Most Visited Circuit */}
      <div className="glass-panel session-kpi-card">
        <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(0, 242, 254, 0.12)', color: 'var(--accent-secondary)' }}>
          <MapPin size={22} />
        </div>
        <div className="kpi-content">
          <div className="kpi-label">{t('history.kpi.mostVisited')}</div>
          <div className="kpi-value" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={topTrack}>
            {topTrack}
          </div>
          <div className="kpi-subtext">
            {maxTrackCount > 0
              ? t('history.kpi.sessionsLogged', { count: maxTrackCount })
              : t('history.kpi.noTrackData')}
          </div>
        </div>
      </div>

      {/* KPI 3: Database Telemetry Status */}
      <div className="glass-panel session-kpi-card">
        <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(51, 255, 119, 0.12)', color: 'var(--accent-tertiary)' }}>
          <Flag size={22} />
        </div>
        <div className="kpi-content">
          <div className="kpi-label">{t('history.kpi.telemetryRepository')}</div>
          <div className="kpi-value mono" style={{ fontSize: '1.25rem', color: 'var(--accent-tertiary)' }}>
            {t('history.kpi.online')}
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
          <div className="kpi-label">{t('history.kpi.historicalAnalysis')}</div>
          <div className="kpi-value" style={{ fontSize: '1.1rem' }}>
            {t('history.kpi.deepAnalytics')}
          </div>
          <div className="kpi-subtext">
            {t('history.kpi.deepAnalyticsSub')}
          </div>
        </div>
      </div>
    </div>
  );
};
