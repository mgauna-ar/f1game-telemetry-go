import { create } from 'zustand';
import { desktopClient } from '../utils/desktopClient';
import type { DesktopState, DesktopUpdate } from '../types/desktop';

/**
 * Where reading the app's state is: not asked yet, asking, read, or refused. The server answers only
 * the PC the app runs on, so a phone or tablet ends up 'unavailable'.
 */
export type DesktopStateStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface DesktopStore {
  /** How the app runs on the PC this page is on (GET /api/desktop), or null unless it was read. */
  state: DesktopState | null;
  status: DesktopStateStatus;
  /** Reads the state, the first time it's called. */
  load: () => Promise<void>;
  /** Reads it again, as Settings → App opens: the tray's Start with Windows may have changed it. */
  refresh: () => Promise<void>;
  /** Changes a startup option and keeps the state the server answers with; throws when it fails. */
  update: (change: DesktopUpdate) => Promise<void>;
}

/** The app on the PC this page is on, for the dashboard (the /desktop window reads its own). */
export const useDesktopStore = create<DesktopStore>((set, get) => ({
  state: null,
  status: 'idle',

  load: async () => {
    if (get().status !== 'idle') return;
    await get().refresh();
  },

  refresh: async () => {
    if (get().state === null) set({ status: 'loading' });
    try {
      set({ state: await desktopClient.getState(), status: 'ready' });
    } catch {
      // Refused on another device; on the PC a failed read keeps what was read before
      if (get().state === null) set({ status: 'unavailable' });
    }
  },

  update: async (change) => {
    set({ state: await desktopClient.update(change), status: 'ready' });
  },
}));
