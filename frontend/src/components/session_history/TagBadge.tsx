import React from 'react';
import { X, Tag as TagIcon } from 'lucide-react';
import type { Tag } from '../../types/session';

interface TagBadgeProps {
  tag: Tag;
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
  const color = tag.color || '#06b6d4';

  return (
    <span
      onClick={onClick}
      style={{
        backgroundColor: selected ? `${color}35` : `${color}18`,
        borderColor: selected ? color : `${color}55`,
        color: color,
      }}
      className={`f1-tag-badge size-${size} ${onClick ? 'is-clickable' : ''} ${className}`}
      title={tag.name}
    >
      {showIcon && <TagIcon size={11} style={{ opacity: 0.8 }} />}
      <span className="f1-tag-dot" style={{ backgroundColor: color }} />
      <span>{tag.name}</span>
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
