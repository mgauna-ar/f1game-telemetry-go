import { create } from 'zustand';
import { api } from '../utils/apiClient';
import type { SystemVersion, UpdateCheckResponse } from '../types/system';

export interface AppUpdateStore {
  /** The build the server runs (GET /api/system/version), or null until it answers. */
  version: SystemVersion | null;
  /**
   * The newest release for this build (GET /api/system/check-updates), or null until it answers. The
   * server answers "no update" when GitHub can't be reached.
   */
  release: UpdateCheckResponse | null;
  /** Whether they were asked for already: each update check asks GitHub, so it's done once. */
  requested: boolean;
  /** Reads both, the first time it's called. */
  load: () => Promise<void>;
}

/** The app's version and the newest release, for the version badge, the release notes and Settings → App. */
export const useAppUpdateStore = create<AppUpdateStore>((set, get) => ({
  version: null,
  release: null,
  requested: false,

  load: async () => {
    if (get().requested) return;
    set({ requested: true });
    const [release, version] = await Promise.allSettled([
      api.get<UpdateCheckResponse>('/api/system/check-updates'),
      api.get<SystemVersion>('/api/system/version'),
    ]);
    // Either may fail while offline or as the server restarts: the badge then shows what it has
    if (release.status === 'fulfilled') set({ release: release.value });
    if (version.status === 'fulfilled') set({ version: version.value });
  },
}));
