import { create } from 'zustand';
import { api, ApiError } from '../utils/apiClient';
import { putSettings } from '../utils/settingsClient';
import {
  createAudioSettingsSlice,
  getInitialAudioSettings,
  getLegacyVoiceSettings,
  clearLegacyVoiceSettings,
  voiceFromPayload,
  voiceToPayload,
  type AudioSettingsSlice,
} from './slices/audioSettingsSlice';
import {
  createAlertThresholdsSlice,
  getInitialAlertThresholds,
  thresholdsFromSettings,
  type AlertThresholdsSlice,
  type AlertThresholdValues,
} from './slices/alertThresholdsSlice';
import {
  createTacticalSettingsSlice,
  getInitialTacticalSettings,
  type TacticalSettingsSlice,
} from './slices/tacticalSettingsSlice';
import {
  createRadioPresetsSlice,
  getInitialRadioPresets,
  type RadioPresetsSlice,
} from './slices/radioPresetsSlice';
import {
  ALERT_TOGGLE_KEYS,
  TRIGGER_PRESET_VALUES,
  detectTriggerPreset,
  isRadioTriggerPreset,
  type AlertToggles,
} from './slices/triggerPresets';
import { reportSettingsSaveFailure, useSettingsSaveStore } from './useSettingsSaveStore';
import { RADIO_TRIGGER_PRESETS, TIME_CONSTANTS, type RadioTriggerPreset } from '../constants/f1';
import type {
  EngineerSettings,
  EngineerSettingsResponse,
  VoiceSettingsResponse,
} from '../types/settings';

export interface RadioSettingsState
  extends AudioSettingsSlice,
    AlertThresholdsSlice,
    TacticalSettingsSlice,
    RadioPresetsSlice {
  /** Version of the saved race engineer settings this tab's values are based on. */
  engineerVersion: number;
  resetStoreToDefaults: () => void;
  /** Saves the race engineer settings after a short pause (now with `immediate`). Always resolves. */
  syncConfigToBackend: (immediate?: boolean) => Promise<void>;
  loadConfigFromBackend: () => Promise<void>;
  syncVoiceToBackend: () => void;
  loadVoiceFromBackend: () => Promise<void>;
}

/** The panel values the race engineer settings are made of. */
export type EngineerSettingsValues = AlertThresholdValues &
  AlertToggles & {
    triggerPreset: RadioTriggerPreset;
    smartDiscretionEnabled: boolean;
    chatterCooldownSeconds: number;
  };

/**
 * The race engineer settings to save, without the version. The server derives what the engine
 * runs from them; the panel only sends its own values.
 */
export function engineerSettingsFromValues(v: EngineerSettingsValues): Omit<EngineerSettings, 'version'> {
  return {
    chatter_cooldown_ms: v.chatterCooldownSeconds * TIME_CONSTANTS.MS_PER_SECOND,
    smart_discretion_enabled: v.smartDiscretionEnabled,
    tyre_wear_warn_pct: v.tyreWearWarningPct,
    tyre_wear_crit_pct: v.tyreWearCriticalPct,
    tyre_temp_margin_c: v.tyreTempMarginC,
    wing_damage_warn_pct: v.wingDamageWarnPct,
    floor_damage_warn_pct: v.floorDamageWarnPct,
    engine_wear_warn_pct: v.engineWearWarnPct,
    ers_low_pct: v.ersLowPct,
    engine_overheat_c: v.engineOverheatC,
    brake_overheat_c: v.brakeOverheatC,
    brake_cold_c: v.brakeColdC,
    fuel_delta_laps: v.fuelDeltaLaps,
    undercut_gap_sec: v.undercutGapSec,
    rival_gap_sec: v.rivalGapThresholdSec,
    rival_ahead_gap_sec: v.rivalAheadGapSec,
    qualy_clean_air_sec: v.qualyCleanAirSec,
    corner_cut_warn_threshold: v.cornerCutWarnThreshold,
    rain_horizon_min: v.rainHorizonMin,
    rain_prob_pct: v.rainProbPct,
    pit_call_lead_m: v.pitCallLeadM,
    trigger_preset: v.triggerPreset,
    alert_switches: Object.fromEntries(ALERT_TOGGLE_KEYS.map((key) => [key, v[key]])),
  };
}

export function getInitialRadioSettings() {
  return {
    ...getInitialAudioSettings(),
    ...getInitialAlertThresholds(),
    ...getInitialTacticalSettings(),
    ...getInitialRadioPresets(),
    engineerVersion: 0,
  };
}

/**
 * The panel's switches from a saved setup. A switch the setup was saved without (one added since)
 * takes the saved preset's value, or is on, as the server treats a missing switch.
 */
function alertTogglesFromSwitches(
  switches: Record<string, boolean>,
  preset: RadioTriggerPreset
): { toggles: AlertToggles; missing: boolean } {
  const presetValues = preset === RADIO_TRIGGER_PRESETS.CUSTOM ? null : TRIGGER_PRESET_VALUES[preset];
  const toggles = {} as AlertToggles;
  let missing = false;
  for (const key of ALERT_TOGGLE_KEYS) {
    if (typeof switches[key] === 'boolean') {
      toggles[key] = switches[key];
    } else {
      toggles[key] = presetValues ? presetValues[key] : true;
      missing = true;
    }
  }
  return { toggles, missing };
}

/** Waits this long after the last change before saving, so typing a prompt isn't one request per key. */
const SETTINGS_SYNC_DEBOUNCE_MS = 500;

// Race engineer saves: one debounce timer and at most one request in flight. A change made while
// a request is in flight is saved right after it, with the version that request returned.
let engineerSaveTimer: ReturnType<typeof setTimeout> | null = null;
let engineerSaveInFlight = false;
let engineerSaveQueued = false;
/** Promises of syncConfigToBackend calls waiting for the save that includes their change. */
let engineerSaveWaiters: Array<() => void> = [];

let voiceSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let voiceSaveInFlight = false;

/** True while a race engineer change is waiting to be saved or being saved. */
export function isEngineerSavePending(): boolean {
  return engineerSaveTimer !== null || engineerSaveInFlight || engineerSaveQueued;
}

/** True while a voice change is waiting to be saved or being saved. */
export function isVoiceSavePending(): boolean {
  return voiceSyncTimeout !== null || voiceSaveInFlight;
}

function resetSaveQueues(): void {
  if (engineerSaveTimer) clearTimeout(engineerSaveTimer);
  if (voiceSyncTimeout) clearTimeout(voiceSyncTimeout);
  engineerSaveTimer = null;
  voiceSyncTimeout = null;
  engineerSaveQueued = false;
  const waiters = engineerSaveWaiters;
  engineerSaveWaiters = [];
  waiters.forEach((resolve) => resolve());
}

export const useRadioSettingsStore = create<RadioSettingsState>((set, get, store) => {
  const saveEngineerSettings = async () => {
    const body: EngineerSettings = {
      ...engineerSettingsFromValues(get()),
      version: get().engineerVersion,
    };
    try {
      const res = await putSettings<EngineerSettingsResponse>('engineer', body);
      set({ engineerVersion: res.version });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Another device saved first: its settings win, and a queued change would only resave them.
        engineerSaveQueued = false;
        await get().loadConfigFromBackend();
        useSettingsSaveStore.getState().report('engineer', 'conflict', err.message);
        return;
      }
      reportSettingsSaveFailure('engineer', err);
    }
  };

  const flushEngineerSave = async (): Promise<void> => {
    if (engineerSaveInFlight) {
      engineerSaveQueued = true;
      return;
    }
    engineerSaveInFlight = true;
    const waiters = engineerSaveWaiters;
    engineerSaveWaiters = [];
    try {
      await saveEngineerSettings();
    } finally {
      engineerSaveInFlight = false;
      waiters.forEach((resolve) => resolve());
    }
    if (engineerSaveQueued) {
      engineerSaveQueued = false;
      await flushEngineerSave();
    }
  };

  return {
    ...createAudioSettingsSlice(set, get, store),
    ...createAlertThresholdsSlice(set, get, store),
    ...createTacticalSettingsSlice(set, get, store),
    ...createRadioPresetsSlice(set, get, store),
    engineerVersion: 0,

    resetStoreToDefaults: () => {
      resetSaveQueues();
      set(getInitialRadioSettings());
    },

    syncConfigToBackend: (immediate = false) => {
      const saved = new Promise<void>((resolve) => engineerSaveWaiters.push(resolve));
      if (engineerSaveTimer) {
        clearTimeout(engineerSaveTimer);
        engineerSaveTimer = null;
      }
      if (immediate) {
        void flushEngineerSave();
      } else {
        engineerSaveTimer = setTimeout(() => {
          engineerSaveTimer = null;
          void flushEngineerSave();
        }, SETTINGS_SYNC_DEBOUNCE_MS);
      }
      return saved;
    },

    loadConfigFromBackend: async () => {
      // Backend not available or offline: keep the current state
      const res = await api
        .get<EngineerSettingsResponse>('/api/settings/engineer')
        .catch(() => null);
      if (!res) return;

      let switchesMissing = false;
      set((state) => {
        const nextState: RadioSettingsState = {
          ...state,
          ...thresholdsFromSettings(res, state),
          smartDiscretionEnabled: res.smart_discretion_enabled ?? state.smartDiscretionEnabled,
          chatterCooldownSeconds: res.chatter_cooldown_ms
            ? Math.round(res.chatter_cooldown_ms / TIME_CONSTANTS.MS_PER_SECOND)
            : state.chatterCooldownSeconds,
          engineerVersion: res.version,
        };
        if (res.saved) {
          const savedPreset = isRadioTriggerPreset(res.trigger_preset)
            ? res.trigger_preset
            : RADIO_TRIGGER_PRESETS.CUSTOM;
          const { toggles, missing } = alertTogglesFromSwitches(res.alert_switches ?? {}, savedPreset);
          Object.assign(nextState, toggles);
          switchesMissing = missing;
        }
        nextState.triggerPreset = isRadioTriggerPreset(res.trigger_preset)
          ? res.trigger_preset
          : detectTriggerPreset(nextState);
        return nextState;
      });

      // Fresh install, or switches added since the setup was saved: save the panel's switches so
      // the engine runs what the panel shows.
      if (!res.saved || switchesMissing) {
        await get().syncConfigToBackend(true);
      }
    },

    syncVoiceToBackend: () => {
      if (voiceSyncTimeout) clearTimeout(voiceSyncTimeout);
      voiceSyncTimeout = setTimeout(() => {
        voiceSyncTimeout = null;
        voiceSaveInFlight = true;
        putSettings('voice', voiceToPayload(get()))
          .catch((err) => reportSettingsSaveFailure('voice', err))
          .finally(() => {
            voiceSaveInFlight = false;
          });
      }, SETTINGS_SYNC_DEBOUNCE_MS);
    },

    loadVoiceFromBackend: async () => {
      const res = await api
        .get<VoiceSettingsResponse>('/api/settings/voice')
        .catch(() => null);
      if (!res) return;

      if (res.saved) {
        set((state) => voiceFromPayload(res, state));
        clearLegacyVoiceSettings();
        return;
      }

      // First run of this version: move the voice an older version kept in this browser.
      const legacy = getLegacyVoiceSettings();
      if (!legacy) return;
      set(legacy);
      try {
        await putSettings('voice', voiceToPayload(legacy));
        clearLegacyVoiceSettings();
      } catch (err) {
        console.warn('[radioSettings] Moving the voice settings to the server failed:', err);
      }
    },
  };
});
