import { useState, useEffect, useCallback } from 'react';
import type { Session } from '../types/session';
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

export interface ToastMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface UseBatchOperationsReturn {
  selectedSessionIds: Set<number>;
  setSelectedSessionIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  isExportingBatch: boolean;
  importingSession: boolean;
  toastMessage: ToastMessage | null;
  setToastMessage: React.Dispatch<React.SetStateAction<ToastMessage | null>>;
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
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (toastMessage) {
      useToastStore.getState().showToast({
        type: toastMessage.type,
        message: toastMessage.text,
      });
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

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
        const msg = err instanceof Error ? err.message : String(err);
        setToastMessage({ type: 'error', text: `${t('history.exportError') || 'Export error'}: ${msg}` });
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
      setToastMessage({ type: 'success', text: t('history.batch.exportZip', { count: ids.length }) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage({ type: 'error', text: `${t('history.exportError') || 'Export error'}: ${msg}` });
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
        const data = await api.postFormData<{ total?: number; imported?: number; skipped?: number; failed?: number }>(
          '/api/sessions/import',
          formData
        );

        if (data && typeof data.total === 'number') {
          const summaryText = t('history.batch.importSummary', {
            imported: data.imported ?? 0,
            skipped: data.skipped ?? 0,
            failed: data.failed ?? 0,
          });
          setToastMessage({ type: (data.imported ?? 0) > 0 ? 'success' : 'info', text: summaryText });
        } else {
          setToastMessage({ type: 'success', text: t('history.importSuccess') });
        }

        useSessionListStore.getState().invalidate();
        await fetchSessions();
        if (fetchTags) {
          await fetchTags();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setToastMessage({ type: 'error', text: `${t('history.importError')}: ${msg}` });
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
      setToastMessage({ type: 'success', text: t('history.batch.deleteSelected', { count: ids.length }) });
      useSessionListStore.getState().invalidate();
      await fetchSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage({ type: 'error', text: `Delete error: ${msg}` });
    }
  }, [selectedSessionIds, setSessions, fetchSessions, t]);

  const handleExecuteBatchTag = useCallback(
    async (tagId: number) => {
      const ids = Array.from(selectedSessionIds);
      if (ids.length === 0 || !tagId) return;

      try {
        await api.post('/api/sessions/batch-tags', { session_ids: ids, tag_id: tagId });
        setToastMessage({ type: 'success', text: t('history.batch.tagSelected') });
        useSessionListStore.getState().invalidate();
        await fetchSessions();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setToastMessage({ type: 'error', text: `Tag assignment error: ${msg}` });
      }
    },
    [selectedSessionIds, fetchSessions, t]
  );

  return {
    selectedSessionIds,
    setSelectedSessionIds,
    isExportingBatch,
    importingSession,
    toastMessage,
    setToastMessage,
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
