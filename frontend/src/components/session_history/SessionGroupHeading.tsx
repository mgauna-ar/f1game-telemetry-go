import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionGroupName } from '../../hooks/useSessionGroupName';
import type { SessionGroup } from '../../utils/sessionListView';
import { TrackFlag } from '../TrackFlag';
import { TagBadge } from './TagBadge';
import styles from './SessionGroupHeading.module.css';

interface SessionGroupHeadingProps {
  group: SessionGroup;
  collapsed: boolean;
  onToggle: () => void;
  /** The heading level in the card list; the table uses a row-group header instead. */
  as?: 'h2' | 'div';
}

/** A group's heading: a button that folds the group, with its name and how many sessions it has. */
export const SessionGroupHeading: React.FC<SessionGroupHeadingProps> = ({ group, collapsed, onToggle, as }) => {
  const { t } = useI18n();
  const groupName = useSessionGroupName();
  const name = groupName(group);
  const count = group.sessions.length;
  const Wrapper = as ?? React.Fragment;

  return (
    <Wrapper {...(as ? { className: styles.heading } : {})}>
      <button
        type="button"
        className={`button-reset ${styles.toggle}`}
        aria-expanded={!collapsed}
        onClick={onToggle}
        title={t(collapsed ? 'history.list.expandGroup' : 'history.list.collapseGroup', { name })}
      >
        {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        {group.kind === 'track' && group.track && <TrackFlag track={group.track} width={18} height={12} />}
        {group.kind === 'tag' && group.tag ? (
          <TagBadge tag={group.tag} size="xs" />
        ) : (
          <span className={styles.name}>{name}</span>
        )}
        <span className={styles.count}>
          {count === 1 ? t('history.list.groupCountOne') : t('history.list.groupCount', { count })}
        </span>
      </button>
    </Wrapper>
  );
};
