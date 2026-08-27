import { useState, useCallback, useEffect } from 'react';
import type { Session } from '../types/session';

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
    onError?: (err: any) => void
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
      const res = await fetch('/api/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data: Session[] = await res.json();
      setSessions(data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading sessions');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const confirmDeleteSession = useCallback(
    async (
      onDeleted?: (deletedId: number) => void,
      onError?: (err: any) => void
    ) => {
      if (!sessionToDelete) return;
      const targetId = sessionToDelete.id;
      setDeletingSessionId(targetId);
      try {
        const res = await fetch(`/api/sessions/${targetId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete session');

        setSessions((prev) => prev.filter((s) => s.id !== targetId));
        if (onDeleted) {
          onDeleted(targetId);
        }
        setSessionToDelete(null);
      } catch (err: any) {
        console.error('Error deleting session:', err);
        setError(err.message || 'Failed to delete session');
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
