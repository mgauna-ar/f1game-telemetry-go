import React from 'react';
import { Clock, ChevronRight, Trash2, Download } from 'lucide-react';
import type { Session } from '../SessionHistory';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContextDefinitions';
import { formatDate as defaultFormatDate } from '../../utils/formatters';
import { SessionTypeBadge } from '../common/SessionTypeBadge';
import { AddTagButton, TagBadge } from './TagBadge';
import { F1FormatBadge } from '../F1FormatBadge';
import { TrackFlag } from '../TrackFlag';
import { WeatherBadgeWithForecast } from './WeatherBadgeWithForecast';
import { getTrackInfo } from '../../constants/f1';
import { IconButton } from '../ui/Button';
import { cx } from '../ui/cx';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import styles from './SessionTableView.module.css';

export interface SessionTableViewProps {
  sessions?: Session[];
  selectedSessionIds?: Set<number>;
  onToggleSelectSession?: (sessionId: number) => void;
  onToggleSelectAll?: () => void;
  onSelectSession?: (session: Session) => void;
  onRequestDelete?: (session: Session) => void;
  onExportSession?: (session: Session) => void;
  formatDate?: (dateStr?: string) => string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onToggleSort?: (field: string) => void;
  onOpenTagManager?: (session: Session) => void;
}

/** The colour of a row's left edge, by session type. */
const getSessionStripe = (typeStr?: string): string | undefined => {
  if (!typeStr) return undefined;
  const lower = typeStr.toLowerCase();
  if (lower.includes('race')) return styles.race;
  if (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3'))
    return styles.qualifying;
  if (lower.includes('sprint')) return styles.sprint;
  if (lower.includes('practice') || lower.includes('fp')) return styles.practice;
  return undefined;
};

/** Keeps a click inside a cell (a checkbox, a tag, the forecast) from also opening the session. */
const StopRowClick: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div role="presentation" className={className} onClick={(e) => e.stopPropagation()}>
    {children}
  </div>
);

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

  const selectAllLabel = isAllSelected ? t('history.batch.deselectAll') : t('history.batch.selectAll');

  const columns: DataTableColumn<Session>[] = [
    ...(onToggleSelectSession
      ? [
          {
            key: 'select',
            header: (
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  ref={selectAllRef}
                  checked={isAllSelected}
                  onChange={() => onToggleSelectAll?.()}
                  title={selectAllLabel}
                  aria-label={selectAllLabel}
                  className={styles.checkbox}
                />
              </label>
            ),
            width: '44px',
            align: 'center' as const,
            cell: (session: Session) => (
              <StopRowClick>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedSessionIds?.has(session.id) || false}
                    onChange={() => onToggleSelectSession(session.id)}
                    aria-label={t('history.batch.selectSession', { id: session.id })}
                    className={styles.checkbox}
                  />
                </label>
              </StopRowClick>
            ),
          },
        ]
      : []),
    {
      key: 'date',
      header: t('history.table.dateTime'),
      sortable: true,
      cell: (session) => (
        <div className={styles.date}>
          <Clock size={13} className={styles.clock} aria-hidden="true" />
          <span className={styles.dateText}>{formatDate(session.created_at)}</span>
        </div>
      ),
    },
    {
      key: 'track',
      header: t('history.table.trackName'),
      sortable: true,
      rowHeader: true,
      cell: (session) => {
        const countryIso3 = getTrackInfo(session.track_name)?.countryIso3 || null;
        return (
          <div className={styles.track}>
            <TrackFlag track={session.track_name} width={20} height={14} />
            {countryIso3 && <span className={styles.iso}>{countryIso3}</span>}
            <span className={styles.trackName}>{session.track_name || t('common.unknownTrack')}</span>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: t('history.table.sessionType'),
      sortable: true,
      cell: (session) => (
        <div className={styles.type}>
          <F1FormatBadge format={session.packet_format} size="xs" />
          <SessionTypeBadge sessionType={session.session_type || 'RACE'} size="xs" showIcon={false} />
        </div>
      ),
    },
    {
      key: 'tags',
      header: t('history.tags.title'),
      cell: (session) => {
        const sessionTags = session.tags || [];
        return (
          <StopRowClick className={styles.tags}>
            {sessionTags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} size="xs" />
            ))}
            <AddTagButton compact hasTags={sessionTags.length > 0} onClick={() => onOpenTagManager(session)} />
          </StopRowClick>
        );
      },
    },
    {
      key: 'weather',
      header: t('history.table.weather'),
      cell: (session) => (
        <StopRowClick>
          <WeatherBadgeWithForecast session={session} compact />
        </StopRowClick>
      ),
    },
    {
      key: 'actions',
      header: t('history.table.actions'),
      align: 'right',
      cell: (session) => (
        <div className={styles.actions}>
          {onExportSession && (
            <IconButton
              size="sm"
              variant="secondary"
              className={styles.export}
              label={`${t('history.exportSession')} #${session.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onExportSession(session);
              }}
            >
              <Download size={14} />
            </IconButton>
          )}
          <IconButton
            size="sm"
            variant="secondary"
            className={styles.delete}
            label={`${t('common.deleteSession')} #${session.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete(session);
            }}
          >
            <Trash2 size={14} />
          </IconButton>
          <IconButton
            size="sm"
            className={styles.explore}
            label={t('common.explore')}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSession(session);
            }}
          >
            <ChevronRight size={16} />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <DataTable
        caption={t('history.table.caption')}
        columns={columns}
        rows={sessions}
        getRowKey={(session) => session.id}
        sort={sortField ? { key: sortField, direction: sortOrder } : null}
        onSortChange={onToggleSort}
        // Clicking the row is a shortcut for its Explore button
        onRowClick={onSelectSession}
        getRowClassName={(session) =>
          cx(getSessionStripe(session.session_type), selectedSessionIds?.has(session.id) && styles.selected)
        }
        tableClassName={styles.table}
      />
    </div>
  );
});

SessionTableView.displayName = 'SessionTableView';
