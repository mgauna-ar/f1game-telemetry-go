import React from 'react';
import { Clock, CloudSun, ChevronRight, Trash2, ArrowUpDown, Plus, Download } from 'lucide-react';
import type { Session } from '../SessionHistory';
import { useI18n } from '../../context/I18nContext';
import { TagBadge } from './TagBadge';
import { F1FormatBadge } from '../F1FormatBadge';

interface SessionTableViewProps {
  sessions: Session[];
  onSelectSession: (session: Session) => void;
  onRequestDelete: (session: Session) => void;
  onExportSession?: (session: Session) => void;
  formatDate: (dateStr?: string) => string;
  getSessionBadgeClass: (typeStr?: string) => string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onToggleSort?: (field: string) => void;
  onOpenTagManager: (session: Session) => void;
}

export const SessionTableView: React.FC<SessionTableViewProps> = ({
  sessions,
  onSelectSession,
  onRequestDelete,
  onExportSession,
  formatDate,
  getSessionBadgeClass,
  sortField,
  sortOrder,
  onToggleSort,
  onOpenTagManager,
}) => {
  const { t } = useI18n();

  const renderSortIndicator = (field: string) => {
    if (!onToggleSort) return null;
    if (sortField !== field) return <ArrowUpDown size={12} color="var(--text-muted)" />;
    return <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)' }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="glass-panel" style={{ padding: '1rem' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="history-table">
          <thead>
            <tr>
              <th
                style={{ cursor: onToggleSort ? 'pointer' : 'default' }}
                onClick={() => onToggleSort && onToggleSort('id')}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>{t('history.table.sessionId')}</span>
                  {renderSortIndicator('id')}
                </div>
              </th>
              <th
                style={{ cursor: onToggleSort ? 'pointer' : 'default' }}
                onClick={() => onToggleSort && onToggleSort('date')}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>{t('history.table.dateTime')}</span>
                  {renderSortIndicator('date')}
                </div>
              </th>
              <th
                style={{ cursor: onToggleSort ? 'pointer' : 'default' }}
                onClick={() => onToggleSort && onToggleSort('track')}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>{t('history.table.trackName')}</span>
                  {renderSortIndicator('track')}
                </div>
              </th>
              <th
                style={{ cursor: onToggleSort ? 'pointer' : 'default' }}
                onClick={() => onToggleSort && onToggleSort('type')}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>{t('history.table.sessionType')}</span>
                  {renderSortIndicator('type')}
                </div>
              </th>
              <th>{t('history.tags.title')}</th>
              <th>{t('history.table.weather')}</th>
              <th style={{ textAlign: 'right' }}>{t('history.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const sessionTags = session.tags || [];

              return (
                <tr
                  key={session.id}
                  onClick={() => onSelectSession(session)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>
                    #{session.id}
                  </td>
                  <td style={{ color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      {formatDate(session.created_at)}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                      {session.track_name || t('common.unknownTrack')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <F1FormatBadge format={session.packet_format} size="xs" />
                      <span className={`session-badge ${getSessionBadgeClass(session.session_type)}`}>
                        {session.session_type || 'RACE'}
                      </span>
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
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
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                      <CloudSun size={14} color="var(--text-secondary)" />
                      {session.weather || t('common.clearWeather')}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="nav-tab active"
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSession(session);
                        }}
                      >
                        {t('common.explore')} <ChevronRight size={14} />
                      </button>

                      {onExportSession && (
                        <button
                          className="nav-tab"
                          title={`${t('history.exportSession')} #${session.id}`}
                          style={{
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--accent-secondary)',
                            borderColor: 'rgba(0, 242, 254, 0.3)',
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onExportSession(session);
                          }}
                        >
                          <Download size={14} />
                        </button>
                      )}

                      <button
                        className="nav-tab"
                        title={`${t('common.deleteSession')} #${session.id}`}
                        style={{
                          padding: '0.4rem 0.6rem',
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#ff4d4f',
                          borderColor: 'rgba(255, 77, 79, 0.3)',
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRequestDelete(session);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
