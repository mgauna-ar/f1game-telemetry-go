import React from 'react';
import { Tag as TagIcon } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { Tag } from '../../types/session';

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

  if (availableTags.length === 0) {
    return null;
  }

  return (
    <div className="f1-tag-filter-bar">
      <div className="f1-tag-filter-label">
        <TagIcon size={13} color="var(--accent-secondary)" />
        <span>{t('history.tags.title')}:</span>
      </div>

      {/* All Tags Pill */}
      <button
        type="button"
        onClick={() => onSelectTag(null)}
        className={`f1-tag-filter-pill ${selectedTagId === null ? 'active' : ''}`}
      >
        <span>{t('history.tags.allTags')}</span>
        <span
          className="f1-tag-count-badge"
          style={{
            backgroundColor: selectedTagId === null ? 'rgba(0, 242, 254, 0.25)' : 'rgba(255, 255, 255, 0.1)',
            color: selectedTagId === null ? '#00f2fe' : 'var(--text-secondary)',
          }}
        >
          {totalSessionsCount}
        </span>
      </button>

      {/* Dynamic Tag Pills */}
      {availableTags.map((tag) => {
        const isSelected = selectedTagId === tag.id;
        const count = sessionCountByTag[tag.id] || 0;
        const color = tag.color || '#06b6d4';

        return (
          <button
            type="button"
            key={tag.id}
            onClick={() => onSelectTag(isSelected ? null : tag.id)}
            style={{
              backgroundColor: isSelected ? `${color}25` : undefined,
              borderColor: isSelected ? color : undefined,
              color: isSelected ? '#fff' : undefined,
              boxShadow: isSelected ? `0 0 12px ${color}40` : undefined,
            }}
            className={`f1-tag-filter-pill ${isSelected ? 'active' : ''}`}
          >
            <span
              className="f1-tag-dot"
              style={{ backgroundColor: color }}
            />
            <span>{tag.name}</span>
            <span
              className="f1-tag-count-badge"
              style={{
                backgroundColor: isSelected ? `${color}40` : `${color}18`,
                color: color,
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
