import { create } from 'zustand';
import { desktopClient } from '../utils/desktopClient';
import type { DesktopState } from '../types/desktop';

export interface DesktopStore {
  /**
   * How the app runs on the PC this page is on (GET /api/desktop), or null until it's read. It stays
   * null on a phone or tablet: the server answers only the PC the app runs on.
   */
  state: DesktopState | null;
  /** Whether it was asked for already: it's read once. */
  requested: boolean;
  /** Reads the state, the first time it's called. */
  load: () => Promise<void>;
}

/** The app on the PC this page is on, for the dashboard (the /desktop window reads its own). */
export const useDesktopStore = create<DesktopStore>((set, get) => ({
  state: null,
  requested: false,

  load: async () => {
    if (get().requested) return;
    set({ requested: true });
    // Refused on another device: then this page isn't on the PC and the state stays null
    const state = await desktopClient.getState().catch(() => null);
    if (state) set({ state });
  },
}));
