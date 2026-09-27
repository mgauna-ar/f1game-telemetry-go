import React, { useId } from 'react';
import { Tag as TagIcon } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { cssVar, styleVars } from '../../styles/theme';
import type { Tag } from '../../types/session';
import { TagDot } from './TagBadge';
import styles from './TagFilterBar.module.css';

interface TagFilterBarProps {
  availableTags: Tag[];
  selectedTagId: number | null;
  onSelectTag: (tagId: number | null) => void;
  sessionCountByTag: Record<number, number>;
  totalSessionsCount: number;
}

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  availableTags = [],
  selectedTagId,
  onSelectTag,
  sessionCountByTag,
  totalSessionsCount,
}) => {
  const { t } = useI18n();
  const labelId = useId();

  if (availableTags.length === 0) {
    return null;
  }

  return (
    <div className={styles.bar} role="group" aria-labelledby={labelId}>
      <div id={labelId} className={styles.label}>
        <TagIcon size={13} color={cssVar('--accent-secondary')} aria-hidden="true" />
        <span>{t('history.tags.title')}:</span>
      </div>

      <button
        type="button"
        aria-pressed={selectedTagId === null}
        onClick={() => onSelectTag(null)}
        className={styles.pill}
      >
        <span>{t('history.tags.allTags')}</span>
        <span className={styles.count}>{totalSessionsCount}</span>
      </button>

      {availableTags.map((tag) => {
        const isSelected = selectedTagId === tag.id;
        return (
          <button
            type="button"
            key={tag.id}
            aria-pressed={isSelected}
            onClick={() => onSelectTag(isSelected ? null : tag.id)}
            className={styles.pill}
            style={styleVars({ '--pill-color': tag.color || cssVar('--weather-rain') })}
          >
            <TagDot color={tag.color} />
            <span>{tag.name}</span>
            <span className={styles.count}>{sessionCountByTag[tag.id] || 0}</span>
          </button>
        );
      })}
    </div>
  );
};
