import React from 'react';
import { X, Tag as TagIcon } from 'lucide-react';
import type { Tag } from '../../types/session';
import { alpha, cssVar } from '../../styles/theme';

interface TagBadgeProps {
  tag: Pick<Tag, 'name' | 'color'>;
  size?: 'xs' | 'sm' | 'md';
  onRemove?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  selected?: boolean;
  showIcon?: boolean;
  className?: string;
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  tag,
  size = 'sm',
  onRemove,
  onClick,
  selected = false,
  showIcon = false,
  className = '',
}) => {
  const color = tag.color || cssVar('--accent-secondary');
  const label = (
    <>
      {showIcon && <TagIcon size={11} style={{ opacity: 0.8 }} />}
      <span className="f1-tag-dot" style={{ backgroundColor: color }} />
      <span>{tag.name}</span>
    </>
  );

  return (
    <span
      style={{
        backgroundColor: alpha(color, selected ? 0.21 : 0.09),
        borderColor: selected ? color : alpha(color, 0.33),
        color: color,
      }}
      className={`f1-tag-badge size-${size} ${onClick ? 'is-clickable' : ''} ${className}`}
      title={tag.name}
    >
      {onClick ? (
        <button type="button" className="button-reset f1-tag-badge-toggle" aria-pressed={selected} onClick={onClick}>
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
          className="f1-tag-remove-btn"
          title={`Remove tag ${tag.name}`}
          aria-label={`Remove tag ${tag.name}`}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
};
