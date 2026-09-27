import React from 'react';
import { Download, Tag, Trash2, X, Layers } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContextDefinitions';
import { Button, IconButton } from '../ui/Button';
import styles from './SessionDock.module.css';

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
    <section className={styles.dock} data-session-dock aria-labelledby="batch-dock-title">
      <div className={styles.intro}>
        <span className={styles.introIcon} aria-hidden="true">
          <Layers size={18} />
        </span>
        <h2 id="batch-dock-title" className={styles.count} role="status">
          {t('history.batch.selectedCount', { count: selectedCount })}
        </h2>
      </div>

      <div className={styles.actions}>
        <Button
          className={styles.export}
          onClick={onExportZip}
          loading={isExporting}
          icon={<Download size={14} aria-hidden="true" />}
        >
          {isExporting ? t('history.batch.exportingZip') : t('history.batch.exportZip', { count: selectedCount })}
        </Button>

        <Button onClick={onOpenBatchTagModal} icon={<Tag size={14} className={styles.tagIcon} aria-hidden="true" />}>
          {t('history.batch.tagSelected')}
        </Button>

        <Button className={styles.delete} onClick={onRequestBatchDelete} icon={<Trash2 size={14} aria-hidden="true" />}>
          {t('history.batch.deleteSelected', { count: selectedCount })}
        </Button>

        <IconButton
          variant="secondary"
          className={styles.clear}
          label={t('history.batch.clearSelection')}
          onClick={onClearSelection}
        >
          <X size={14} />
        </IconButton>
      </div>
    </section>
  );
};
