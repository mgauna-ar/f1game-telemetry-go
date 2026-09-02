import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface BatchDeleteModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const BatchDeleteModal: React.FC<BatchDeleteModalProps> = ({
  isOpen,
  selectedCount,
  onClose,
  onConfirm,
}) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px', padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ff4d4f' }}>
            <AlertTriangle size={24} />
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              {t('history.batch.confirmDeleteTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
          {t('history.batch.confirmDeleteBody', { count: selectedCount })}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            className="nav-tab"
            onClick={onClose}
            style={{ padding: '0.5rem 1.2rem' }}
          >
            {t('common.cancel')}
          </button>
          <button
            className="nav-tab active"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            style={{
              padding: '0.5rem 1.2rem',
              background: 'linear-gradient(135deg, #ff4d4f, #d9363e)',
              borderColor: '#ff4d4f',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Trash2 size={14} /> {t('history.batch.deleteSelected', { count: selectedCount })}
          </button>
        </div>
      </div>
    </div>
  );
};
