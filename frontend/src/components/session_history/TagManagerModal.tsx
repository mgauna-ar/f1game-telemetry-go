import React, { useState, useEffect } from 'react';
import { Tag as TagIcon, X, Search, Plus, Check, Trash2 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { Session, Tag } from '../../types/session';

export const MOTORSPORT_COLORS = [
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !session) return null;

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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container glass-panel tag-manager-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <TagIcon size={22} color="var(--accent-secondary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                {t('history.tags.manageTags')}
              </h3>
              <p className="mono" style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                #{session.id} • {session.track_name} ({session.session_type})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="tag-manager-search">
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="tag-manager-search-input"
            placeholder={t('history.tags.searchTags')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tags List */}
        <div className="tag-manager-list custom-scrollbar">
          {filteredTags.length > 0 ? (
            filteredTags.map((tag) => {
              const isAssigned = assignedTagIds.has(tag.id);
              const color = tag.color || '#06b6d4';

              return (
                <div
                  key={tag.id}
                  onClick={() => handleToggleTag(tag)}
                  className={`tag-manager-item ${isAssigned ? 'is-assigned' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                      className="f1-tag-dot"
                      style={{ backgroundColor: color }}
                    />
                    <span className="mono" style={{ fontSize: '0.85rem', color: isAssigned ? '#fff' : 'var(--text-secondary)' }}>
                      {tag.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isAssigned ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00f2fe', fontSize: '0.72rem', fontWeight: 600 }}>
                        <Check size={14} />
                        <span>{t('history.tags.assigned')}</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        + Add
                      </span>
                    )}

                    {onDeleteGlobalTag && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTag(e, tag.id)}
                        title={t('history.tags.deleteTag')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '1.25rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {search ? 'No matching tags found' : t('history.tags.noTagsYet')}
            </div>
          )}
        </div>

        {/* Create New Tag Section */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            {t('history.tags.createTag')}
          </div>

          <form onSubmit={handleCreateAndAssign} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              className="tag-manager-search-input"
              style={{ paddingLeft: '0.75rem' }}
              placeholder={t('history.tags.tagNamePlaceholder')}
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />

            {/* Color Swatches */}
            <div className="color-swatch-row">
              {MOTORSPORT_COLORS.map((col) => (
                <button
                  type="button"
                  key={col.hex}
                  onClick={() => setSelectedColor(col.hex)}
                  style={{ backgroundColor: col.hex }}
                  className={`color-swatch-btn ${selectedColor === col.hex ? 'is-active' : ''}`}
                  title={col.name}
                />
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="submit"
                disabled={!newTagName.trim() || loading}
                className="nav-tab active"
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: !newTagName.trim() ? 'not-allowed' : 'pointer',
                  opacity: !newTagName.trim() ? 0.5 : 1,
                }}
              >
                <Plus size={14} />
                <span>{t('history.tags.createTag')}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <button
            type="button"
            className="nav-tab"
            onClick={onClose}
            style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
