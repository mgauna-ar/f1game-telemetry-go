import React, { useState } from 'react';
import { Tag as TagIcon, Search, Plus, Check, Trash2 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { Session, Tag } from '../../types/session';
import { cssVar } from '../../styles/theme';
import { TrackFlag } from '../TrackFlag';
import { Button, IconButton } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../ui/Modal';

const MOTORSPORT_COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#eab308' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
];

interface TagManagerModalProps {
  session: Session | null;
  availableTags: Tag[];
  onAddTag: (sessionId: number, tagId?: number, newTag?: { name: string; color: string }) => Promise<void>;
  onRemoveTag: (sessionId: number, tagId: number) => Promise<void>;
  onDeleteGlobalTag?: (tagId: number) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  session,
  availableTags = [],
  onAddTag,
  onRemoveTag,
  onDeleteGlobalTag,
  isOpen,
  onClose,
}) => {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(MOTORSPORT_COLORS[4].hex); // Default Cyan
  const [loading, setLoading] = useState(false);

  if (!session) return null;

  const sessionTags = session.tags || [];
  const assignedTagIds = new Set(sessionTags.map((t) => t.id));

  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleToggleTag = async (tag: Tag) => {
    if (loading) return;
    setLoading(true);
    try {
      if (assignedTagIds.has(tag.id)) {
        await onRemoveTag(session.id, tag.id);
      } else {
        await onAddTag(session.id, tag.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      const existing = availableTags.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) {
        if (!assignedTagIds.has(existing.id)) {
          await onAddTag(session.id, existing.id);
        }
      } else {
        await onAddTag(session.id, undefined, { name: trimmed, color: selectedColor });
      }
      setNewTagName('');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (e: React.MouseEvent, tagId: number) => {
    e.stopPropagation();
    if (!onDeleteGlobalTag || loading) return;
    setLoading(true);
    try {
      await onDeleteGlobalTag(tagId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader
        tone="info"
        icon={<TagIcon size={20} />}
        title={t('history.tags.manageTags')}
        subtitle={
          <span className="tag-manager-session mono">
            <span>#{session.id} •</span>
            <TrackFlag track={session.track_name} width={14} height={10} />
            <span>
              {session.track_name} ({session.session_type})
            </span>
          </span>
        }
      />

      <ModalBody>
        <div className="tag-manager-search">
          <Search size={14} className="tag-manager-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="tag-manager-search-input"
            placeholder={t('history.tags.searchTags')}
            aria-label={t('history.tags.searchTags')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="tag-manager-list custom-scrollbar">
          {filteredTags.length > 0 ? (
            filteredTags.map((tag) => {
              const isAssigned = assignedTagIds.has(tag.id);
              const color = tag.color || cssVar('--accent-secondary');

              return (
                // Clicking anywhere on the row is a shortcut for its toggle button
                <div
                  key={tag.id}
                  role="presentation"
                  onClick={() => handleToggleTag(tag)}
                  className={`tag-manager-item ${isAssigned ? 'is-assigned' : ''}`}
                >
                  <button
                    type="button"
                    className="button-reset tag-manager-item-toggle"
                    aria-pressed={isAssigned}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTag(tag);
                    }}
                  >
                    <span className="f1-tag-dot" style={{ backgroundColor: color }} />
                    <span className="tag-manager-item-name mono">{tag.name}</span>
                  </button>

                  <div className="tag-manager-item-actions">
                    {isAssigned ? (
                      <span className="tag-manager-item-state is-assigned">
                        <Check size={14} aria-hidden="true" />
                        <span>{t('history.tags.assigned')}</span>
                      </span>
                    ) : (
                      <span className="tag-manager-item-state">+ {t('history.tags.add')}</span>
                    )}

                    {onDeleteGlobalTag && (
                      <IconButton
                        size="sm"
                        label={`${t('history.tags.deleteTag')}: ${tag.name}`}
                        onClick={(e) => handleDeleteTag(e, tag.id)}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              compact
              description={search ? t('history.tags.noMatchingTags') : t('history.tags.noTagsYet')}
            />
          )}
        </div>

        <form onSubmit={handleCreateAndAssign} className="tag-manager-create">
          <h3 className="tag-manager-create-title">{t('history.tags.createTag')}</h3>
          <input
            type="text"
            className="tag-manager-search-input tag-manager-name-input"
            placeholder={t('history.tags.tagNamePlaceholder')}
            aria-label={t('history.tags.tagNamePlaceholder')}
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
          />

          <div className="color-swatch-row" role="group" aria-label={t('history.tags.selectColor')}>
            {MOTORSPORT_COLORS.map((col) => (
              <button
                type="button"
                key={col.hex}
                onClick={() => setSelectedColor(col.hex)}
                style={{ backgroundColor: col.hex }}
                className={`color-swatch-btn ${selectedColor === col.hex ? 'is-active' : ''}`}
                title={col.name}
                aria-label={col.name}
                aria-pressed={selectedColor === col.hex}
              />
            ))}
          </div>

          <div className="tag-manager-create-actions">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newTagName.trim()}
              loading={loading}
              icon={<Plus size={14} />}
            >
              {t('history.tags.createTag')}
            </Button>
          </div>
        </form>
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>{t('common.done')}</Button>
      </ModalFooter>
    </Modal>
  );
};
