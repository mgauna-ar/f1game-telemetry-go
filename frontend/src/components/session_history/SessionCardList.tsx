import React from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronRight, Clock } from 'lucide-react';
import type { SessionListItem as Session } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { getTrackInfo } from '../../constants/f1';
import { SessionTypeBadge } from '../common/SessionTypeBadge';
import { F1FormatBadge } from '../F1FormatBadge';
import { TrackFlag } from '../TrackFlag';
import { AddTagButton, TagBadge } from './TagBadge';
import { WeatherBadgeWithForecast } from './WeatherBadgeWithForecast';
import { Button, IconButton } from '../ui/Button';
import { Select } from '../ui/Field';
import { sessionKind } from './sessionKind';
import { commonPacketFormat } from './packetFormat';
import { YourResult } from './YourResult';
import { SessionActionsMenu } from './SessionActionsMenu';
import { SessionGroupHeading } from './SessionGroupHeading';
import { SessionListMore } from './SessionListMore';
import { useSessionListPaging, type SessionListPaging } from '../../hooks/useSessionListPaging';
import styles from './SessionCardList.module.css';

const SORT_FIELDS = [
  { field: 'date', labelKey: 'history.table.dateTime' },
  { field: 'track', labelKey: 'history.table.trackName' },
  { field: 'type', labelKey: 'history.table.sessionType' },
] as const;

export interface SessionCardListProps {
  sessions: Session[];
  selectedSessionIds?: Set<number>;
  onToggleSelectSession?: (sessionId: number) => void;
  onToggleSelectAll?: () => void;
  onSelectSession: (session: Session) => void;
  onRequestDelete: (session: Session) => void;
  onExportSession?: (session: Session) => void;
  formatDate: (dateStr?: string) => string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onToggleSort?: (field: string) => void;
  onOpenTagManager: (session: Session) => void;
  /** The grouped, paged list from the table view; without it the cards are one ungrouped list. */
  paging?: SessionListPaging;
}

/**
 * The session list on tablets and phones: one card per session, with the table's sorting as a
 * menu and the same actions.
 */
export const SessionCardList: React.FC<SessionCardListProps> = ({
  sessions,
  selectedSessionIds,
  onToggleSelectSession,
  onToggleSelectAll,
  onSelectSession,
  onRequestDelete,
  onExportSession,
  formatDate,
  sortField,
  sortOrder,
  onToggleSort,
  onOpenTagManager,
  paging: sharedPaging,
}) => {
  const { t } = useI18n();
  const ownPaging = useSessionListPaging(sessions, 'none', false);
  const paging = sharedPaging ?? ownPaging;
  const grouped = paging.groups.some((g) => g.kind !== 'none');
  const TrackHeading = grouped ? 'h3' : 'h2';
  const isAllSelected = sessions.length > 0 && sessions.every((s) => selectedSessionIds?.has(s.id));
  const isSomeSelected = !isAllSelected && sessions.some((s) => selectedSessionIds?.has(s.id));
  const usualFormat = React.useMemo(() => commonPacketFormat(sessions), [sessions]);
  const selectAllRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = isSomeSelected;
  }, [isSomeSelected]);

  return (
    <div className={styles.list}>
      <div className={styles.toolbar}>
        {onToggleSelectSession && onToggleSelectAll && (
          <label className={styles.selectAll}>
            <input
              type="checkbox"
              ref={selectAllRef}
              checked={isAllSelected}
              onChange={onToggleSelectAll}
              className={styles.checkbox}
            />
            {isAllSelected ? t('history.batch.deselectAll') : t('history.batch.selectAll')}
          </label>
        )}
        {onToggleSort && (
          <div className={styles.sort}>
            <Select
              aria-label={t('history.table.sortBy')}
              value={sortField}
              onChange={(e) => {
                if (e.target.value !== sortField) onToggleSort(e.target.value);
              }}
            >
              {SORT_FIELDS.map(({ field, labelKey }) => (
                <option key={field} value={field}>
                  {t(labelKey)}
                </option>
              ))}
            </Select>
            <IconButton
              size="sm"
              variant="secondary"
              label={t('history.table.reverseOrder')}
              onClick={() => sortField && onToggleSort(sortField)}
            >
              {sortOrder === 'asc' ? <ArrowUpNarrowWide size={16} /> : <ArrowDownWideNarrow size={16} />}
            </IconButton>
          </div>
        )}
      </div>

      {paging.groups.map((group) => {
        const collapsed = paging.isCollapsed(group.key);
        return (
          <React.Fragment key={group.key}>
            {grouped && (
              <SessionGroupHeading
                as="h2"
                group={group}
                collapsed={collapsed}
                onToggle={() => paging.toggleGroup(group.key)}
              />
            )}
            {!collapsed && (
              <ul className={styles.cards} aria-label={t('history.table.caption')}>
                {group.sessions.map((session) => {
                  const sessionTags = session.tags || [];
                  const countryIso3 = getTrackInfo(session.track_name)?.countryIso3 || null;
                  const selected = selectedSessionIds?.has(session.id) || false;
                  return (
                    <li
                      key={session.id}
                      className={styles.card}
                      data-kind={sessionKind(session.session_type)}
                      data-selected={selected || undefined}
                    >
                      <div className={styles.head}>
                        {onToggleSelectSession && (
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => onToggleSelectSession(session.id)}
                            aria-label={t('history.batch.selectSession', { id: session.id })}
                            className={styles.checkbox}
                          />
                        )}
                        <TrackFlag track={session.track_name} width={22} height={15} />
                        <TrackHeading className={styles.track}>
                          {session.track_name || t('common.unknownTrack')}
                        </TrackHeading>
                        {countryIso3 && <span className={styles.iso}>{countryIso3}</span>}
                      </div>

                      <div className={styles.meta}>
                        <span className={styles.date}>
                          <Clock size={13} aria-hidden="true" />
                          {formatDate(session.created_at)}
                        </span>
                        {session.packet_format !== usualFormat && (
                          <F1FormatBadge format={session.packet_format} size="xs" />
                        )}
                        <SessionTypeBadge sessionType={session.session_type || 'RACE'} size="xs" showIcon={false} />
                        <WeatherBadgeWithForecast session={session} compact />
                      </div>

                      <div className={styles.result}>
                        <span className={styles.resultLabel}>{t('history.player.yourResult')}</span>
                        <YourResult summary={session.summary} sessionType={session.session_type} />
                      </div>

                      <div className={styles.tags}>
                        {sessionTags.map((tag) => (
                          <TagBadge key={tag.id} tag={tag} size="xs" />
                        ))}
                        <AddTagButton
                          compact
                          hasTags={sessionTags.length > 0}
                          onClick={() => onOpenTagManager(session)}
                        />
                      </div>

                      <div className={styles.actions}>
                        <SessionActionsMenu
                          session={session}
                          onExport={onExportSession}
                          onManageTags={onOpenTagManager}
                          onDelete={onRequestDelete}
                        />
                        <Button
                          size="sm"
                          variant="primary"
                          className={styles.explore}
                          onClick={() => onSelectSession(session)}
                          aria-label={`${t('common.explore')}: ${session.track_name}`}
                        >
                          {t('common.explore')}
                          <ChevronRight size={15} aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </React.Fragment>
        );
      })}
      <SessionListMore paging={paging} />
    </div>
  );
};
