import { create } from 'zustand';
import type { Session, SessionListItem, SetPlayerCarRequest } from '../types/session';
import { api } from '../utils/apiClient';

export const SESSION_LIST_TTL_MS = 30_000;

let forcedWhileLoading: Promise<void> | null = null;

export interface SessionListState {
  /** The recorded sessions, each with a summary of its result. */
  sessions: SessionListItem[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  setSessions: (sessions: SessionListItem[] | ((prev: SessionListItem[]) => SessionListItem[])) => void;
  fetchSessions: (options?: { force?: boolean }) => Promise<void>;
  invalidate: () => void;
  reset: () => void;
  /** Goes up each time a session's player car changes, so views built from it (Progress) reload. */
  playerRevision: number;
  /**
   * Saves your car in a session (`null`: "I wasn't driving"), then refreshes the list, whose
   * summaries follow it. Resolves with the updated session; rejects when the save fails.
   */
  setPlayerCar: (sessionId: number, carIndex: number | null) => Promise<Session>;
  /** Refreshes the list after player cars changed on the server and bumps `playerRevision`. */
  playerCarsChanged: () => Promise<void>;
}

export const useSessionListStore = create<SessionListState>((set, get) => ({
  sessions: [],
  loading: false,
  error: null,
  lastFetchedAt: null,
  playerRevision: 0,

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

    // Avoid concurrent duplicate requests; a forced fetch during one runs again after it, since the
    // data may have changed after that request was sent.
    if (loading) {
      if (options?.force) {
        forcedWhileLoading ??= new Promise<void>((resolve) => {
          const unsubscribe = useSessionListStore.subscribe((state) => {
            if (state.loading) return;
            unsubscribe();
            forcedWhileLoading = null;
            void get().fetchSessions({ force: true }).then(resolve);
          });
        });
        return forcedWhileLoading;
      }
      return;
    }

    set({ loading: true, error: null });
    try {
      const data = await api.get<SessionListItem[]>('/api/sessions');
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

  setPlayerCar: async (sessionId, carIndex) => {
    const body: SetPlayerCarRequest = { car_index: carIndex };
    const session = await api.put<Session>(`/api/sessions/${sessionId}/player`, body);
    set((state) => ({
      sessions: state.sessions.map((item) =>
        item.id === sessionId
          ? { ...item, player_car_index: session.player_car_index, player_car_source: session.player_car_source }
          : item
      ),
    }));
    await get().playerCarsChanged();
    return session;
  },

  playerCarsChanged: async () => {
    set((state) => ({ playerRevision: state.playerRevision + 1 }));
    await get().fetchSessions({ force: true });
  },

  reset: () => {
    set({
      sessions: [],
      loading: false,
      error: null,
      lastFetchedAt: null,
      playerRevision: 0,
    });
  },
}));
