import React from 'react';
import { Clock, CloudSun, ChevronRight, Trash2, MapPin, Plus, Download } from 'lucide-react';
import type { Session } from '../SessionHistory';
import { useI18n } from '../../context/I18nContext';
import { TagBadge } from './TagBadge';
import { F1FormatBadge } from '../F1FormatBadge';

interface SessionCardGridProps {
  sessions: Session[];
  onSelectSession: (session: Session) => void;
  onRequestDelete: (session: Session) => void;
  onExportSession?: (session: Session) => void;
  formatDate: (dateStr?: string) => string;
  getSessionBadgeClass: (typeStr?: string) => string;
  onOpenTagManager: (session: Session) => void;
}

export const SessionCardGrid: React.FC<SessionCardGridProps> = ({
  sessions,
  onSelectSession,
  onRequestDelete,
  onExportSession,
  formatDate,
  getSessionBadgeClass,
  onOpenTagManager,
}) => {
  const { t } = useI18n();

  return (
    <div className="session-card-grid">
      {sessions.map((session) => {
        const badgeClass = getSessionBadgeClass(session.session_type);
        const isRace = session.session_type?.toLowerCase().includes('race');
        const sessionTags = session.tags || [];

        return (
          <div
            key={session.id}
            className="glass-panel session-glass-card"
            onClick={() => onSelectSession(session)}
          >
            {/* Card Header */}
            <div className="session-card-header">
              <div className="session-card-track-info">
                <div className="session-card-track-title">
                  <MapPin size={16} color="var(--accent-secondary)" />
                  <span className="track-name">{session.track_name || t('common.unknownTrack')}</span>
                </div>
                <span className="mono session-id-badge">#{session.id}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <F1FormatBadge format={session.packet_format} size="xs" />
                <span className={`session-badge ${badgeClass}`}>
                  {session.session_type || 'RACE'}
                </span>
              </div>
            </div>

            {/* Card Body Details */}
            <div className="session-card-body">
              <div className="session-card-meta-row">
                <div className="meta-item">
                  <Clock size={14} color="var(--text-muted)" />
                  <span>{formatDate(session.created_at)}</span>
                </div>
                <div className="meta-item">
                  <CloudSun size={14} color="var(--text-secondary)" />
                  <span>{session.weather || t('common.clearWeather')}</span>
                </div>
              </div>

              {/* Tags Row */}
              <div className="session-card-tags-row" onClick={(e) => e.stopPropagation()}>
                {sessionTags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} size="xs" />
                ))}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTagManager(session);
                  }}
                  className="session-add-tag-btn"
                  title={t('history.tags.manageTags')}
                >
                  <Plus size={11} />
                  <span>{sessionTags.length === 0 ? t('history.tags.addTag') : '+'}</span>
                </button>
              </div>

              <div className="session-card-tagline mono">
                UID: {session.session_uid || session.id} • {isRace ? t('common.grandPrixRace') : t('common.timedSession')}
              </div>
            </div>

            {/* Card Footer Actions */}
            <div className="session-card-footer">
              <button
                className="session-explore-btn"
                aria-label={`${t('common.exploreSession')} #${session.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSession(session);
                }}
              >
                <span>{t('common.exploreSession')}</span>
                <ChevronRight size={15} />
              </button>

              {onExportSession && (
                <button
                  className="session-delete-icon-btn"
                  title={`${t('history.exportSession')} #${session.id}`}
                  style={{ color: 'var(--accent-secondary)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExportSession(session);
                  }}
                >
                  <Download size={15} />
                </button>
              )}

              <button
                className="session-delete-icon-btn"
                title={`${t('common.deleteSession')} #${session.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDelete(session);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
