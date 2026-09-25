import type { RADIO_STORAGE_KEYS, LEGACY_RADIO_STORAGE_KEYS } from '../constants/f1';

type RadioStorageKey = (typeof RADIO_STORAGE_KEYS)[keyof typeof RADIO_STORAGE_KEYS];
type LegacyRadioStorageKey = (typeof LEGACY_RADIO_STORAGE_KEYS)[keyof typeof LEGACY_RADIO_STORAGE_KEYS];

/**
 * Every key the app keeps in localStorage. These settings are per browser; settings every device
 * shares (alerts, AI provider and keys, voice, push-to-talk) live on the server. The legacy keys
 * and 'f1_ai_engineer_config' are only read once, to move older browser settings to the server.
 */
export type KnownStorageKey =
  | RadioStorageKey
  | LegacyRadioStorageKey
  | 'f1_active_tab'
  | 'f1_telemetry_dismissed_update'
  | 'f1_telemetry_language'
  | 'f1_live_view_mode'
  | 'f1_ai_engineer_config'
  | 'f1_ai_engineer_open'
  | 'f1_ai_engineer_expanded'
  | 'f1_comparator_quick_select_open'
  | 'f1_comparator_default_driver_name'
  | 'f1_comparator_rival_mode'
  | 'f1_comparator_rival_driver_name';

export type StorageKey = KnownStorageKey | (string & {});

export const storage = {
  /**
   * Safely retrieves and parses a value from localStorage.
   * If the item is absent, corrupted, or cannot be parsed, returns fallback.
   */
  get<T>(key: StorageKey, fallback: T): T {
    if (typeof window === 'undefined' || !window.localStorage) {
      return fallback;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return fallback;

      // Handle raw string fallbacks directly if item is not JSON-quoted
      try {
        return JSON.parse(item) as T;
      } catch {
        if (typeof fallback === 'string') {
          return item as unknown as T;
        }
        if (typeof fallback === 'boolean') {
          if (item === 'true') return true as unknown as T;
          if (item === 'false') return false as unknown as T;
        }
        if (typeof fallback === 'number') {
          const parsedNum = Number(item);
          if (!Number.isNaN(parsedNum)) return parsedNum as unknown as T;
        }
        return fallback;
      }
    } catch {
      return fallback;
    }
  },

  /**
   * Safely persists a value into localStorage, serializing objects/primitives to JSON.
   */
  set<T>(key: StorageKey, value: T): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
    } catch {
      // Ignore quota exceeded or security errors in sandboxed environments
    }
  },

  /**
   * Safely removes a key from localStorage.
   */
  remove(key: StorageKey): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  },
};
