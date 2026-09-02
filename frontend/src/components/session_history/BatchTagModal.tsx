import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TagBadge } from './TagBadge';
import { useI18n } from '../../context/I18nContext';
import type { Tag } from '../../types/session';

interface BatchTagModalProps {
  isOpen: boolean;
  selectedCount: number;
  availableTags: Tag[];
  onClose: () => void;
  onApplyTag: (tagId: number) => Promise<void>;
}

export const BatchTagModal: React.FC<BatchTagModalProps> = ({
  isOpen,
  selectedCount,
  availableTags,
  onClose,
  onApplyTag,
}) => {
  const { t } = useI18n();
  const [batchSelectedTagId, setBatchSelectedTagId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setBatchSelectedTagId(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-container glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px', padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-secondary)' }}>
            <TagBadge tag={{ id: 0, name: 'TAGS', color: '#00f2fe' }} size="xs" />
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              {t('history.batch.tagModalTitle', { count: selectedCount })}
            </h3>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            {t('history.batch.tagSelectPlaceholder')}
          </p>
          {availableTags.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {t('history.tags.noTagsAvailable')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availableTags.map((tag) => {
                const isSelected = batchSelectedTagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setBatchSelectedTagId(isSelected ? null : tag.id)}
                    style={{
                      background: isSelected ? tag.color : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? '#000' : 'var(--text-primary)',
                      border: `1px solid ${tag.color}`,
                      borderRadius: '20px',
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? '#000' : tag.color,
                      }}
                    />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            className="nav-tab"
            onClick={handleClose}
            style={{ padding: '0.5rem 1.2rem' }}
          >
            {t('common.cancel')}
          </button>
          <button
            className="nav-tab active"
            disabled={!batchSelectedTagId}
            onClick={async () => {
              if (batchSelectedTagId) {
                await onApplyTag(batchSelectedTagId);
                handleClose();
              }
            }}
            style={{
              padding: '0.5rem 1.2rem',
              opacity: batchSelectedTagId ? 1 : 0.5,
              cursor: batchSelectedTagId ? 'pointer' : 'not-allowed',
            }}
          >
            {t('history.batch.applyTag')}
          </button>
        </div>
      </div>
    </div>
  );
};
