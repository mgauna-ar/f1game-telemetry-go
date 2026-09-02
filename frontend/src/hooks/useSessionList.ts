import { useState, useCallback, useEffect } from 'react';
import type { Session } from '../types/session';
import { api } from '../utils/apiClient';
import { useSessionListStore } from '../store/useSessionListStore';

export interface UseSessionListReturn {
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  loadingSessions: boolean;
  error: string | null;
  sessionToDelete: Session | null;
  setSessionToDelete: React.Dispatch<React.SetStateAction<Session | null>>;
  deletingSessionId: number | null;
  fetchSessions: () => Promise<void>;
  confirmDeleteSession: (
    onDeleted?: (deletedId: number) => void,
    onError?: (err: unknown) => void
  ) => Promise<void>;
}

export function useSessionList(): UseSessionListReturn {
  const sessions = useSessionListStore((s) => s.sessions);
  const setSessions = useSessionListStore((s) => s.setSessions) as unknown as React.Dispatch<React.SetStateAction<Session[]>>;
  const loadingSessions = useSessionListStore((s) => s.loading);
  const error = useSessionListStore((s) => s.error);
  const storeFetchSessions = useSessionListStore((s) => s.fetchSessions);
  const invalidate = useSessionListStore((s) => s.invalidate);

  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);

  const fetchSessions = useCallback(async () => {
    await storeFetchSessions();
  }, [storeFetchSessions]);

  const confirmDeleteSession = useCallback(
    async (
      onDeleted?: (deletedId: number) => void,
      onError?: (err: unknown) => void
    ) => {
      if (!sessionToDelete) return;
      const targetId = sessionToDelete.id;
      setDeletingSessionId(targetId);
      try {
        await api.del(`/api/sessions/${targetId}`);

        useSessionListStore.getState().setSessions((prev) => prev.filter((s) => s.id !== targetId));
        invalidate();
        if (onDeleted) {
          onDeleted(targetId);
        }
        setSessionToDelete(null);
      } catch (err: unknown) {
        if (onError) {
          onError(err);
        }
      } finally {
        setDeletingSessionId(null);
      }
    },
    [sessionToDelete, invalidate]
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    setSessions,
    loadingSessions,
    error,
    sessionToDelete,
    setSessionToDelete,
    deletingSessionId,
    fetchSessions,
    confirmDeleteSession,
  };
}
