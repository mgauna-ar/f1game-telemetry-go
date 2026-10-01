import type { RADIO_STORAGE_KEYS, LEGACY_RADIO_STORAGE_KEYS } from '../constants/f1';

type RadioStorageKey = (typeof RADIO_STORAGE_KEYS)[keyof typeof RADIO_STORAGE_KEYS];
type LegacyRadioStorageKey = (typeof LEGACY_RADIO_STORAGE_KEYS)[keyof typeof LEGACY_RADIO_STORAGE_KEYS];

/**
 * Every key the app keeps in localStorage. These settings are per browser; settings every device
 * shares (alerts, AI provider and keys, voice, push-to-talk, comparator rival) live on the server.
 * The legacy keys, 'f1_ai_engineer_config' and the comparator rival keys are only read once, to move
 * older browser settings to the server.
 */
export type KnownStorageKey =
  | RadioStorageKey
  | LegacyRadioStorageKey
  | 'f1_active_tab'
  | 'f1_telemetry_dismissed_update'
  | 'f1_telemetry_language'
  | 'f1_live_view_mode'
  | 'f1_live_view_mode_phone'
  | 'f1_race_control_layout'
  | 'f1_units'
  | 'f1_performance_mode'
  | 'f1_performance_mode_driver'
  | 'f1_ai_engineer_config'
  | 'f1_ai_engineer_open'
  | 'f1_ai_engineer_expanded'
  | 'f1_ai_engineer_docked'
  // Old saved driver name: only read once to apply it to sessions without a driver, then removed
  | 'f1_comparator_default_driver_name'
  // Comparator rival: only read once to move it to /api/settings/comparator, then removed
  | 'f1_comparator_rival_mode'
  | 'f1_comparator_rival_driver_name'
  | 'f1_comparator_chart_view'
  | 'f1_comparator_strip_layout'
  | 'f1_history_group_by'
  | 'f1_history_saved_filters';

export type StorageKey = KnownStorageKey | (string & {});

/** The raw stored text, or null when absent or storage is unavailable. */
function readRaw(key: StorageKey): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const storage = {
  /** Whether anything is stored under `key`. */
  has(key: StorageKey): boolean {
    return readRaw(key) !== null;
  },

  /**
   * A stored string, saved raw or JSON-quoted. Unlike `get`, a value that looks like a number or
   * boolean ("44" as a callsign) stays a string. Falls back when absent, empty, or not one of
   * `allowed`.
   */
  getString<T extends string>(key: StorageKey, fallback: T, allowed?: readonly T[]): T {
    const raw = readRaw(key);
    if (!raw) return fallback;
    let value = raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'string') value = parsed;
    } catch {
      // Saved raw
    }
    return value && (!allowed || allowed.includes(value as T)) ? (value as T) : fallback;
  },

  /** A stored `true`/`false`; anything else falls back. */
  getBoolean(key: StorageKey, fallback: boolean): boolean {
    const raw = readRaw(key);
    return raw === 'true' ? true : raw === 'false' ? false : fallback;
  },

  /** A stored number clamped to [min, max]; anything that isn't a number falls back. */
  getNumber(key: StorageKey, fallback: number, min = -Infinity, max = Infinity): number {
    const raw = readRaw(key);
    const num = raw === null || raw.trim() === '' ? NaN : Number(raw);
    return Number.isNaN(num) ? fallback : Math.min(max, Math.max(min, num));
  },

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
