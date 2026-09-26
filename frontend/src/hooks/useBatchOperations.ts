import { useState, useCallback } from 'react';
import type { ImportBatchResponse, Session } from '../types/session';
import { useI18n } from '../context/I18nContext';
import { api } from '../utils/apiClient';
import { useSessionListStore } from '../store/useSessionListStore';
import { useToastStore } from '../store/useToastStore';

export interface UseBatchOperationsOptions {
  sessions: Session[];
  filteredSessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  fetchSessions: () => Promise<void>;
  fetchTags?: () => Promise<void>;
}

function showToast(type: 'success' | 'error' | 'info', message: string) {
  useToastStore.getState().showToast({ type, message });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface UseBatchOperationsReturn {
  selectedSessionIds: Set<number>;
  setSelectedSessionIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  isExportingBatch: boolean;
  importingSession: boolean;
  handleToggleSelectSession: (sessionId: number) => void;
  handleToggleSelectAll: () => void;
  handleClearSelection: () => void;
  handleExportSession: (sessionToExport: Session) => Promise<void>;
  handleBatchExport: () => Promise<void>;
  handleImportFiles: (files: FileList | File[]) => Promise<void>;
  handleExecuteBatchDelete: () => Promise<void>;
  handleExecuteBatchTag: (tagId: number) => Promise<void>;
}

export function useBatchOperations({
  sessions,
  filteredSessions,
  setSessions,
  fetchSessions,
  fetchTags,
}: UseBatchOperationsOptions): UseBatchOperationsReturn {
  const { t } = useI18n();
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<number>>(new Set());
  const [isExportingBatch, setIsExportingBatch] = useState<boolean>(false);
  const [importingSession, setImportingSession] = useState<boolean>(false);

  const handleToggleSelectSession = useCallback((sessionId: number) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    const allFilteredIds = filteredSessions.map((s) => s.id);
    const areAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedSessionIds.has(id));

    if (areAllSelected) {
      setSelectedSessionIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedSessionIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [filteredSessions, selectedSessionIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedSessionIds(new Set());
  }, []);

  const handleExportSession = useCallback(
    async (sessionToExport: Session) => {
      try {
        const blob = await api.getBlob(`/api/sessions/${sessionToExport.id}/export`);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const dateStr = sessionToExport.created_at ? new Date(sessionToExport.created_at).toISOString().split('T')[0] : 'date';
        const cleanTrack = (sessionToExport.track_name || 'track').replace(/[^a-zA-Z0-9]/g, '_');
        const cleanType = (sessionToExport.session_type || 'session').replace(/[^a-zA-Z0-9]/g, '_');
        a.download = `${cleanTrack}_${cleanType}_${dateStr}.f1session`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err: unknown) {
        showToast('error', t('history.exportError', { message: errorMessage(err) }));
      }
    },
    [t]
  );

  const handleBatchExport = useCallback(async () => {
    const ids = Array.from(selectedSessionIds);
    if (ids.length === 0) return;

    if (ids.length === 1) {
      const single = sessions.find((s) => s.id === ids[0]);
      if (single) {
        await handleExportSession(single);
        return;
      }
    }

    setIsExportingBatch(true);
    try {
      const blob = await api.postBlob('/api/sessions/export-batch', { session_ids: ids });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `f1_sessions_export_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('success', t('history.batch.exportZip', { count: ids.length }));
    } catch (err: unknown) {
      showToast('error', t('history.exportError', { message: errorMessage(err) }));
    } finally {
      setIsExportingBatch(false);
    }
  }, [selectedSessionIds, sessions, handleExportSession, t]);

  const handleImportFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!files || files.length === 0) return;
      setImportingSession(true);
      try {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
          formData.append('files', files[i]);
        }
        const data = await api.postFormData<ImportBatchResponse>('/api/sessions/import', formData);

        const summary = t('history.batch.importSummary', {
          imported: data.imported,
          skipped: data.skipped,
          failed: data.failed,
        });
        const firstFailure = data.details?.find((d) => d.status === 'failed' && d.reason);
        const text = firstFailure
          ? `${summary} ${t('history.batch.importFirstFailure', { file: firstFailure.filename ?? '', reason: firstFailure.reason ?? '' })}`
          : summary;
        showToast(data.imported > 0 ? 'success' : 'info', text);

        useSessionListStore.getState().invalidate();
        await fetchSessions();
        if (fetchTags) {
          await fetchTags();
        }
      } catch (err: unknown) {
        showToast('error', t('history.importError', { message: errorMessage(err) }));
      } finally {
        setImportingSession(false);
      }
    },
    [fetchSessions, fetchTags, t]
  );

  const handleExecuteBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedSessionIds);
    if (ids.length === 0) return;

    try {
      await api.post('/api/sessions/batch-delete', { session_ids: ids });

      setSessions((prev) => prev.filter((s) => !selectedSessionIds.has(s.id)));
      setSelectedSessionIds(new Set());
      showToast('success', t('history.batch.deleteSelected', { count: ids.length }));
      useSessionListStore.getState().invalidate();
      await fetchSessions();
    } catch (err: unknown) {
      showToast('error', t('history.deleteError', { message: errorMessage(err) }));
    }
  }, [selectedSessionIds, setSessions, fetchSessions, t]);

  const handleExecuteBatchTag = useCallback(
    async (tagId: number) => {
      const ids = Array.from(selectedSessionIds);
      if (ids.length === 0 || !tagId) return;

      try {
        await api.post('/api/sessions/batch-tags', { session_ids: ids, tag_id: tagId });
        showToast('success', t('history.batch.tagSelected'));
        useSessionListStore.getState().invalidate();
        await fetchSessions();
      } catch (err: unknown) {
        showToast('error', t('history.tagAssignError', { message: errorMessage(err) }));
      }
    },
    [selectedSessionIds, fetchSessions, t]
  );

  return {
    selectedSessionIds,
    setSelectedSessionIds,
    isExportingBatch,
    importingSession,
    handleToggleSelectSession,
    handleToggleSelectAll,
    handleClearSelection,
    handleExportSession,
    handleBatchExport,
    handleImportFiles,
    handleExecuteBatchDelete,
    handleExecuteBatchTag,
  };
}
