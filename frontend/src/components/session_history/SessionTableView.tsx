import React from 'react';
import { Clock, ChevronRight, Trash2, ArrowUpDown, Plus, Download } from 'lucide-react';
import type { Session } from '../SessionHistory';
import { useI18n } from '../../context/I18nContext';
import { TagBadge } from './TagBadge';
import { F1FormatBadge } from '../F1FormatBadge';
import { TrackFlag } from '../TrackFlag';
import { WeatherBadgeWithForecast } from './WeatherBadgeWithForecast';

interface SessionTableViewProps {
  sessions: Session[];
  selectedSessionIds?: Set<number>;
  onToggleSelectSession?: (sessionId: number) => void;
  onToggleSelectAll?: () => void;
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
  selectedSessionIds,
  onToggleSelectSession,
  onToggleSelectAll,
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

  const isAllSelected = sessions.length > 0 && sessions.every((s) => selectedSessionIds?.has(s.id));
  const isSomeSelected = !isAllSelected && sessions.some((s) => selectedSessionIds?.has(s.id));

  const selectAllRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

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
              {onToggleSelectSession && (
                <th style={{ width: '42px', textAlign: 'center', padding: '0 0.4rem', verticalAlign: 'middle' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      width: '100%',
                      height: '100%',
                      padding: '0.4rem 0',
                    }}
                  >
                    <input
                      type="checkbox"
                      ref={selectAllRef}
                      checked={isAllSelected}
                      onChange={() => onToggleSelectAll && onToggleSelectAll()}
                      title={isAllSelected ? t('history.batch.deselectAll') : t('history.batch.selectAll')}
                      style={{
                        cursor: 'pointer',
                        accentColor: 'var(--accent-secondary, #00f2fe)',
                        width: '16px',
                        height: '16px',
                        margin: 0,
                      }}
                    />
                  </label>
                </th>
              )}
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
              const isSelected = selectedSessionIds?.has(session.id) || false;

              return (
                <tr
                  key={session.id}
                  onClick={() => onSelectSession(session)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(0, 242, 254, 0.08)' : undefined,
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {onToggleSelectSession && (
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      style={{
                        width: '42px',
                        textAlign: 'center',
                        padding: 0,
                        verticalAlign: 'middle',
                      }}
                    >
                      <label
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          minHeight: '44px',
                          cursor: 'pointer',
                          padding: '0.6rem 0.4rem',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            onToggleSelectSession(session.id);
                          }}
                          style={{
                            cursor: 'pointer',
                            accentColor: 'var(--accent-secondary, #00f2fe)',
                            width: '16px',
                            height: '16px',
                            margin: 0,
                          }}
                        />
                      </label>
                    </td>
                  )}
                  <td style={{ color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      {formatDate(session.created_at)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <TrackFlag track={session.track_name} width={20} height={14} />
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                        {session.track_name || t('common.unknownTrack')}
                      </span>
                    </div>
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
                        className={`session-add-tag-btn ${sessionTags.length > 0 ? 'icon-only' : ''}`}
                        title={t('history.tags.manageTags')}
                      >
                        <Plus size={sessionTags.length > 0 ? 12 : 11} />
                        {sessionTags.length === 0 && <span>{t('history.tags.addTag')}</span>}
                      </button>
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <WeatherBadgeWithForecast session={session} compact />
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
