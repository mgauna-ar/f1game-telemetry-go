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
import { TIME_CONSTANTS, RADIO_ALERT_CONSTANTS } from '../constants/f1';
import type { EngineerConfig } from '../types/telemetry';

export type RadioEngineerConfig = EngineerConfig;
/**
 * @deprecated Use `RadioEngineerConfig` to avoid confusion with LLM provider `AIConfig` in RaceEngineerContext.
 */
export type AIConfig = RadioEngineerConfig;

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
    try {
      const cfg = await api.get<RadioEngineerConfig>('/api/ai/engineer/config');
      if (cfg) {
        set((state) => {
          const loaded: Partial<RadioSettingsState> = {
            smartDiscretionEnabled:
              cfg.smart_discretion_enabled ?? state.smartDiscretionEnabled,
            chatterCooldownSeconds: cfg.chatter_cooldown_ms
              ? Math.round(cfg.chatter_cooldown_ms / TIME_CONSTANTS.MS_PER_SECOND)
              : state.chatterCooldownSeconds,
            tyreWearWarningPct:
              cfg.tyre_wear_warn_pct ?? state.tyreWearWarningPct,
            tyreWearCriticalPct:
              cfg.tyre_wear_crit_pct ?? state.tyreWearCriticalPct,
            tyreOverheatC: cfg.tyre_overheat_c ?? state.tyreOverheatC,
            tyreColdC: cfg.tyre_cold_c ?? state.tyreColdC,
            wingDamageWarnPct:
              cfg.wing_damage_warn_pct ?? state.wingDamageWarnPct,
            floorDamageWarnPct:
              cfg.floor_damage_warn_pct ?? state.floorDamageWarnPct,
            engineWearWarnPct:
              cfg.engine_wear_warn_pct ?? state.engineWearWarnPct,
            ersLowPct: cfg.ers_low_pct ?? state.ersLowPct,
            engineOverheatC:
              cfg.engine_overheat_c ?? state.engineOverheatC,
            brakeOverheatC: cfg.brake_overheat_c ?? state.brakeOverheatC,
            brakeColdC: cfg.brake_cold_c ?? state.brakeColdC,
            fuelDeltaLaps: cfg.fuel_delta_laps ?? state.fuelDeltaLaps,
            undercutGapSec: cfg.undercut_gap_sec ?? state.undercutGapSec,
            rivalGapThresholdSec:
              cfg.rival_gap_sec ?? state.rivalGapThresholdSec,
            rivalAheadGapSec:
              cfg.rival_ahead_gap_sec ?? state.rivalAheadGapSec,
            qualyCleanAirSec:
              cfg.qualy_clean_air_sec ?? state.qualyCleanAirSec,
            cornerCutWarnThreshold:
              cfg.corner_cut_warn_threshold ?? state.cornerCutWarnThreshold,
            rainHorizonMin: cfg.rain_horizon_min ?? state.rainHorizonMin,
            rainProbPct: cfg.rain_prob_pct ?? state.rainProbPct,
          };

          if (cfg.enabled_categories) {
            const ec = cfg.enabled_categories;
            if (ec.tyre_wear !== undefined) loaded.subTyreWear = ec.tyre_wear;
            if (ec.tyre_puncture !== undefined)
              loaded.subTyrePuncture = ec.tyre_puncture;
            if (ec.tyre_overheat !== undefined)
              loaded.subTyreThermal = ec.tyre_overheat;
            else if (ec.tyre_thermal !== undefined)
              loaded.subTyreThermal = ec.tyre_thermal;
            if (ec.tyre_cold !== undefined) loaded.subTyreCold = ec.tyre_cold;
            if (ec.damage_wing !== undefined)
              loaded.subDamageWing = ec.damage_wing;
            else if (ec.wing_damage !== undefined)
              loaded.subDamageWing = ec.wing_damage;
            if (ec.damage_floor !== undefined)
              loaded.subDamageFloor = ec.damage_floor;
            else if (ec.floor_damage !== undefined)
              loaded.subDamageFloor = ec.floor_damage;
            if (ec.damage_engine !== undefined)
              loaded.subDamageEngine = ec.damage_engine;
            else if (ec.engine_wear !== undefined)
              loaded.subDamageEngine = ec.engine_wear;
            if (ec.damage_aero_fault !== undefined)
              loaded.subDamageFaults = ec.damage_aero_fault;
            else if (ec.mechanical_fault !== undefined)
              loaded.subDamageFaults = ec.mechanical_fault;
            if (ec.ers_low !== undefined) loaded.subErsLow = ec.ers_low;
            if (ec.engine_temp !== undefined)
              loaded.subEngineTemp = ec.engine_temp;
            if (ec.brake_hot !== undefined) loaded.subBrakeTemp = ec.brake_hot;
            if (ec.brake_cold !== undefined)
              loaded.subBrakeCold = ec.brake_cold;
            if (ec.fuel_delta !== undefined)
              loaded.subFuelDelta = ec.fuel_delta;
            if (ec.undercut !== undefined) loaded.subUndercut = ec.undercut;
            if (ec.pit_window !== undefined)
              loaded.subPitWindow = ec.pit_window;
            if (ec.rival_defend !== undefined)
              loaded.subRivalDefend = ec.rival_defend;
            if (ec.rival_attack !== undefined)
              loaded.subRivalAttack = ec.rival_attack;
            if (ec.qualy_invalid !== undefined)
              loaded.subQualyInvalid = ec.qualy_invalid;
            if (ec.qualy_traffic !== undefined)
              loaded.subQualyTraffic = ec.qualy_traffic;
            if (ec.qualy_time !== undefined)
              loaded.subQualyTime = ec.qualy_time;
            if (ec.qualy_elim !== undefined)
              loaded.subQualyElim = ec.qualy_elim;
            if (ec.flags_sc !== undefined) loaded.subSafetyCar = ec.flags_sc;
            if (ec.flags_red !== undefined) loaded.subRedFlag = ec.flags_red;
            if (ec.flags_rain !== undefined) loaded.subRain = ec.flags_rain;
            else if (ec.flags_rain_live !== undefined) loaded.subRain = ec.flags_rain_live;
            if (ec.track_limits !== undefined)
              loaded.subTrackLimits = ec.track_limits;
            if (ec.penalties !== undefined) loaded.subPenalties = ec.penalties;
          }

          const nextState = { ...state, ...loaded };
          return {
            ...nextState,
            aiConfig: buildAIConfigFromValues(nextState),
          };
        });
      }
    } catch {
      // Backend not available or offline, keep current state
    }
  },
}));
