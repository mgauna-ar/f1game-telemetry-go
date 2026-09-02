import { create } from 'zustand';
import {
  RADIO_STORAGE_KEYS,
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_AUDIO_CONSTANTS,
  RADIO_ALERT_CONSTANTS,
  RADIO_TRIGGER_PRESETS,
  type RadioPersona,
  type RadioLanguage,
  type RadioTriggerPreset,
} from '../constants/f1';
import { api } from '../utils/apiClient';

function getStoredBool(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val === 'true' : def;
  } catch {
    return def;
  }
}

function getStoredNum(key: string, def: number, min?: number, max?: number): number {
  if (typeof window === 'undefined') return def;
  try {
    const val = localStorage.getItem(key);
    if (val === null) return def;
    const num = parseFloat(val);
    if (isNaN(num)) return def;
    if (min !== undefined && num < min) return min;
    if (max !== undefined && num > max) return max;
    return num;
  } catch {
    return def;
  }
}

function getStoredStr<T extends string>(key: string, def: T, allowedValues?: readonly T[]): T {
  if (typeof window === 'undefined') return def;
  try {
    const val = localStorage.getItem(key) as T;
    if (val && (!allowedValues || allowedValues.includes(val))) return val;
    return def;
  } catch {
    return def;
  }
}

function saveStorage(key: string, val: string | number | boolean) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, String(val));
    } catch {
      // ignore
    }
  }
}

export interface AIConfig {
  chatter_cooldown_ms: number;
  smart_discretion_enabled: boolean;
  tyre_wear_warn_pct: number;
  tyre_wear_crit_pct: number;
  tyre_overheat_c: number;
  tyre_cold_c: number;
  wing_damage_warn_pct: number;
  wing_damage_crit_pct: number;
  floor_damage_warn_pct: number;
  engine_wear_warn_pct: number;
  ers_low_pct: number;
  engine_overheat_c: number;
  brake_overheat_c: number;
  brake_cold_c: number;
  fuel_delta_laps: number;
  undercut_gap_sec: number;
  rival_gap_sec: number;
  rival_ahead_gap_sec: number;
  qualy_clean_air_sec: number;
  qualy_time_warn_sec: number;
  corner_cut_warn_threshold: number;
  rain_horizon_min: number;
  rain_prob_pct: number;
  enabled_categories: Record<string, boolean>;
}

export interface RadioSettingsState {
  isRadioEnabled: boolean;
  persona: RadioPersona;
  radioLanguage: RadioLanguage;
  customPrompt: string;
  driverCallsign: string;
  beepsEnabled: boolean;
  filterEnabled: boolean;
  staticFxEnabled: boolean;
  volume: number;
  speechRate: number;
  speechPitch: number;
  neuralVoice: string;

  // Trigger & Discretion
  smartDiscretionEnabled: boolean;
  chatterCooldownSeconds: number;
  triggerPreset: RadioTriggerPreset;

  // Subsystem master switches
  tyreAlertsEnabled: boolean;
  thermalAlertsEnabled: boolean;
  damageAlertsEnabled: boolean;
  ersAlertsEnabled: boolean;
  brakesAlertsEnabled: boolean;
  fuelAlertsEnabled: boolean;
  rivalAlertsEnabled: boolean;
  pitWindowAlertsEnabled: boolean;
  trackAlertsEnabled: boolean;
  qualyAlertsEnabled: boolean;
  flagsPensAlertsEnabled: boolean;

  // Sub-alert individual toggles
  subTyreWear: boolean;
  subTyrePuncture: boolean;
  subTyreThermal: boolean;
  subTyreCold: boolean;
  subDamageWing: boolean;
  subDamageFloor: boolean;
  subDamageEngine: boolean;
  subDamageFaults: boolean;
  subErsLow: boolean;
  subEngineTemp: boolean;
  subBrakeTemp: boolean;
  subBrakeCold: boolean;
  subFuelDelta: boolean;
  subUndercut: boolean;
  subPitWindow: boolean;
  subRivalDefend: boolean;
  subRivalAttack: boolean;
  subQualyTraffic: boolean;
  subQualyInvalid: boolean;
  subQualyTime: boolean;
  subQualyElim: boolean;
  subSafetyCar: boolean;
  subRedFlag: boolean;
  subRain: boolean;
  subTrackLimits: boolean;
  subPenalties: boolean;

  // Granular thresholds
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

  // Nested AI config
  aiConfig: AIConfig;

  // Actions
  setIsRadioEnabled: (enabled: boolean) => void;
  setPersona: (p: RadioPersona) => void;
  setRadioLanguage: (lang: RadioLanguage) => void;
  setCustomPrompt: (prompt: string) => void;
  setDriverCallsign: (callsign: string) => void;
  setBeepsEnabled: (enabled: boolean) => void;
  setFilterEnabled: (enabled: boolean) => void;
  setStaticFxEnabled: (enabled: boolean) => void;
  setVolume: (v: number) => void;
  setSpeechRate: (rate: number) => void;
  setSpeechPitch: (pitch: number) => void;
  setNeuralVoice: (v: string) => void;

  setSmartDiscretionEnabled: (enabled: boolean) => void;
  setChatterCooldownSeconds: (sec: number) => void;
  applyTriggerPreset: (preset: RadioTriggerPreset) => void;
  resetTriggerDefaults: () => void;

  setTyreAlertsEnabled: (enabled: boolean) => void;
  setThermalAlertsEnabled: (enabled: boolean) => void;
  setDamageAlertsEnabled: (enabled: boolean) => void;
  setErsAlertsEnabled: (enabled: boolean) => void;
  setBrakesAlertsEnabled: (enabled: boolean) => void;
  setFuelAlertsEnabled: (enabled: boolean) => void;
  setRivalAlertsEnabled: (enabled: boolean) => void;
  setPitWindowAlertsEnabled: (enabled: boolean) => void;
  setTrackAlertsEnabled: (enabled: boolean) => void;
  setQualyAlertsEnabled: (enabled: boolean) => void;
  setFlagsPensAlertsEnabled: (enabled: boolean) => void;

  setSubTyreWear: (enabled: boolean) => void;
  setSubTyrePuncture: (enabled: boolean) => void;
  setSubTyreThermal: (enabled: boolean) => void;
  setSubTyreCold: (enabled: boolean) => void;
  setSubDamageWing: (enabled: boolean) => void;
  setSubDamageFloor: (enabled: boolean) => void;
  setSubDamageEngine: (enabled: boolean) => void;
  setSubDamageFaults: (enabled: boolean) => void;
  setSubErsLow: (enabled: boolean) => void;
  setSubEngineTemp: (enabled: boolean) => void;
  setSubBrakeTemp: (enabled: boolean) => void;
  setSubBrakeCold: (enabled: boolean) => void;
  setSubFuelDelta: (enabled: boolean) => void;
  setSubUndercut: (enabled: boolean) => void;
  setSubPitWindow: (enabled: boolean) => void;
  setSubRivalDefend: (enabled: boolean) => void;
  setSubRivalAttack: (enabled: boolean) => void;
  setSubQualyTraffic: (enabled: boolean) => void;
  setSubQualyInvalid: (enabled: boolean) => void;
  setSubQualyTime: (enabled: boolean) => void;
  setSubQualyElim: (enabled: boolean) => void;
  setSubSafetyCar: (enabled: boolean) => void;
  setSubRedFlag: (enabled: boolean) => void;
  setSubRain: (enabled: boolean) => void;
  setSubTrackLimits: (enabled: boolean) => void;
  setSubPenalties: (enabled: boolean) => void;

  setTyreWearWarningPct: (pct: number) => void;
  setTyreWearCriticalPct: (pct: number) => void;
  setTyreOverheatC: (temp: number) => void;
  setTyreColdC: (temp: number) => void;
  setWingDamageWarnPct: (pct: number) => void;
  setFloorDamageWarnPct: (pct: number) => void;
  setEngineWearWarnPct: (pct: number) => void;
  setEngineOverheatC: (temp: number) => void;
  setErsLowPct: (pct: number) => void;
  setBrakeOverheatC: (temp: number) => void;
  setBrakeColdC: (temp: number) => void;
  setFuelDeltaLaps: (laps: number) => void;
  setUndercutGapSec: (sec: number) => void;
  setRivalGapThresholdSec: (sec: number) => void;
  setRivalAheadGapSec: (sec: number) => void;
  setQualyCleanAirSec: (sec: number) => void;
  setCornerCutWarnThreshold: (count: number) => void;
  setRainHorizonMin: (min: number) => void;
  setRainProbPct: (pct: number) => void;

  setAiConfig: (config: Partial<AIConfig>) => void;
  resetStoreToDefaults: () => void;
  syncConfigToBackend: () => Promise<void>;
}

function buildAIConfigFromValues(v: {
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
}): AIConfig {
  return {
    chatter_cooldown_ms: v.chatterCooldownSeconds * 1000,
    smart_discretion_enabled: v.smartDiscretionEnabled,
    tyre_wear_warn_pct: v.tyreWearWarningPct,
    tyre_wear_crit_pct: v.tyreWearCriticalPct,
    tyre_overheat_c: v.tyreOverheatC,
    tyre_cold_c: v.tyreColdC,
    wing_damage_warn_pct: v.wingDamageWarnPct,
    wing_damage_crit_pct: 40.0,
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
    qualy_time_warn_sec: 180.0,
    corner_cut_warn_threshold: v.cornerCutWarnThreshold,
    rain_horizon_min: v.rainHorizonMin,
    rain_prob_pct: v.rainProbPct,
    enabled_categories: {
      tyre_wear: v.tyreAlertsEnabled && v.subTyreWear,
      tyre_puncture: v.tyreAlertsEnabled && v.subTyrePuncture,
      tyre_thermal: v.thermalAlertsEnabled && v.subTyreThermal,
      tyre_cold: v.thermalAlertsEnabled && v.subTyreCold,
      wing_damage: v.damageAlertsEnabled && v.subDamageWing,
      floor_damage: v.damageAlertsEnabled && v.subDamageFloor,
      engine_wear: v.damageAlertsEnabled && v.subDamageEngine,
      mechanical_fault: v.damageAlertsEnabled && v.subDamageFaults,
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
      track_limits: v.flagsPensAlertsEnabled && v.subTrackLimits,
      penalties: v.flagsPensAlertsEnabled && v.subPenalties,
    },
  };
}

export function getInitialRadioSettings() {
  const values = {
    isRadioEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_ENABLED, true),
    persona: getStoredStr<RadioPersona>(RADIO_STORAGE_KEYS.PERSONA, RADIO_PERSONAS.BONO, Object.values(RADIO_PERSONAS)),
    radioLanguage: getStoredStr<RadioLanguage>(RADIO_STORAGE_KEYS.LANGUAGE, RADIO_LANGUAGES.AUTO, Object.values(RADIO_LANGUAGES)),
    customPrompt: getStoredStr(RADIO_STORAGE_KEYS.CUSTOM_PROMPT, ''),
    driverCallsign: getStoredStr(RADIO_STORAGE_KEYS.DRIVER_CALLSIGN, ''),
    beepsEnabled: getStoredBool(RADIO_STORAGE_KEYS.BEEPS_ENABLED, true),
    filterEnabled: getStoredBool(RADIO_STORAGE_KEYS.FILTER_ENABLED, true),
    staticFxEnabled: getStoredBool(RADIO_STORAGE_KEYS.STATIC_FX_ENABLED, true),
    volume: getStoredNum(RADIO_STORAGE_KEYS.VOLUME, RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME, 0, 1),
    speechRate: getStoredNum(RADIO_STORAGE_KEYS.SPEECH_RATE, RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_RATE_PERCENT, -20, 30),
    speechPitch: getStoredNum(RADIO_STORAGE_KEYS.SPEECH_PITCH, RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_PITCH_HZ, -100, 100),
    neuralVoice: getStoredStr(RADIO_STORAGE_KEYS.NEURAL_VOICE, ''),

    smartDiscretionEnabled: getStoredBool(RADIO_STORAGE_KEYS.SMART_DISCRETION_ENABLED, true),
    chatterCooldownSeconds: getStoredNum(RADIO_STORAGE_KEYS.CHATTER_COOLDOWN_SEC, RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL, 10, 120),
    triggerPreset: getStoredStr<RadioTriggerPreset>(RADIO_STORAGE_KEYS.TRIGGER_PRESET, RADIO_TRIGGER_PRESETS.IMMERSIVE, Object.values(RADIO_TRIGGER_PRESETS)),

    tyreAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_TYRE, true),
    thermalAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_THERMAL, true),
    damageAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_DAMAGE, true),
    ersAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_ERS, true),
    brakesAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_BRAKES, true),
    fuelAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_FUEL, true),
    rivalAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_RIVAL, true),
    pitWindowAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_PIT_WINDOW, true),
    trackAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_TRACK, true),
    qualyAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_QUALY, true),
    flagsPensAlertsEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_FLAGS_PENS, true),

    subTyreWear: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_WEAR, true),
    subTyrePuncture: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_PUNCTURE, true),
    subTyreThermal: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_THERMAL, true),
    subTyreCold: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_COLD, true),
    subDamageWing: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_WING, true),
    subDamageFloor: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FLOOR, true),
    subDamageEngine: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_ENGINE, true),
    subDamageFaults: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FAULTS, true),
    subErsLow: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_ERS_LOW, true),
    subEngineTemp: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_ENGINE_TEMP, true),
    subBrakeTemp: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_TEMP, true),
    subBrakeCold: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_COLD, true),
    subFuelDelta: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_FUEL_DELTA, true),
    subUndercut: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_UNDERCUT, true),
    subPitWindow: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_PIT_WINDOW, true),
    subRivalDefend: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_DEFEND, true),
    subRivalAttack: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_ATTACK, true),
    subQualyTraffic: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TRAFFIC, true),
    subQualyInvalid: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_INVALID, true),
    subQualyTime: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TIME, true),
    subQualyElim: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_ELIM, true),
    subSafetyCar: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_SAFETY_CAR, true),
    subRedFlag: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_RED_FLAG, true),
    subRain: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_RAIN, true),
    subTrackLimits: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_TRACK_LIMITS, true),
    subPenalties: getStoredBool(RADIO_STORAGE_KEYS.SUB_ALERT_PENALTIES, true),

    tyreWearWarningPct: getStoredNum(RADIO_STORAGE_KEYS.TYRE_WEAR_WARN_PCT, 40, 20, 80),
    tyreWearCriticalPct: getStoredNum(RADIO_STORAGE_KEYS.TYRE_WEAR_CRIT_PCT, 75, 50, 95),
    tyreOverheatC: getStoredNum(RADIO_STORAGE_KEYS.TYRE_OVERHEAT_C, 115, 90, 140),
    tyreColdC: getStoredNum(RADIO_STORAGE_KEYS.TYRE_COLD_C, 80, 50, 100),
    wingDamageWarnPct: getStoredNum(RADIO_STORAGE_KEYS.WING_DAMAGE_WARN_PCT, 20, 5, 50),
    floorDamageWarnPct: getStoredNum(RADIO_STORAGE_KEYS.FLOOR_DAMAGE_WARN_PCT, 25, 10, 60),
    engineWearWarnPct: getStoredNum(RADIO_STORAGE_KEYS.ENGINE_WEAR_WARN_PCT, 70, 40, 90),
    ersLowPct: getStoredNum(RADIO_STORAGE_KEYS.ERS_LOW_PCT, 15, 5, 40),
    engineOverheatC: getStoredNum(RADIO_STORAGE_KEYS.ENGINE_OVERHEAT_C, 125, 105, 145),
    brakeOverheatC: getStoredNum(RADIO_STORAGE_KEYS.BRAKE_OVERHEAT_C, 1000, 600, 1200),
    brakeColdC: getStoredNum(RADIO_STORAGE_KEYS.BRAKE_COLD_C, 200, 50, 400),
    fuelDeltaLaps: getStoredNum(RADIO_STORAGE_KEYS.FUEL_DELTA_LAPS, -0.5, -3.0, 0.0),
    undercutGapSec: getStoredNum(RADIO_STORAGE_KEYS.UNDERCUT_GAP_SEC, 3.0, 1.0, 5.0),
    rivalGapThresholdSec: getStoredNum(RADIO_STORAGE_KEYS.RIVAL_GAP_THRESHOLD_SEC, 1.0, 0.5, 3.0),
    rivalAheadGapSec: getStoredNum(RADIO_STORAGE_KEYS.RIVAL_AHEAD_GAP_SEC, 1.2, 0.5, 3.0),
    qualyCleanAirSec: getStoredNum(RADIO_STORAGE_KEYS.QUALY_CLEAN_AIR_SEC, 4.0, 1.5, 7.0),
    cornerCutWarnThreshold: getStoredNum(RADIO_STORAGE_KEYS.CORNER_CUT_WARN_THRESHOLD, 2, 1, 3),
    rainHorizonMin: getStoredNum(RADIO_STORAGE_KEYS.RAIN_HORIZON_MIN, 10, 5, 30),
    rainProbPct: getStoredNum(RADIO_STORAGE_KEYS.RAIN_PROB_PCT, 50, 20, 80),
  };

  return {
    ...values,
    aiConfig: buildAIConfigFromValues(values),
  };
}

export const useRadioSettingsStore = create<RadioSettingsState>((set, get) => {
  const markCustomPreset = () => {
    saveStorage(RADIO_STORAGE_KEYS.TRIGGER_PRESET, RADIO_TRIGGER_PRESETS.CUSTOM);
    set({ triggerPreset: RADIO_TRIGGER_PRESETS.CUSTOM });
    get().syncConfigToBackend();
  };

  const createBoolAction = (key: string, field: keyof RadioSettingsState, triggersCustom = false) => (val: boolean) => {
    saveStorage(key, val);
    set((state) => {
      const nextState = { ...state, [field]: val };
      return {
        ...nextState,
        aiConfig: buildAIConfigFromValues(nextState as any),
      };
    });
    if (triggersCustom) {
      markCustomPreset();
    } else {
      get().syncConfigToBackend();
    }
  };

  const createNumAction = (key: string, field: keyof RadioSettingsState, min?: number, max?: number, triggersCustom = false) => (val: number) => {
    let clamped = val;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    saveStorage(key, clamped);
    set((state) => {
      const nextState = { ...state, [field]: clamped };
      return {
        ...nextState,
        aiConfig: buildAIConfigFromValues(nextState as any),
      };
    });
    if (triggersCustom) {
      markCustomPreset();
    } else {
      get().syncConfigToBackend();
    }
  };

  return {
    ...getInitialRadioSettings(),
    resetStoreToDefaults: () => set(getInitialRadioSettings()),

    setAiConfig: (cfg: Partial<AIConfig>) => {
      set((state) => ({
        aiConfig: {
          ...state.aiConfig,
          ...cfg,
        },
      }));
      get().syncConfigToBackend();
    },

    setIsRadioEnabled: (val) => {
      saveStorage(RADIO_STORAGE_KEYS.ALERTS_ENABLED, val);
      set({ isRadioEnabled: val });
    },
    setPersona: (p) => {
      saveStorage(RADIO_STORAGE_KEYS.PERSONA, p);
      set({ persona: p });
    },
    setRadioLanguage: (lang) => {
      saveStorage(RADIO_STORAGE_KEYS.LANGUAGE, lang);
      set({ radioLanguage: lang });
    },
    setCustomPrompt: (prompt) => {
      saveStorage(RADIO_STORAGE_KEYS.CUSTOM_PROMPT, prompt);
      set({ customPrompt: prompt });
    },
    setDriverCallsign: (callsign) => {
      saveStorage(RADIO_STORAGE_KEYS.DRIVER_CALLSIGN, callsign);
      set({ driverCallsign: callsign });
    },
    setBeepsEnabled: (val) => {
      saveStorage(RADIO_STORAGE_KEYS.BEEPS_ENABLED, val);
      set({ beepsEnabled: val });
    },
    setFilterEnabled: (val) => {
      saveStorage(RADIO_STORAGE_KEYS.FILTER_ENABLED, val);
      set({ filterEnabled: val });
    },
    setStaticFxEnabled: (val) => {
      saveStorage(RADIO_STORAGE_KEYS.STATIC_FX_ENABLED, val);
      set({ staticFxEnabled: val });
    },
    setVolume: (v) => {
      const clamped = Math.max(0, Math.min(1, v));
      saveStorage(RADIO_STORAGE_KEYS.VOLUME, clamped);
      set({ volume: clamped });
    },
    setSpeechRate: (r) => {
      const clamped = Math.max(-20, Math.min(30, r));
      saveStorage(RADIO_STORAGE_KEYS.SPEECH_RATE, clamped);
      set({ speechRate: clamped });
    },
    setSpeechPitch: (p) => {
      const clamped = Math.max(-100, Math.min(100, p));
      saveStorage(RADIO_STORAGE_KEYS.SPEECH_PITCH, clamped);
      set({ speechPitch: clamped });
    },
    setNeuralVoice: (v) => {
      saveStorage(RADIO_STORAGE_KEYS.NEURAL_VOICE, v);
      set({ neuralVoice: v });
    },

    setSmartDiscretionEnabled: (val) => {
      saveStorage(RADIO_STORAGE_KEYS.SMART_DISCRETION_ENABLED, val);
      set((state) => {
        const nextState = { ...state, smartDiscretionEnabled: val };
        return {
          ...nextState,
          aiConfig: buildAIConfigFromValues(nextState as any),
        };
      });
      get().syncConfigToBackend();
    },
    setChatterCooldownSeconds: (sec) => {
      saveStorage(RADIO_STORAGE_KEYS.CHATTER_COOLDOWN_SEC, sec);
      set((state) => {
        const nextState = { ...state, chatterCooldownSeconds: sec };
        return {
          ...nextState,
          aiConfig: buildAIConfigFromValues(nextState as any),
        };
      });
      get().syncConfigToBackend();
    },

    applyTriggerPreset: (preset) => {
      saveStorage(RADIO_STORAGE_KEYS.TRIGGER_PRESET, preset);
      let partial: Partial<RadioSettingsState> = {};
      if (preset === RADIO_TRIGGER_PRESETS.IMMERSIVE) {
        partial = {
          triggerPreset: preset,
          tyreAlertsEnabled: true,
          thermalAlertsEnabled: true,
          damageAlertsEnabled: true,
          ersAlertsEnabled: true,
          brakesAlertsEnabled: true,
          fuelAlertsEnabled: true,
          rivalAlertsEnabled: true,
          pitWindowAlertsEnabled: true,
          trackAlertsEnabled: true,
          qualyAlertsEnabled: true,
          flagsPensAlertsEnabled: true,
          chatterCooldownSeconds: RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL,
          subTyreWear: true,
          subTyrePuncture: true,
          subTyreThermal: false,
          subTyreCold: false,
          subDamageWing: true,
          subDamageFloor: false,
          subDamageEngine: false,
          subDamageFaults: true,
          subErsLow: false,
          subEngineTemp: false,
          subBrakeTemp: false,
          subBrakeCold: false,
          subFuelDelta: false,
          subUndercut: true,
          subPitWindow: false,
          subRivalDefend: false,
          subRivalAttack: false,
          subQualyTraffic: false,
          subQualyInvalid: true,
          subQualyTime: false,
          subQualyElim: false,
          subSafetyCar: true,
          subRedFlag: true,
          subRain: true,
          subTrackLimits: false,
          subPenalties: true,
        };
      } else if (preset === RADIO_TRIGGER_PRESETS.COACHING) {
        partial = {
          triggerPreset: preset,
          tyreAlertsEnabled: true,
          thermalAlertsEnabled: true,
          damageAlertsEnabled: true,
          ersAlertsEnabled: true,
          brakesAlertsEnabled: true,
          fuelAlertsEnabled: true,
          rivalAlertsEnabled: true,
          pitWindowAlertsEnabled: true,
          trackAlertsEnabled: true,
          qualyAlertsEnabled: true,
          flagsPensAlertsEnabled: true,
          chatterCooldownSeconds: RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.TALKATIVE,
          subTyreWear: true,
          subTyrePuncture: true,
          subTyreThermal: true,
          subTyreCold: true,
          subDamageWing: true,
          subDamageFloor: true,
          subDamageEngine: true,
          subDamageFaults: true,
          subErsLow: true,
          subEngineTemp: true,
          subBrakeTemp: true,
          subBrakeCold: true,
          subFuelDelta: true,
          subUndercut: true,
          subPitWindow: true,
          subRivalDefend: true,
          subRivalAttack: true,
          subQualyTraffic: true,
          subQualyInvalid: true,
          subQualyTime: true,
          subQualyElim: true,
          subSafetyCar: true,
          subRedFlag: true,
          subRain: true,
          subTrackLimits: true,
          subPenalties: true,
        };
      } else if (preset === RADIO_TRIGGER_PRESETS.MINIMAL) {
        partial = {
          triggerPreset: preset,
          tyreAlertsEnabled: true,
          thermalAlertsEnabled: false,
          damageAlertsEnabled: true,
          ersAlertsEnabled: false,
          brakesAlertsEnabled: false,
          fuelAlertsEnabled: false,
          rivalAlertsEnabled: false,
          pitWindowAlertsEnabled: false,
          trackAlertsEnabled: false,
          qualyAlertsEnabled: false,
          flagsPensAlertsEnabled: true,
          chatterCooldownSeconds: RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.MINIMAL,
          subTyreWear: false,
          subTyrePuncture: true,
          subTyreThermal: false,
          subTyreCold: false,
          subDamageWing: true,
          subDamageFloor: false,
          subDamageEngine: false,
          subDamageFaults: true,
          subErsLow: false,
          subEngineTemp: false,
          subBrakeTemp: false,
          subBrakeCold: false,
          subFuelDelta: false,
          subUndercut: false,
          subPitWindow: false,
          subRivalDefend: false,
          subRivalAttack: false,
          subQualyTraffic: false,
          subQualyInvalid: false,
          subQualyTime: false,
          subQualyElim: false,
          subSafetyCar: true,
          subRedFlag: true,
          subRain: false,
          subTrackLimits: false,
          subPenalties: true,
        };
      }
      set((state) => {
        const nextState = { ...state, ...partial };
        return {
          ...nextState,
          aiConfig: buildAIConfigFromValues(nextState as any),
        };
      });
      get().syncConfigToBackend();
    },

    resetTriggerDefaults: () => {
      get().applyTriggerPreset(RADIO_TRIGGER_PRESETS.IMMERSIVE);
      const resetThresholds = {
        tyreWearWarningPct: 40,
        tyreWearCriticalPct: 75,
        tyreOverheatC: 115,
        tyreColdC: 80,
        wingDamageWarnPct: 20,
        floorDamageWarnPct: 25,
        engineWearWarnPct: 70,
        ersLowPct: 15,
        engineOverheatC: 125,
        brakeOverheatC: 1000,
        brakeColdC: 200,
        fuelDeltaLaps: -0.5,
        undercutGapSec: 3.0,
        rivalGapThresholdSec: 1.0,
        rivalAheadGapSec: 1.2,
        qualyCleanAirSec: 4.0,
        cornerCutWarnThreshold: 2,
        rainHorizonMin: 10,
        rainProbPct: 50,
      };
      set((state) => {
        const nextState = { ...state, ...resetThresholds };
        return {
          ...nextState,
          aiConfig: buildAIConfigFromValues(nextState as any),
        };
      });
      get().syncConfigToBackend();
    },

    setTyreAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_TYRE, 'tyreAlertsEnabled'),
    setThermalAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_THERMAL, 'thermalAlertsEnabled'),
    setDamageAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_DAMAGE, 'damageAlertsEnabled'),
    setErsAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_ERS, 'ersAlertsEnabled'),
    setBrakesAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_BRAKES, 'brakesAlertsEnabled'),
    setFuelAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_FUEL, 'fuelAlertsEnabled'),
    setRivalAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_RIVAL, 'rivalAlertsEnabled'),
    setPitWindowAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_PIT_WINDOW, 'pitWindowAlertsEnabled'),
    setTrackAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_TRACK, 'trackAlertsEnabled'),
    setQualyAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_QUALY, 'qualyAlertsEnabled'),
    setFlagsPensAlertsEnabled: createBoolAction(RADIO_STORAGE_KEYS.ALERTS_FLAGS_PENS, 'flagsPensAlertsEnabled'),

    setSubTyreWear: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_WEAR, 'subTyreWear', true),
    setSubTyrePuncture: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_PUNCTURE, 'subTyrePuncture', true),
    setSubTyreThermal: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_THERMAL, 'subTyreThermal', true),
    setSubTyreCold: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_COLD, 'subTyreCold', true),
    setSubDamageWing: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_WING, 'subDamageWing', true),
    setSubDamageFloor: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FLOOR, 'subDamageFloor', true),
    setSubDamageEngine: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_ENGINE, 'subDamageEngine', true),
    setSubDamageFaults: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FAULTS, 'subDamageFaults', true),
    setSubErsLow: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_ERS_LOW, 'subErsLow', true),
    setSubEngineTemp: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_ENGINE_TEMP, 'subEngineTemp', true),
    setSubBrakeTemp: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_TEMP, 'subBrakeTemp', true),
    setSubBrakeCold: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_COLD, 'subBrakeCold', true),
    setSubFuelDelta: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_FUEL_DELTA, 'subFuelDelta', true),
    setSubUndercut: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_UNDERCUT, 'subUndercut', true),
    setSubPitWindow: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_PIT_WINDOW, 'subPitWindow', true),
    setSubRivalDefend: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_DEFEND, 'subRivalDefend', true),
    setSubRivalAttack: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_ATTACK, 'subRivalAttack', true),
    setSubQualyTraffic: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TRAFFIC, 'subQualyTraffic', true),
    setSubQualyInvalid: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_INVALID, 'subQualyInvalid', true),
    setSubQualyTime: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TIME, 'subQualyTime', true),
    setSubQualyElim: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_ELIM, 'subQualyElim', true),
    setSubSafetyCar: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_SAFETY_CAR, 'subSafetyCar', true),
    setSubRedFlag: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_RED_FLAG, 'subRedFlag', true),
    setSubRain: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_RAIN, 'subRain', true),
    setSubTrackLimits: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_TRACK_LIMITS, 'subTrackLimits', true),
    setSubPenalties: createBoolAction(RADIO_STORAGE_KEYS.SUB_ALERT_PENALTIES, 'subPenalties', true),

    setTyreWearWarningPct: createNumAction(RADIO_STORAGE_KEYS.TYRE_WEAR_WARN_PCT, 'tyreWearWarningPct', 20, 80, true),
    setTyreWearCriticalPct: createNumAction(RADIO_STORAGE_KEYS.TYRE_WEAR_CRIT_PCT, 'tyreWearCriticalPct', 50, 95, true),
    setTyreOverheatC: createNumAction(RADIO_STORAGE_KEYS.TYRE_OVERHEAT_C, 'tyreOverheatC', 90, 140, true),
    setTyreColdC: createNumAction(RADIO_STORAGE_KEYS.TYRE_COLD_C, 'tyreColdC', 50, 100, true),
    setWingDamageWarnPct: createNumAction(RADIO_STORAGE_KEYS.WING_DAMAGE_WARN_PCT, 'wingDamageWarnPct', 5, 50, true),
    setFloorDamageWarnPct: createNumAction(RADIO_STORAGE_KEYS.FLOOR_DAMAGE_WARN_PCT, 'floorDamageWarnPct', 10, 60, true),
    setEngineWearWarnPct: createNumAction(RADIO_STORAGE_KEYS.ENGINE_WEAR_WARN_PCT, 'engineWearWarnPct', 40, 90, true),
    setErsLowPct: createNumAction(RADIO_STORAGE_KEYS.ERS_LOW_PCT, 'ersLowPct', 5, 40, true),
    setEngineOverheatC: createNumAction(RADIO_STORAGE_KEYS.ENGINE_OVERHEAT_C, 'engineOverheatC', 105, 145, true),
    setBrakeOverheatC: createNumAction(RADIO_STORAGE_KEYS.BRAKE_OVERHEAT_C, 'brakeOverheatC', 600, 1200, true),
    setBrakeColdC: createNumAction(RADIO_STORAGE_KEYS.BRAKE_COLD_C, 'brakeColdC', 50, 400, true),
    setFuelDeltaLaps: createNumAction(RADIO_STORAGE_KEYS.FUEL_DELTA_LAPS, 'fuelDeltaLaps', -3.0, 0.0, true),
    setUndercutGapSec: createNumAction(RADIO_STORAGE_KEYS.UNDERCUT_GAP_SEC, 'undercutGapSec', 1.0, 5.0, true),
    setRivalGapThresholdSec: createNumAction(RADIO_STORAGE_KEYS.RIVAL_GAP_THRESHOLD_SEC, 'rivalGapThresholdSec', 0.5, 3.0, true),
    setRivalAheadGapSec: createNumAction(RADIO_STORAGE_KEYS.RIVAL_AHEAD_GAP_SEC, 'rivalAheadGapSec', 0.5, 3.0, true),
    setQualyCleanAirSec: createNumAction(RADIO_STORAGE_KEYS.QUALY_CLEAN_AIR_SEC, 'qualyCleanAirSec', 1.5, 7.0, true),
    setCornerCutWarnThreshold: createNumAction(RADIO_STORAGE_KEYS.CORNER_CUT_WARN_THRESHOLD, 'cornerCutWarnThreshold', 1, 3, true),
    setRainHorizonMin: createNumAction(RADIO_STORAGE_KEYS.RAIN_HORIZON_MIN, 'rainHorizonMin', 5, 30, true),
    setRainProbPct: createNumAction(RADIO_STORAGE_KEYS.RAIN_PROB_PCT, 'rainProbPct', 20, 80, true),

    syncConfigToBackend: async () => {
      try {
        await api.post('/api/ai/engineer/config', get().aiConfig);
      } catch {
        // ignore network error
      }
    },
  };
});
