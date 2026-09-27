import React from 'react';
import { Plus, X, Tag as TagIcon } from 'lucide-react';
import type { Tag } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { cssVar, styleVars } from '../../styles/theme';
import { cx } from '../ui/cx';
import styles from './TagBadge.module.css';

interface TagBadgeProps {
  tag: Pick<Tag, 'name' | 'color'>;
  size?: 'xs' | 'sm' | 'md';
  onRemove?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  selected?: boolean;
  showIcon?: boolean;
  className?: string;
}

const tagColor = (color?: string) => color || cssVar('--accent-secondary');

/** A tag's colour as a small dot, for lists and filters. */
export const TagDot: React.FC<{ color?: string }> = ({ color }) => (
  <span className={styles.dot} style={styleVars({ '--tag-color': tagColor(color) })} aria-hidden="true" />
);

export const TagBadge: React.FC<TagBadgeProps> = ({
  tag,
  size = 'sm',
  onRemove,
  onClick,
  selected = false,
  showIcon = false,
  className,
}) => {
  const { t } = useI18n();
  const label = (
    <>
      {showIcon && <TagIcon size={11} className={styles.icon} aria-hidden="true" />}
      <span className={styles.dot} aria-hidden="true" />
      <span>{tag.name}</span>
    </>
  );

  return (
    <span
      style={styleVars({ '--tag-color': tagColor(tag.color) })}
      className={cx(
        styles.badge,
        size !== 'sm' && styles[size],
        selected && styles.selected,
        onClick && styles.clickable,
        className
      )}
      title={tag.name}
    >
      {onClick ? (
        <button type="button" className={cx('button-reset', styles.toggle)} aria-pressed={selected} onClick={onClick}>
          {label}
        </button>
      ) : (
        label
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          className={styles.remove}
          aria-label={t('history.tags.removeTag', { name: tag.name })}
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}
    </span>
  );
};

/**
 * Opens a session's tag manager. `compact` shows only a round "+" (in the session table, beside
 * existing tags); otherwise it reads "+ Tag" or "+ Manage Tags".
 */
export const AddTagButton: React.FC<{
  hasTags: boolean;
  compact?: boolean;
  onClick: (e: React.MouseEvent) => void;
}> = ({ hasTags, compact = false, onClick }) => {
  const { t } = useI18n();
  const label = hasTags ? t('history.tags.manageTags') : t('history.tags.addTag');
  const iconOnly = compact && hasTags;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(styles.add, iconOnly && styles.iconOnly)}
      title={t('history.tags.manageTags')}
      aria-label={iconOnly ? label : undefined}
    >
      <Plus size={iconOnly ? 12 : 11} aria-hidden="true" />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
};
