import React from 'react';
import { Clock, ChevronRight, Trash2, ArrowUpDown, Plus, Download } from 'lucide-react';
import type { Session } from '../SessionHistory';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContextDefinitions';
import { formatDate as defaultFormatDate, getSessionBadgeClass as defaultGetSessionBadgeClass } from '../../utils/formatters';
import { TagBadge } from './TagBadge';
import { F1FormatBadge } from '../F1FormatBadge';
import { TrackFlag } from '../TrackFlag';
import { WeatherBadgeWithForecast } from './WeatherBadgeWithForecast';
import { getTrackInfo } from '../../constants/f1';

export interface SessionTableViewProps {
  sessions?: Session[];
  selectedSessionIds?: Set<number>;
  onToggleSelectSession?: (sessionId: number) => void;
  onToggleSelectAll?: () => void;
  onSelectSession?: (session: Session) => void;
  onRequestDelete?: (session: Session) => void;
  onExportSession?: (session: Session) => void;
  formatDate?: (dateStr?: string) => string;
  getSessionBadgeClass?: (typeStr?: string) => string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onToggleSort?: (field: string) => void;
  onOpenTagManager?: (session: Session) => void;
}

const getSessionTypeStripeClass = (typeStr?: string): string => {
  if (!typeStr) return 'session-stripe-default';
  const lower = typeStr.toLowerCase();
  if (lower.includes('race')) return 'session-stripe-race';
  if (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) return 'session-stripe-qualifying';
  if (lower.includes('sprint')) return 'session-stripe-sprint';
  if (lower.includes('practice') || lower.includes('fp')) return 'session-stripe-practice';
  return 'session-stripe-default';
};

export const SessionTableView: React.FC<SessionTableViewProps> = React.memo((props) => {
  const { t } = useI18n();

  const historyData = useSessionHistoryData();
  const historyActions = useSessionHistoryActions();

  const sessions = props.sessions ?? historyData.filteredSessions;
  const selectedSessionIds = props.selectedSessionIds ?? historyData.selectedSessionIds;
  const onToggleSelectSession = props.onToggleSelectSession ?? historyActions.handleToggleSelectSession;
  const onToggleSelectAll = props.onToggleSelectAll ?? historyActions.handleToggleSelectAll;
  const onSelectSession = props.onSelectSession ?? historyActions.selectSession;
  const onRequestDelete = props.onRequestDelete ?? historyActions.setSessionToDelete;
  const onExportSession = props.onExportSession ?? historyActions.handleExportSession;
  const formatDate = props.formatDate ?? defaultFormatDate;
  const getSessionBadgeClass = props.getSessionBadgeClass ?? defaultGetSessionBadgeClass;
  const sortField = props.sortField ?? historyData.sortField;
  const sortOrder = props.sortOrder ?? historyData.sortOrder;
  const onToggleSort = props.onToggleSort ?? historyActions.handleToggleSort;
  const onOpenTagManager = props.onOpenTagManager ?? historyActions.setSessionToManageTags;

  const isAllSelected = sessions.length > 0 && sessions.every((s) => selectedSessionIds?.has(s.id));
  const isSomeSelected = !isAllSelected && sessions.some((s) => selectedSessionIds?.has(s.id));

  const selectAllRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const renderSortIndicator = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.35 }} />;
    }
    return <span className="f1-sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="glass-panel f1-table-container" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="history-table f1-broadcast-table">
          <thead>
            <tr>
              {Boolean(onToggleSelectSession) && (
                <th className="th-checkbox">
                  <label className="f1-checkbox-label">
                    <input
                      type="checkbox"
                      ref={selectAllRef}
                      checked={isAllSelected}
                      onChange={() => onToggleSelectAll?.()}
                      title={isAllSelected ? t('history.batch.deselectAll') : t('history.batch.selectAll')}
                      className="f1-table-checkbox"
                    />
                  </label>
                </th>
              )}
              <th
                className="th-sortable"
                onClick={() => onToggleSort('date')}
              >
                <div className="th-sort-wrapper">
                  <span>{t('history.table.dateTime')}</span>
                  {renderSortIndicator('date')}
                </div>
              </th>
              <th
                className="th-sortable"
                onClick={() => onToggleSort('track')}
              >
                <div className="th-sort-wrapper">
                  <span>{t('history.table.trackName')}</span>
                  {renderSortIndicator('track')}
                </div>
              </th>
              <th
                className="th-sortable"
                onClick={() => onToggleSort('type')}
              >
                <div className="th-sort-wrapper">
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
              const stripeClass = getSessionTypeStripeClass(session.session_type);
              const trackInfo = getTrackInfo(session.track_name);
              const countryIso3 = trackInfo?.countryIso3 || null;

              return (
                <tr
                  key={session.id}
                  onClick={() => onSelectSession(session)}
                  className={`f1-session-row ${stripeClass} ${isSelected ? 'selected' : ''}`}
                >
                  {onToggleSelectSession && (
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="td-checkbox"
                    >
                      <label
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="f1-checkbox-label"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            onToggleSelectSession(session.id);
                          }}
                          className="f1-table-checkbox"
                        />
                      </label>
                    </td>
                  )}
                  <td className="f1-date-cell">
                    <div className="f1-date-wrapper">
                      <Clock size={13} className="f1-clock-icon" />
                      <span className="mono f1-date-text">{formatDate(session.created_at)}</span>
                    </div>
                  </td>
                  <td className="f1-track-cell">
                    <div className="f1-track-wrapper">
                      <TrackFlag track={session.track_name} width={20} height={14} />
                      {countryIso3 && (
                        <span className="f1-country-iso-badge mono">{countryIso3}</span>
                      )}
                      <span className="f1-track-title">
                        {session.track_name || t('common.unknownTrack')}
                      </span>
                    </div>
                  </td>
                  <td className="f1-type-cell">
                    <div className="f1-type-wrapper">
                      <F1FormatBadge format={session.packet_format} size="xs" />
                      <span className={`session-badge f1-broadcast-badge ${getSessionBadgeClass(session.session_type)}`}>
                        {session.session_type || 'RACE'}
                      </span>
                    </div>
                  </td>
                  <td className="f1-tags-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="f1-tags-wrapper">
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
                  <td className="f1-weather-cell" onClick={(e) => e.stopPropagation()}>
                    <WeatherBadgeWithForecast session={session} compact />
                  </td>
                  <td className="f1-actions-cell" style={{ textAlign: 'right' }}>
                    <div className="f1-actions-wrapper">
                      {onExportSession && (
                        <button
                          type="button"
                          className="f1-action-icon-btn export"
                          title={`${t('history.exportSession')} #${session.id}`}
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
                        type="button"
                        className="f1-action-icon-btn delete"
                        title={`${t('common.deleteSession')} #${session.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRequestDelete(session);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>

                      <button
                        type="button"
                        className="f1-row-navigate-btn"
                        title={t('common.explore')}
                        aria-label={t('common.explore')}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSession(session);
                        }}
                      >
                        <ChevronRight size={16} />
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
});

SessionTableView.displayName = 'SessionTableView';

