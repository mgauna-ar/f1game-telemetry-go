import { create } from 'zustand';
import type { Session } from '../types/session';
import { api } from '../utils/apiClient';

export const SESSION_LIST_TTL_MS = 30_000;

export interface SessionListState {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  setSessions: (sessions: Session[] | ((prev: Session[]) => Session[])) => void;
  fetchSessions: (options?: { force?: boolean }) => Promise<void>;
  invalidate: () => void;
  reset: () => void;
}

export const useSessionListStore = create<SessionListState>((set, get) => ({
  sessions: [],
  loading: false,
  error: null,
  lastFetchedAt: null,

  setSessions: (updater) => {
    const next = typeof updater === 'function' ? updater(get().sessions) : updater;
    set({ sessions: next });
  },

  fetchSessions: async (options) => {
    const { lastFetchedAt, loading, sessions } = get();
    const now = Date.now();

    // Skip fetch if cache is still fresh within TTL and not forced
    if (
      !options?.force &&
      lastFetchedAt !== null &&
      now - lastFetchedAt < SESSION_LIST_TTL_MS &&
      sessions.length > 0
    ) {
      return;
    }

    // Avoid concurrent duplicate requests
    if (loading) return;

    set({ loading: true, error: null });
    try {
      const data = await api.get<Session[]>('/api/sessions');
      set({
        sessions: data || [],
        lastFetchedAt: Date.now(),
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading sessions';
      set({ error: msg });
    } finally {
      set({ loading: false });
    }
  },

  invalidate: () => {
    set({ lastFetchedAt: null });
  },

  reset: () => {
    set({
      sessions: [],
      loading: false,
      error: null,
      lastFetchedAt: null,
    });
  },
}));
