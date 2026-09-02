import React from 'react';
import { Download, Tag, Trash2, X, RefreshCw, Layers } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContext';

export interface SessionBatchDockProps {
  selectedCount?: number;
  isExporting?: boolean;
  onExportZip?: () => void;
  onOpenBatchTagModal?: () => void;
  onRequestBatchDelete?: () => void;
  onClearSelection?: () => void;
}

export const SessionBatchDock: React.FC<SessionBatchDockProps> = (props) => {
  const { t } = useI18n();
  const historyData = useSessionHistoryData();
  const historyActions = useSessionHistoryActions();

  const selectedCount = props.selectedCount ?? historyData.selectedSessionIds.size;
  const isExporting = props.isExporting ?? historyData.isExportingBatch;
  const onExportZip = props.onExportZip ?? historyActions.handleBatchExport;
  const onOpenBatchTagModal = props.onOpenBatchTagModal ?? (() => historyActions.setShowBatchTagModal(true));
  const onRequestBatchDelete = props.onRequestBatchDelete ?? (() => historyActions.setShowBatchDeleteModal(true));
  const onClearSelection = props.onClearSelection ?? historyActions.handleClearSelection;

  if (selectedCount <= 0) return null;

  return (
    <div
      className="session-batch-dock"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'min(94vw, 760px)',
        backgroundColor: 'rgba(12, 16, 26, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(0, 242, 254, 0.4)',
        borderRadius: '14px',
        padding: '0.85rem 1.25rem',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.75), 0 0 24px rgba(0, 242, 254, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Left indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 242, 254, 0.15)',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            color: 'var(--accent-secondary)',
          }}
        >
          <Layers size={18} />
        </div>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {t('history.batch.selectedCount', { count: selectedCount })}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Export ZIP Button */}
        <button
          type="button"
          className="nav-tab active"
          onClick={onExportZip}
          disabled={isExporting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            padding: '0.5rem 0.9rem',
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(79, 172, 254, 0.2))',
            borderColor: 'rgba(0, 242, 254, 0.6)',
            color: 'var(--accent-secondary)',
            cursor: isExporting ? 'not-allowed' : 'pointer',
          }}
          title={t('history.batch.exportZip', { count: selectedCount })}
        >
          {isExporting ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>{t('history.batch.exportingZip')}</span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>{t('history.batch.exportZip', { count: selectedCount })}</span>
            </>
          )}
        </button>

        {/* Assign Tag Button */}
        <button
          type="button"
          className="nav-tab"
          onClick={onOpenBatchTagModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            padding: '0.5rem 0.85rem',
            color: 'var(--text-primary)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }}
          title={t('history.batch.tagSelected')}
        >
          <Tag size={14} color="#00f2fe" />
          <span>{t('history.batch.tagSelected')}</span>
        </button>

        {/* Delete Selected Button */}
        <button
          type="button"
          className="nav-tab"
          onClick={onRequestBatchDelete}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            padding: '0.5rem 0.85rem',
            color: '#ff4d4f',
            borderColor: 'rgba(255, 77, 79, 0.4)',
            backgroundColor: 'rgba(255, 77, 79, 0.08)',
          }}
          title={t('history.batch.deleteSelected', { count: selectedCount })}
        >
          <Trash2 size={14} />
          <span>{t('history.batch.deleteSelected', { count: selectedCount })}</span>
        </button>

        {/* Clear Selection Button */}
        <button
          type="button"
          onClick={onClearSelection}
          className="nav-tab"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem 0.6rem',
            color: 'var(--text-muted)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
          }}
          title={t('history.batch.clearSelection')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
