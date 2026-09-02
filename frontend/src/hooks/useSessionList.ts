import { useState, useCallback, useEffect } from 'react';
import type { Session } from '../types/session';
import { api } from '../utils/apiClient';

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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      const data = await api.get<Session[]>('/api/sessions');
      setSessions(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading sessions';
      setError(msg);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

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

        setSessions((prev) => prev.filter((s) => s.id !== targetId));
        if (onDeleted) {
          onDeleted(targetId);
        }
        setSessionToDelete(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete session';
        setError(msg);
        if (onError) {
          onError(err);
        }
      } finally {
        setDeletingSessionId(null);
      }
    },
    [sessionToDelete]
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
