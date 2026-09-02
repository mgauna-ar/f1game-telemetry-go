export type KnownStorageKey =
  | 'f1_active_tab'
  | 'f1_telemetry_language'
  | 'f1_live_view_mode'
  | 'f1_ai_engineer_config'
  | 'f1_ai_ptt_config'
  | 'f1_ai_open'
  | 'f1_telemetry_dismissed_update'
  | 'f1_comparator_quick_select_open'
  | 'f1_radio_volume'
  | 'f1_radio_speech_rate'
  | 'f1_radio_speech_pitch'
  | 'f1_radio_persona'
  | 'f1_radio_language'
  | 'f1_radio_voice'
  | 'f1_radio_custom_prompt'
  | 'f1_radio_driver_callsign'
  | 'f1_radio_hud_power'
  | 'f1_radio_discretion_apex'
  | 'f1_radio_discretion_heavy_braking'
  | 'f1_radio_cooldown_mode'
  | 'f1_radio_cooldown_custom_sec'
  | 'f1_radio_gamepad_mapping'
  | 'f1_radio_keyboard_key'
  | 'f1_radio_ptt_mode'
  | 'f1_radio_tyre_wear_warn_pct'
  | 'f1_radio_tyre_wear_crit_pct'
  | 'f1_radio_tyre_thermal_high_c'
  | 'f1_radio_front_wing_warn_pct'
  | 'f1_radio_front_wing_crit_pct'
  | 'f1_radio_floor_warn_pct'
  | 'f1_radio_engine_wear_warn_pct'
  | 'f1_radio_ers_low_soc_warn_pct'
  | 'f1_radio_brake_temp_high_c'
  | 'f1_radio_fuel_deficit_warn_laps'
  | 'f1_radio_rival_drs_window_warn_s'
  | 'f1_radio_micro_sector_pace_loss_s'
  | 'f1_radio_qualy_traffic_gap_warn_s'
  | 'f1_radio_qualy_track_limits_warn'
  | 'f1_radio_qualy_time_remaining_warn_min'
  | 'f1_radio_qualy_elimination_danger_warn'
  | 'f1_radio_steward_penalty_warn'
  | 'f1_radio_rain_forecast_incoming_warn'
  | 'f1_radio_track_grip_transition_warn'
  | 'f1_radio_teammate_proximity_warn_s'
  | 'f1_radio_teammate_pitting_warn'
  | 'f1_radio_traffic_window_warn_s'
  | 'f1_radio_style_preset';

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
