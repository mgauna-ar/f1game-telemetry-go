import { create } from 'zustand';
import { api } from '../utils/apiClient';
import { putSettings } from '../utils/settingsClient';
import { storage } from '../utils/storage';
import { reportSettingsSaveFailure } from './useSettingsSaveStore';
import type { ComparatorPreferences, ComparatorRivalMode } from '../types/comparatorPreferences';
import type { ComparatorSettings, ComparatorSettingsResponse } from '../types/settings';

export const DEFAULT_COMPARATOR_PREFERENCES: ComparatorPreferences = {
  rivalMode: 'fastest',
  rivalDriverName: '',
};

const RIVAL_MODES: readonly ComparatorRivalMode[] = ['fastest', 'teammate', 'driver'];

const isRivalMode = (value: unknown): value is ComparatorRivalMode =>
  typeof value === 'string' && (RIVAL_MODES as readonly string[]).includes(value);

/** Reads a server payload; anything this dashboard can't use falls back to the defaults. */
export function comparatorFromPayload(p: Partial<ComparatorSettings> | null | undefined): ComparatorPreferences {
  return {
    rivalMode: isRivalMode(p?.rival_mode) ? p.rival_mode : DEFAULT_COMPARATOR_PREFERENCES.rivalMode,
    rivalDriverName: typeof p?.rival_driver_name === 'string' ? p.rival_driver_name : '',
  };
}

export function comparatorToPayload(prefs: ComparatorPreferences): ComparatorSettings {
  return { rival_mode: prefs.rivalMode, rival_driver_name: prefs.rivalDriverName.trim() };
}

const LEGACY_RIVAL_MODE_KEY = 'f1_comparator_rival_mode';
const LEGACY_RIVAL_DRIVER_NAME_KEY = 'f1_comparator_rival_driver_name';

/** The preferences an older version kept in this browser, or null when it kept none. */
export function getLegacyComparatorPreferences(): ComparatorPreferences | null {
  // Older versions saved both as plain strings; an empty value is as good as none
  const mode = storage.get<string>(LEGACY_RIVAL_MODE_KEY, '');
  const name = storage.get<string>(LEGACY_RIVAL_DRIVER_NAME_KEY, '');
  if (!mode && !name) return null;
  return comparatorFromPayload({ rival_mode: isRivalMode(mode) ? mode : undefined, rival_driver_name: name });
}

export function clearLegacyComparatorPreferences(): void {
  storage.remove(LEGACY_RIVAL_MODE_KEY);
  storage.remove(LEGACY_RIVAL_DRIVER_NAME_KEY);
}

/** Waits this long after the last change before saving, so typing a name isn't one request per key. */
const SAVE_DEBOUNCE_MS = 500;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveInFlight = false;
let loading: Promise<void> | null = null;

/** True while a change is waiting to be saved or being saved. */
export function isComparatorSavePending(): boolean {
  return saveTimer !== null || saveInFlight;
}

export interface ComparatorPreferencesState {
  preferences: ComparatorPreferences;
  /** True once the saved preferences arrived, or the request failed and the defaults stay. */
  loaded: boolean;
  /** Loads the saved preferences once; later calls share that load. */
  ensureLoaded: () => Promise<void>;
  /** Reloads them, after another device saved. */
  reload: () => Promise<void>;
  /** Shows the new preferences at once and saves them shortly after. */
  update: (prefs: ComparatorPreferences) => void;
  /** Saves a pending change now. */
  flush: () => Promise<void>;
}

/**
 * The lap comparator's default rival, shared by every device through `/api/settings/comparator`.
 * The first load moves what an older version kept in this browser to the server.
 */
export const useComparatorPreferencesStore = create<ComparatorPreferencesState>((set, get) => {
  const load = async () => {
    const res = await api.get<ComparatorSettingsResponse>('/api/settings/comparator').catch(() => null);
    if (!res) {
      set({ loaded: true });
      return;
    }
    if (res.saved) {
      set({ preferences: comparatorFromPayload(res), loaded: true });
      clearLegacyComparatorPreferences();
      return;
    }
    // First run of this version: move the preferences an older version kept in this browser.
    const legacy = getLegacyComparatorPreferences();
    set({ preferences: legacy ?? DEFAULT_COMPARATOR_PREFERENCES, loaded: true });
    if (!legacy) return;
    try {
      await putSettings('comparator', comparatorToPayload(legacy));
      clearLegacyComparatorPreferences();
    } catch (err) {
      console.warn('[comparatorPreferences] Moving the comparator preferences to the server failed:', err);
    }
  };

  const save = async () => {
    saveInFlight = true;
    try {
      await putSettings<ComparatorSettingsResponse>('comparator', comparatorToPayload(get().preferences));
    } catch (err) {
      reportSettingsSaveFailure('comparator', err);
    } finally {
      saveInFlight = false;
    }
  };

  return {
    preferences: DEFAULT_COMPARATOR_PREFERENCES,
    loaded: false,

    ensureLoaded: () => {
      loading ??= load();
      return loading;
    },

    reload: async () => {
      if (isComparatorSavePending()) return;
      await load();
    },

    update: (prefs) => {
      set({ preferences: { ...prefs } });
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        void save();
      }, SAVE_DEBOUNCE_MS);
    },

    flush: async () => {
      if (!saveTimer) return;
      clearTimeout(saveTimer);
      saveTimer = null;
      await save();
    },
  };
});

/** Back to a fresh store, for tests. */
export function resetComparatorPreferencesStore(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  saveInFlight = false;
  loading = null;
  useComparatorPreferencesStore.setState({ preferences: DEFAULT_COMPARATOR_PREFERENCES, loaded: false });
}
