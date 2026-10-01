import React, { useId } from 'react';
import { Tag as TagIcon } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { cssVar } from '../../styles/theme';
import type { Tag } from '../../types/session';
import { Chip } from '../ui/Chip';
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
        <TagIcon size={12} aria-hidden="true" />
        <span>{t('history.tags.title')}:</span>
      </div>

      <Chip pressed={selectedTagId === null} onClick={() => onSelectTag(null)} count={totalSessionsCount}>
        {t('history.tags.allTags')}
      </Chip>

      {availableTags.map((tag) => {
        const isSelected = selectedTagId === tag.id;
        return (
          <Chip
            key={tag.id}
            pressed={isSelected}
            onClick={() => onSelectTag(isSelected ? null : tag.id)}
            color={tag.color || cssVar('--weather-rain')}
            count={sessionCountByTag[tag.id] || 0}
          >
            {tag.name}
          </Chip>
        );
      })}
    </div>
  );
};
