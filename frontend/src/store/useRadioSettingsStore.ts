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

  resetStoreToDefaults: () => void;
  syncConfigToBackend: () => Promise<void>;
}

export function getInitialRadioSettings() {
  return {
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
}

export const useRadioSettingsStore = create<RadioSettingsState>((set, get) => {
  const markCustomPreset = () => {
    saveStorage(RADIO_STORAGE_KEYS.TRIGGER_PRESET, RADIO_TRIGGER_PRESETS.CUSTOM);
    set({ triggerPreset: RADIO_TRIGGER_PRESETS.CUSTOM });
    get().syncConfigToBackend();
  };

  const createBoolAction = (key: string, field: keyof RadioSettingsState, triggersCustom = false) => (val: boolean) => {
    saveStorage(key, val);
    set({ [field]: val } as unknown as Partial<RadioSettingsState>);
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
    set({ [field]: clamped } as unknown as Partial<RadioSettingsState>);
    if (triggersCustom) {
      markCustomPreset();
    } else {
      get().syncConfigToBackend();
    }
  };

  return {
    ...getInitialRadioSettings(),
    resetStoreToDefaults: () => set(getInitialRadioSettings()),

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
      set({ smartDiscretionEnabled: val });
      get().syncConfigToBackend();
    },
    setChatterCooldownSeconds: (sec) => {
      saveStorage(RADIO_STORAGE_KEYS.CHATTER_COOLDOWN_SEC, sec);
      set({ chatterCooldownSeconds: sec });
      get().syncConfigToBackend();
    },

    applyTriggerPreset: (preset) => {
      saveStorage(RADIO_STORAGE_KEYS.TRIGGER_PRESET, preset);
      if (preset === RADIO_TRIGGER_PRESETS.IMMERSIVE) {
        set({
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
        });
      } else if (preset === RADIO_TRIGGER_PRESETS.COACHING) {
        set({
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
        });
      } else if (preset === RADIO_TRIGGER_PRESETS.MINIMAL) {
        set({
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
        });
      }
      get().syncConfigToBackend();
    },

    resetTriggerDefaults: () => {
      get().applyTriggerPreset(RADIO_TRIGGER_PRESETS.IMMERSIVE);
      set({
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
      const state = get();
      try {
        const payload = {
          chatter_cooldown_ms: state.chatterCooldownSeconds * 1000,
          smart_discretion_enabled: state.smartDiscretionEnabled,
          tyre_wear_warn_pct: state.tyreWearWarningPct,
          tyre_wear_crit_pct: state.tyreWearCriticalPct,
          tyre_overheat_c: state.tyreOverheatC,
          tyre_cold_c: state.tyreColdC,
          wing_damage_warn_pct: state.wingDamageWarnPct,
          wing_damage_crit_pct: 40.0,
          floor_damage_warn_pct: state.floorDamageWarnPct,
          engine_wear_warn_pct: state.engineWearWarnPct,
          ers_low_pct: state.ersLowPct,
          engine_overheat_c: state.engineOverheatC,
          brake_overheat_c: state.brakeOverheatC,
          brake_cold_c: state.brakeColdC,
          fuel_delta_laps: state.fuelDeltaLaps,
          undercut_gap_sec: state.undercutGapSec,
          rival_gap_sec: state.rivalGapThresholdSec,
          rival_ahead_gap_sec: state.rivalAheadGapSec,
          qualy_clean_air_sec: state.qualyCleanAirSec,
          qualy_time_warn_sec: 180.0,
          corner_cut_warn_threshold: state.cornerCutWarnThreshold,
          rain_horizon_min: state.rainHorizonMin,
          rain_prob_pct: state.rainProbPct,
          enabled_categories: {
            tyre_wear: state.tyreAlertsEnabled && state.subTyreWear,
            tyre_puncture: state.tyreAlertsEnabled && state.subTyrePuncture,
            tyre_thermal: state.thermalAlertsEnabled && state.subTyreThermal,
            tyre_cold: state.thermalAlertsEnabled && state.subTyreCold,
            wing_damage: state.damageAlertsEnabled && state.subDamageWing,
            floor_damage: state.damageAlertsEnabled && state.subDamageFloor,
            engine_wear: state.damageAlertsEnabled && state.subDamageEngine,
            mechanical_fault: state.damageAlertsEnabled && state.subDamageFaults,
            ers_low: state.ersAlertsEnabled && state.subErsLow,
            engine_temp: state.damageAlertsEnabled && state.subEngineTemp,
            brake_hot: state.brakesAlertsEnabled && state.subBrakeTemp,
            brake_cold: state.brakesAlertsEnabled && state.subBrakeCold,
            fuel_delta: state.fuelAlertsEnabled && state.subFuelDelta,
            undercut: state.rivalAlertsEnabled && state.subUndercut,
            pit_window: state.pitWindowAlertsEnabled && state.subPitWindow,
            rival_defend: state.rivalAlertsEnabled && state.subRivalDefend,
            rival_attack: state.rivalAlertsEnabled && state.subRivalAttack,
            qualy_invalid: state.qualyAlertsEnabled && state.subQualyInvalid,
            qualy_traffic: state.qualyAlertsEnabled && state.subQualyTraffic,
            qualy_time: state.qualyAlertsEnabled && state.subQualyTime,
            qualy_elim: state.qualyAlertsEnabled && state.subQualyElim,
            flags_sc: state.flagsPensAlertsEnabled && state.subSafetyCar,
            flags_red: state.flagsPensAlertsEnabled && state.subRedFlag,
            flags_rain: state.flagsPensAlertsEnabled && state.subRain,
            track_limits: state.flagsPensAlertsEnabled && state.subTrackLimits,
            penalties: state.flagsPensAlertsEnabled && state.subPenalties,
          },
        };
        await fetch('/api/ai/engineer/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // ignore network error
      }
    },
  };
});
