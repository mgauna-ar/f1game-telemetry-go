import React from 'react';
import { Clock, ChevronRight, Trash2, MapPin, Plus, Download } from 'lucide-react';
import type { Session } from '../SessionHistory';
import { useI18n } from '../../context/I18nContext';
import { TagBadge } from './TagBadge';
import { F1FormatBadge } from '../F1FormatBadge';
import { WeatherBadgeWithForecast } from './WeatherBadgeWithForecast';
import { formatSessionUID } from '../../utils/formatters';

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
    <div className="session-cards-grid">
      {sessions.map((session) => {
        const badgeClass = getSessionBadgeClass(session.session_type);
        const isRace = session.session_type?.toLowerCase().includes('race');
        const sessionTags = session.tags || [];

        return (
          <div
            key={session.id}
            className="session-card glass-panel"
            onClick={() => onSelectSession(session)}
          >
            {/* Card Top Row */}
            <div className="session-card-top-row">
              <div className="session-card-track">
                <MapPin size={16} color="var(--accent-secondary)" />
                <span className="session-track-name">{session.track_name}</span>
                <span className="session-id-pill mono">#{session.id}</span>
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
                <div className="meta-item" onClick={(e) => e.stopPropagation()}>
                  <WeatherBadgeWithForecast session={session} />
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
                UID: {formatSessionUID(session.session_uid || session.id)} • {isRace ? t('common.grandPrixRace') : t('common.timedSession')}
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
