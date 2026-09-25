import { create } from 'zustand';
import { api } from '../utils/apiClient';
import {
  createAudioSettingsSlice,
  getInitialAudioSettings,
  type AudioSettingsSlice,
} from './slices/audioSettingsSlice';
import {
  createAlertThresholdsSlice,
  getInitialAlertThresholds,
  thresholdsFromEngineerConfig,
  type AlertThresholdsSlice,
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
  detectTriggerPreset,
  isRadioTriggerPreset,
  type AlertToggles,
} from './slices/triggerPresets';
import {
  TIME_CONSTANTS,
  RADIO_ALERT_CONSTANTS,
  type RadioTriggerPreset,
} from '../constants/f1';
import type { EngineerConfig } from '../types/telemetry';

export type RadioEngineerConfig = EngineerConfig;

export interface RadioSettingsState
  extends AudioSettingsSlice,
    AlertThresholdsSlice,
    TacticalSettingsSlice,
    RadioPresetsSlice {
  aiConfig: EngineerConfig;
  setAiConfig: (config: Partial<EngineerConfig>) => void;
  resetStoreToDefaults: () => void;
  syncConfigToBackend: (immediate?: boolean) => Promise<void>;
  loadConfigFromBackend: () => Promise<void>;
}

export function buildAIConfigFromValues(v: {
  triggerPreset: RadioTriggerPreset;
  smartDiscretionEnabled: boolean;
  chatterCooldownSeconds: number;
  tyreWearWarningPct: number;
  tyreWearCriticalPct: number;
  tyreOverheatC: number;
  tyreColdC: number;
  wingDamageWarnPct: number;
  floorDamageWarnPct: number;
  engineWearWarnPct: number;
  ersLowPct: number;
  engineOverheatC: number;
  brakeOverheatC: number;
  brakeColdC: number;
  fuelDeltaLaps: number;
  undercutGapSec: number;
  rivalGapThresholdSec: number;
  rivalAheadGapSec: number;
  qualyCleanAirSec: number;
  cornerCutWarnThreshold: number;
  rainHorizonMin: number;
  rainProbPct: number;
  tyreAlertsEnabled: boolean;
  subTyreWear: boolean;
  subTyrePuncture: boolean;
  thermalAlertsEnabled: boolean;
  subTyreThermal: boolean;
  subTyreCold: boolean;
  damageAlertsEnabled: boolean;
  subDamageWing: boolean;
  subDamageFloor: boolean;
  subDamageEngine: boolean;
  subDamageFaults: boolean;
  subEngineTemp: boolean;
  ersAlertsEnabled: boolean;
  subErsLow: boolean;
  brakesAlertsEnabled: boolean;
  subBrakeTemp: boolean;
  subBrakeCold: boolean;
  fuelAlertsEnabled: boolean;
  subFuelDelta: boolean;
  rivalAlertsEnabled: boolean;
  subUndercut: boolean;
  subRivalDefend: boolean;
  subRivalAttack: boolean;
  pitWindowAlertsEnabled: boolean;
  subPitWindow: boolean;
  qualyAlertsEnabled: boolean;
  subQualyInvalid: boolean;
  subQualyTraffic: boolean;
  subQualyTime: boolean;
  subQualyElim: boolean;
  flagsPensAlertsEnabled: boolean;
  subSafetyCar: boolean;
  subRedFlag: boolean;
  subRain: boolean;
  subTrackLimits: boolean;
  subPenalties: boolean;
}): EngineerConfig {
  const alertSwitches = Object.fromEntries(
    ALERT_TOGGLE_KEYS.map((key) => [key, v[key]])
  ) as AlertToggles;

  return {
    chatter_cooldown_ms: v.chatterCooldownSeconds * TIME_CONSTANTS.MS_PER_SECOND,
    global_chatter_cooldown_ms: TIME_CONSTANTS.GLOBAL_CHATTER_COOLDOWN_MS,
    smart_discretion_enabled: v.smartDiscretionEnabled,
    tyre_wear_warn_pct: v.tyreWearWarningPct,
    tyre_wear_crit_pct: v.tyreWearCriticalPct,
    tyre_overheat_c: v.tyreOverheatC,
    tyre_cold_c: v.tyreColdC,
    wing_damage_warn_pct: v.wingDamageWarnPct,
    wing_damage_crit_pct: RADIO_ALERT_CONSTANTS.CRITICAL_WING_DAMAGE_PCT,
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
    qualy_time_warn_sec: RADIO_ALERT_CONSTANTS.QUALY_SESSION_TIME_WARN_SEC,
    corner_cut_warn_threshold: v.cornerCutWarnThreshold,
    rain_horizon_min: v.rainHorizonMin,
    rain_prob_pct: v.rainProbPct,
    enabled_categories: {
      tyre_wear: v.tyreAlertsEnabled && v.subTyreWear,
      tyre_puncture: v.tyreAlertsEnabled && v.subTyrePuncture,
      tyre_thermal: v.thermalAlertsEnabled && v.subTyreThermal,
      tyre_overheat: v.thermalAlertsEnabled && v.subTyreThermal,
      tyre_cold: v.thermalAlertsEnabled && v.subTyreCold,
      wing_damage: v.damageAlertsEnabled && v.subDamageWing,
      damage_wing: v.damageAlertsEnabled && v.subDamageWing,
      floor_damage: v.damageAlertsEnabled && v.subDamageFloor,
      damage_floor: v.damageAlertsEnabled && v.subDamageFloor,
      engine_wear: v.damageAlertsEnabled && v.subDamageEngine,
      damage_engine: v.damageAlertsEnabled && v.subDamageEngine,
      mechanical_fault: v.damageAlertsEnabled && v.subDamageFaults,
      damage_aero_fault: v.damageAlertsEnabled && v.subDamageFaults,
      damage_ers_fault: v.damageAlertsEnabled && v.subDamageFaults,
      damage_gearbox_wear: v.damageAlertsEnabled && v.subDamageEngine,
      damage_ice_wear: v.damageAlertsEnabled && v.subDamageEngine,
      damage_terminal_engine: v.damageAlertsEnabled && v.subDamageEngine,
      damage: v.damageAlertsEnabled,
      ers_low: v.ersAlertsEnabled && v.subErsLow,
      engine_temp: v.damageAlertsEnabled && v.subEngineTemp,
      brake_hot: v.brakesAlertsEnabled && v.subBrakeTemp,
      brake_cold: v.brakesAlertsEnabled && v.subBrakeCold,
      fuel_delta: v.fuelAlertsEnabled && v.subFuelDelta,
      undercut: v.rivalAlertsEnabled && v.subUndercut,
      pit_window: v.pitWindowAlertsEnabled && v.subPitWindow,
      rival_defend: v.rivalAlertsEnabled && v.subRivalDefend,
      rival_attack: v.rivalAlertsEnabled && v.subRivalAttack,
      qualy_invalid: v.qualyAlertsEnabled && v.subQualyInvalid,
      qualy_traffic: v.qualyAlertsEnabled && v.subQualyTraffic,
      qualy_time: v.qualyAlertsEnabled && v.subQualyTime,
      qualy_elim: v.qualyAlertsEnabled && v.subQualyElim,
      flags_sc: v.flagsPensAlertsEnabled && v.subSafetyCar,
      flags_red: v.flagsPensAlertsEnabled && v.subRedFlag,
      flags_rain: v.flagsPensAlertsEnabled && v.subRain,
      flags_rain_live: v.flagsPensAlertsEnabled && v.subRain,
      track_limits: v.flagsPensAlertsEnabled && v.subTrackLimits,
      penalties: v.flagsPensAlertsEnabled && v.subPenalties,
    },
    trigger_preset: v.triggerPreset,
    alert_switches: alertSwitches,
  };
}

export function getInitialRadioSettings() {
  const initialValues = {
    ...getInitialAudioSettings(),
    ...getInitialAlertThresholds(),
    ...getInitialTacticalSettings(),
    ...getInitialRadioPresets(),
  };

  return {
    ...initialValues,
    aiConfig: buildAIConfigFromValues(initialValues),
  };
}

function alertTogglesFromSwitches(switches: Record<string, boolean>): Partial<AlertToggles> {
  const toggles: Partial<AlertToggles> = {};
  for (const key of ALERT_TOGGLE_KEYS) {
    if (typeof switches[key] === 'boolean') toggles[key] = switches[key];
  }
  return toggles;
}

/**
 * Older configs only stored "category switch AND alert switch" per engine alert key, so category
 * switches can't be recovered; only the per-alert switches are restored.
 */
function alertTogglesFromLegacyCategories(
  ec: Record<string, boolean> | undefined
): Partial<AlertToggles> {
  const toggles: Partial<AlertToggles> = {};
  if (!ec) return toggles;
  if (ec.tyre_wear !== undefined) toggles.subTyreWear = ec.tyre_wear;
  if (ec.tyre_puncture !== undefined) toggles.subTyrePuncture = ec.tyre_puncture;
  if (ec.tyre_overheat !== undefined) toggles.subTyreThermal = ec.tyre_overheat;
  else if (ec.tyre_thermal !== undefined) toggles.subTyreThermal = ec.tyre_thermal;
  if (ec.tyre_cold !== undefined) toggles.subTyreCold = ec.tyre_cold;
  if (ec.damage_wing !== undefined) toggles.subDamageWing = ec.damage_wing;
  else if (ec.wing_damage !== undefined) toggles.subDamageWing = ec.wing_damage;
  if (ec.damage_floor !== undefined) toggles.subDamageFloor = ec.damage_floor;
  else if (ec.floor_damage !== undefined) toggles.subDamageFloor = ec.floor_damage;
  if (ec.damage_engine !== undefined) toggles.subDamageEngine = ec.damage_engine;
  else if (ec.engine_wear !== undefined) toggles.subDamageEngine = ec.engine_wear;
  if (ec.damage_aero_fault !== undefined) toggles.subDamageFaults = ec.damage_aero_fault;
  else if (ec.mechanical_fault !== undefined) toggles.subDamageFaults = ec.mechanical_fault;
  if (ec.ers_low !== undefined) toggles.subErsLow = ec.ers_low;
  if (ec.engine_temp !== undefined) toggles.subEngineTemp = ec.engine_temp;
  if (ec.brake_hot !== undefined) toggles.subBrakeTemp = ec.brake_hot;
  if (ec.brake_cold !== undefined) toggles.subBrakeCold = ec.brake_cold;
  if (ec.fuel_delta !== undefined) toggles.subFuelDelta = ec.fuel_delta;
  if (ec.undercut !== undefined) toggles.subUndercut = ec.undercut;
  if (ec.pit_window !== undefined) toggles.subPitWindow = ec.pit_window;
  if (ec.rival_defend !== undefined) toggles.subRivalDefend = ec.rival_defend;
  if (ec.rival_attack !== undefined) toggles.subRivalAttack = ec.rival_attack;
  if (ec.qualy_invalid !== undefined) toggles.subQualyInvalid = ec.qualy_invalid;
  if (ec.qualy_traffic !== undefined) toggles.subQualyTraffic = ec.qualy_traffic;
  if (ec.qualy_time !== undefined) toggles.subQualyTime = ec.qualy_time;
  if (ec.qualy_elim !== undefined) toggles.subQualyElim = ec.qualy_elim;
  if (ec.flags_sc !== undefined) toggles.subSafetyCar = ec.flags_sc;
  if (ec.flags_red !== undefined) toggles.subRedFlag = ec.flags_red;
  if (ec.flags_rain !== undefined) toggles.subRain = ec.flags_rain;
  else if (ec.flags_rain_live !== undefined) toggles.subRain = ec.flags_rain_live;
  if (ec.track_limits !== undefined) toggles.subTrackLimits = ec.track_limits;
  if (ec.penalties !== undefined) toggles.subPenalties = ec.penalties;
  return toggles;
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;

export const useRadioSettingsStore = create<RadioSettingsState>((set, get, store) => ({
  ...createAudioSettingsSlice(set, get, store),
  ...createAlertThresholdsSlice(set, get, store),
  ...createTacticalSettingsSlice(set, get, store),
  ...createRadioPresetsSlice(set, get, store),
  aiConfig: buildAIConfigFromValues(getInitialRadioSettings()),

  setAiConfig: (cfg: Partial<RadioEngineerConfig>) => {
    set((state) => ({
      aiConfig: {
        ...state.aiConfig,
        ...cfg,
      },
    }));
    get().syncConfigToBackend();
  },

  resetStoreToDefaults: () => {
    const initialSettings = getInitialRadioSettings();
    set(initialSettings);
  },

  syncConfigToBackend: async (immediate = false) => {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }

    const doSync = async () => {
      try {
        await api.post('/api/ai/engineer/config', get().aiConfig);
      } catch {
        // ignore network error
      }
    };

    if (immediate) {
      await doSync();
      return;
    }

    return new Promise<void>((resolve) => {
      syncTimeout = setTimeout(async () => {
        await doSync();
        syncTimeout = null;
        resolve();
      }, 500);
    });
  },

  loadConfigFromBackend: async () => {
    // Backend not available or offline: keep the current state
    const cfg = await api
      .get<RadioEngineerConfig>('/api/ai/engineer/config')
      .catch(() => null);
    if (!cfg) return;

    // Configs saved before the panel state was stored have no alert_switches. Those (and fresh
    // installs) are migrated below and written back once so the server holds the full state.
    const needsMigration = !cfg.alert_switches;

    set((state) => {
      const loaded: Partial<RadioSettingsState> = {
        ...thresholdsFromEngineerConfig(cfg, state),
        smartDiscretionEnabled: cfg.smart_discretion_enabled ?? state.smartDiscretionEnabled,
        chatterCooldownSeconds: cfg.chatter_cooldown_ms
          ? Math.round(cfg.chatter_cooldown_ms / TIME_CONSTANTS.MS_PER_SECOND)
          : state.chatterCooldownSeconds,
        ...(cfg.alert_switches
          ? alertTogglesFromSwitches(cfg.alert_switches)
          : alertTogglesFromLegacyCategories(cfg.enabled_categories)),
      };

      const nextState = { ...state, ...loaded };
      nextState.triggerPreset = isRadioTriggerPreset(cfg.trigger_preset)
        ? cfg.trigger_preset
        : detectTriggerPreset(nextState);

      return {
        ...nextState,
        aiConfig: buildAIConfigFromValues(nextState),
      };
    });

    if (needsMigration) {
      await get().syncConfigToBackend(true);
    }
  },
}));
