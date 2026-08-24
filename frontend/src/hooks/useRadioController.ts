import { useState, useRef, useCallback } from 'react';
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
import {
  playRadioBeep,
  speakRadioResponse,
  stopRadioSpeech,
  getSpeechRecognitionClass,
  type ISpeechRecognition,
} from '../utils/radioAudio';
import { useGamepadPTT, type GamepadMapping } from './useGamepadPTT';
import { useI18n } from '../context/I18nContext';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';

export type RadioState = 'idle' | 'transmitting' | 'processing' | 'speaking';

export interface UseRadioControllerOptions {
  telemetryContext?: TelemetryContextPayload | null;
  getLiveTelemetrySummary?: () => string;
  onTranscriptReceived?: (transcript: string) => void;
  onResponseReceived?: (response: string) => void;
}

export interface UseRadioControllerReturn {
  radioState: RadioState;
  isRadioEnabled: boolean;
  setIsRadioEnabled: (enabled: boolean) => void;
  persona: RadioPersona;
  setPersona: (p: RadioPersona) => void;
  radioLanguage: RadioLanguage;
  setRadioLanguage: (lang: RadioLanguage) => void;
  effectiveLanguage: 'es' | 'en';
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  driverCallsign: string;
  setDriverCallsign: (callsign: string) => void;
  beepsEnabled: boolean;
  setBeepsEnabled: (enabled: boolean) => void;
  filterEnabled: boolean;
  setFilterEnabled: (enabled: boolean) => void;
  staticFxEnabled: boolean;
  setStaticFxEnabled: (enabled: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  speechPitch: number;
  setSpeechPitch: (pitch: number) => void;
  neuralVoice: string;
  setNeuralVoice: (v: string) => void;

  // Trigger & Discretion settings
  smartDiscretionEnabled: boolean;
  setSmartDiscretionEnabled: (enabled: boolean) => void;
  chatterCooldownSeconds: number;
  setChatterCooldownSeconds: (sec: number) => void;
  triggerPreset: RadioTriggerPreset;
  applyTriggerPreset: (preset: RadioTriggerPreset) => void;
  resetTriggerDefaults: () => void;

  // Subsystem master switches
  tyreAlertsEnabled: boolean;
  setTyreAlertsEnabled: (enabled: boolean) => void;
  thermalAlertsEnabled: boolean;
  setThermalAlertsEnabled: (enabled: boolean) => void;
  damageAlertsEnabled: boolean;
  setDamageAlertsEnabled: (enabled: boolean) => void;
  ersAlertsEnabled: boolean;
  setErsAlertsEnabled: (enabled: boolean) => void;
  brakesAlertsEnabled: boolean;
  setBrakesAlertsEnabled: (enabled: boolean) => void;
  fuelAlertsEnabled: boolean;
  setFuelAlertsEnabled: (enabled: boolean) => void;
  rivalAlertsEnabled: boolean;
  setRivalAlertsEnabled: (enabled: boolean) => void;
  pitWindowAlertsEnabled: boolean;
  setPitWindowAlertsEnabled: (enabled: boolean) => void;
  trackAlertsEnabled: boolean;
  setTrackAlertsEnabled: (enabled: boolean) => void;
  qualyAlertsEnabled: boolean;
  setQualyAlertsEnabled: (enabled: boolean) => void;
  flagsPensAlertsEnabled: boolean;
  setFlagsPensAlertsEnabled: (enabled: boolean) => void;

  // Sub-alert individual toggles
  subTyreWear: boolean;
  setSubTyreWear: (enabled: boolean) => void;
  subTyrePuncture: boolean;
  setSubTyrePuncture: (enabled: boolean) => void;
  subTyreThermal: boolean;
  setSubTyreThermal: (enabled: boolean) => void;
  subTyreCold: boolean;
  setSubTyreCold: (enabled: boolean) => void;
  subDamageWing: boolean;
  setSubDamageWing: (enabled: boolean) => void;
  subDamageFloor: boolean;
  setSubDamageFloor: (enabled: boolean) => void;
  subDamageEngine: boolean;
  setSubDamageEngine: (enabled: boolean) => void;
  subDamageFaults: boolean;
  setSubDamageFaults: (enabled: boolean) => void;
  subErsLow: boolean;
  setSubErsLow: (enabled: boolean) => void;
  subEngineTemp: boolean;
  setSubEngineTemp: (enabled: boolean) => void;
  subBrakeTemp: boolean;
  setSubBrakeTemp: (enabled: boolean) => void;
  subBrakeCold: boolean;
  setSubBrakeCold: (enabled: boolean) => void;
  subFuelDelta: boolean;
  setSubFuelDelta: (enabled: boolean) => void;
  subUndercut: boolean;
  setSubUndercut: (enabled: boolean) => void;
  subPitWindow: boolean;
  setSubPitWindow: (enabled: boolean) => void;
  subRivalDefend: boolean;
  setSubRivalDefend: (enabled: boolean) => void;
  subRivalAttack: boolean;
  setSubRivalAttack: (enabled: boolean) => void;
  subQualyTraffic: boolean;
  setSubQualyTraffic: (enabled: boolean) => void;
  subQualyInvalid: boolean;
  setSubQualyInvalid: (enabled: boolean) => void;
  subQualyTime: boolean;
  setSubQualyTime: (enabled: boolean) => void;
  subQualyElim: boolean;
  setSubQualyElim: (enabled: boolean) => void;
  subSafetyCar: boolean;
  setSubSafetyCar: (enabled: boolean) => void;
  subRedFlag: boolean;
  setSubRedFlag: (enabled: boolean) => void;
  subRain: boolean;
  setSubRain: (enabled: boolean) => void;
  subTrackLimits: boolean;
  setSubTrackLimits: (enabled: boolean) => void;
  subPenalties: boolean;
  setSubPenalties: (enabled: boolean) => void;

  // Granular thresholds
  tyreWearWarningPct: number;
  setTyreWearWarningPct: (pct: number) => void;
  tyreWearCriticalPct: number;
  setTyreWearCriticalPct: (pct: number) => void;
  tyreOverheatC: number;
  setTyreOverheatC: (temp: number) => void;
  tyreColdC: number;
  setTyreColdC: (temp: number) => void;
  wingDamageWarnPct: number;
  setWingDamageWarnPct: (pct: number) => void;
  floorDamageWarnPct: number;
  setFloorDamageWarnPct: (pct: number) => void;
  engineWearWarnPct: number;
  setEngineWearWarnPct: (pct: number) => void;
  ersLowPct: number;
  setErsLowPct: (pct: number) => void;
  engineOverheatC: number;
  setEngineOverheatC: (temp: number) => void;
  brakeOverheatC: number;
  setBrakeOverheatC: (temp: number) => void;
  brakeColdC: number;
  setBrakeColdC: (temp: number) => void;
  fuelDeltaLaps: number;
  setFuelDeltaLaps: (laps: number) => void;
  undercutGapSec: number;
  setUndercutGapSec: (sec: number) => void;
  rivalGapThresholdSec: number;
  setRivalGapThresholdSec: (sec: number) => void;
  rivalAheadGapSec: number;
  setRivalAheadGapSec: (sec: number) => void;
  qualyCleanAirSec: number;
  setQualyCleanAirSec: (sec: number) => void;
  cornerCutWarnThreshold: number;
  setCornerCutWarnThreshold: (count: number) => void;
  rainHorizonMin: number;
  setRainHorizonMin: (min: number) => void;
  rainProbPct: number;
  setRainProbPct: (pct: number) => void;

  lastTranscript: string | null;
  lastResponse: string | null;
  error: string | null;

  // PTT props passed through from useGamepadPTT
  isPTTActive: boolean;
  isLearning: boolean;
  startLearning: () => void;
  cancelLearning: () => void;
  mappedGamepadButton: GamepadMapping | null;
  setMappedGamepadButton: (mapping: GamepadMapping | null) => void;
  mappedKey: string;
  setMappedKey: (key: string) => void;
  gamepadConnected: boolean;
  gamepadName: string | null;

  // Actions
  testRadioTransmission: () => Promise<void>;
  testTriggerAlert: (triggerType: string) => Promise<void>;
  stopRadio: () => void;
  speakMessage: (text: string, forceInterrupt?: boolean) => Promise<void>;
}

export function useRadioController(options: UseRadioControllerOptions = {}): UseRadioControllerReturn {
  const { telemetryContext, getLiveTelemetrySummary, onTranscriptReceived, onResponseReceived } = options;
  const { locale: uiLocale } = useI18n();

  const [radioState, setRadioState] = useState<RadioState>('idle');
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings from localStorage
  const [isRadioEnabled, setIsRadioEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_ENABLED);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [persona, setPersonaState] = useState<RadioPersona>(() => {
    if (typeof window === 'undefined') return RADIO_PERSONAS.COLAPINTO;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.PERSONA) as RadioPersona;
      if (saved && Object.values(RADIO_PERSONAS).includes(saved)) return saved;
      return RADIO_PERSONAS.COLAPINTO;
    } catch {
      return RADIO_PERSONAS.COLAPINTO;
    }
  });

  const [radioLanguage, setRadioLanguageState] = useState<RadioLanguage>(() => {
    if (typeof window === 'undefined') return RADIO_LANGUAGES.AUTO;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.LANGUAGE) as RadioLanguage;
      if (saved && Object.values(RADIO_LANGUAGES).includes(saved)) return saved;
      return RADIO_LANGUAGES.AUTO;
    } catch {
      return RADIO_LANGUAGES.AUTO;
    }
  });

  const [customPrompt, setCustomPromptState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(RADIO_STORAGE_KEYS.CUSTOM_PROMPT) || '';
    } catch {
      return '';
    }
  });

  const [driverCallsign, setDriverCallsignState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(RADIO_STORAGE_KEYS.DRIVER_CALLSIGN) || '';
    } catch {
      return '';
    }
  });

  const [beepsEnabled, setBeepsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.BEEPS_ENABLED);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [filterEnabled, setFilterEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.FILTER_ENABLED);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [staticFxEnabled, setStaticFxEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.STATIC_FX_ENABLED);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window === 'undefined') return RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.VOLUME);
      return saved !== null ? parseFloat(saved) : RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME;
    } catch {
      return RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME;
    }
  });

  const [speechRate, setSpeechRateState] = useState<number>(() => {
    if (typeof window === 'undefined') return RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_RATE_PERCENT;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.SPEECH_RATE);
      return saved !== null ? parseInt(saved, 10) || 0 : RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_RATE_PERCENT;
    } catch {
      return RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_RATE_PERCENT;
    }
  });

  const [speechPitch, setSpeechPitchState] = useState<number>(() => {
    if (typeof window === 'undefined') return RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_PITCH_HZ;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.SPEECH_PITCH);
      return saved !== null ? parseInt(saved, 10) || 0 : RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_PITCH_HZ;
    } catch {
      return RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_PITCH_HZ;
    }
  });

  const [neuralVoice, setNeuralVoiceState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(RADIO_STORAGE_KEYS.NEURAL_VOICE) || '';
    } catch {
      return '';
    }
  });

  // Trigger & Discretion settings from localStorage
  const [smartDiscretionEnabled, setSmartDiscretionEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.SMART_DISCRETION_ENABLED);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [chatterCooldownSeconds, setChatterCooldownSecondsState] = useState<number>(() => {
    if (typeof window === 'undefined') return RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.CHATTER_COOLDOWN_SEC);
      return saved !== null ? parseInt(saved, 10) || 45 : 45;
    } catch {
      return 45;
    }
  });

  const [tyreWearWarningPct, setTyreWearWarningPctState] = useState<number>(() => {
    if (typeof window === 'undefined') return RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_WARN_PCT;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.TYRE_WEAR_WARN_PCT);
      return saved !== null ? parseInt(saved, 10) || 40 : 40;
    } catch {
      return 40;
    }
  });

  const [tyreWearCriticalPct, setTyreWearCriticalPctState] = useState<number>(() => {
    if (typeof window === 'undefined') return RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_CRIT_PCT;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.TYRE_WEAR_CRIT_PCT);
      return saved !== null ? parseInt(saved, 10) || 75 : 75;
    } catch {
      return 75;
    }
  });

  const [rivalGapThresholdSec, setRivalGapThresholdSecState] = useState<number>(() => {
    if (typeof window === 'undefined') return RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_GAP_SEC;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.RIVAL_GAP_THRESHOLD_SEC);
      return saved !== null ? parseFloat(saved) || 1.0 : 1.0;
    } catch {
      return 1.0;
    }
  });

  const [rainHorizonMin, setRainHorizonMinState] = useState<number>(() => {
    if (typeof window === 'undefined') return RADIO_ALERT_CONSTANTS.DEFAULT_RAIN_HORIZON_MIN;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.RAIN_HORIZON_MIN);
      return saved !== null ? parseInt(saved, 10) || 5 : 5;
    } catch {
      return 5;
    }
  });

  // Subsystem master switches
  const [damageAlertsEnabled, setDamageAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_DAMAGE);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [ersAlertsEnabled, setErsAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_ERS);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [brakesAlertsEnabled, setBrakesAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_BRAKES);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [fuelAlertsEnabled, setFuelAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_FUEL);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [qualyAlertsEnabled, setQualyAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_QUALY);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [flagsPensAlertsEnabled, setFlagsPensAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_FLAGS_PENS);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  // Preset state
  const [triggerPreset, setTriggerPresetState] = useState<RadioTriggerPreset>(() => {
    if (typeof window === 'undefined') return RADIO_TRIGGER_PRESETS.IMMERSIVE;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.TRIGGER_PRESET) as RadioTriggerPreset;
      if (saved && Object.values(RADIO_TRIGGER_PRESETS).includes(saved)) return saved;
      return RADIO_TRIGGER_PRESETS.IMMERSIVE;
    } catch {
      return RADIO_TRIGGER_PRESETS.IMMERSIVE;
    }
  });

  // Sub-alert individual toggles
  const initSub = (key: string, def = true): boolean => {
    if (typeof window === 'undefined') return def;
    try {
      const v = localStorage.getItem(key);
      return v !== null ? v === 'true' : def;
    } catch {
      return def;
    }
  };

  const [subTyreWear, setSubTyreWearState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_WEAR));
  const [subTyrePuncture, setSubTyrePunctureState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_PUNCTURE));
  const [subTyreThermal, setSubTyreThermalState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_THERMAL));
  const [subTyreCold, setSubTyreColdState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_COLD));
  const [subDamageWing, setSubDamageWingState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_WING));
  const [subDamageFloor, setSubDamageFloorState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FLOOR));
  const [subDamageEngine, setSubDamageEngineState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_ENGINE));
  const [subDamageFaults, setSubDamageFaultsState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FAULTS));
  const [subErsLow, setSubErsLowState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_ERS_LOW));
  const [subEngineTemp, setSubEngineTempState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_ENGINE_TEMP));
  const [subBrakeTemp, setSubBrakeTempState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_TEMP));
  const [subBrakeCold, setSubBrakeColdState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_COLD));
  const [subFuelDelta, setSubFuelDeltaState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_FUEL_DELTA));
  const [subUndercut, setSubUndercutState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_UNDERCUT));
  const [subPitWindow, setSubPitWindowState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_PIT_WINDOW));
  const [subRivalDefend, setSubRivalDefendState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_DEFEND));
  const [subRivalAttack, setSubRivalAttackState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_ATTACK));
  const [subQualyTraffic, setSubQualyTrafficState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TRAFFIC));
  const [subQualyInvalid, setSubQualyInvalidState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_INVALID));
  const [subQualyTime, setSubQualyTimeState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TIME));
  const [subQualyElim, setSubQualyElimState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_ELIM));
  const [subSafetyCar, setSubSafetyCarState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_SAFETY_CAR));
  const [subRedFlag, setSubRedFlagState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_RED_FLAG));
  const [subRain, setSubRainState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_RAIN));
  const [subTrackLimits, setSubTrackLimitsState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_TRACK_LIMITS));
  const [subPenalties, setSubPenaltiesState] = useState<boolean>(() => initSub(RADIO_STORAGE_KEYS.SUB_ALERT_PENALTIES));

  // Granular thresholds
  const initNum = (key: string, def: number): number => {
    if (typeof window === 'undefined') return def;
    try {
      const v = localStorage.getItem(key);
      if (!v) return def;
      const parsed = parseFloat(v);
      return isNaN(parsed) ? def : parsed;
    } catch {
      return def;
    }
  };

  const [tyreOverheatC, setTyreOverheatCState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.TYRE_OVERHEAT_C, RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_OVERHEAT_C));
  const [tyreColdC, setTyreColdCState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.TYRE_COLD_C, RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_COLD_C));
  const [wingDamageWarnPct, setWingDamageWarnPctState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.WING_DAMAGE_WARN_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_WING_DAMAGE_WARN_PCT));
  const [floorDamageWarnPct, setFloorDamageWarnPctState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.FLOOR_DAMAGE_WARN_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_FLOOR_DAMAGE_WARN_PCT));
  const [engineWearWarnPct, setEngineWearWarnPctState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.ENGINE_WEAR_WARN_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_ENGINE_WEAR_WARN_PCT));
  const [ersLowPct, setErsLowPctState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.ERS_LOW_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_ERS_LOW_PCT));
  const [engineOverheatC, setEngineOverheatCState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.ENGINE_OVERHEAT_C, RADIO_ALERT_CONSTANTS.DEFAULT_ENGINE_OVERHEAT_C));
  const [brakeOverheatC, setBrakeOverheatCState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.BRAKE_OVERHEAT_C, RADIO_ALERT_CONSTANTS.DEFAULT_BRAKE_OVERHEAT_C));
  const [brakeColdC, setBrakeColdCState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.BRAKE_COLD_C, RADIO_ALERT_CONSTANTS.DEFAULT_BRAKE_COLD_C));
  const [fuelDeltaLaps, setFuelDeltaLapsState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.FUEL_DELTA_LAPS, RADIO_ALERT_CONSTANTS.DEFAULT_FUEL_DELTA_LAPS));
  const [undercutGapSec, setUndercutGapSecState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.UNDERCUT_GAP_SEC, RADIO_ALERT_CONSTANTS.DEFAULT_UNDERCUT_GAP_SEC));
  const [rivalAheadGapSec, setRivalAheadGapSecState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.RIVAL_AHEAD_GAP_SEC, RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_AHEAD_GAP_SEC));
  const [qualyCleanAirSec, setQualyCleanAirSecState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.QUALY_CLEAN_AIR_SEC, RADIO_ALERT_CONSTANTS.DEFAULT_QUALY_CLEAN_AIR_SEC));
  const [cornerCutWarnThreshold, setCornerCutWarnThresholdState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.CORNER_CUT_WARN_THRESHOLD, RADIO_ALERT_CONSTANTS.DEFAULT_CORNER_CUT_WARN_THRESHOLD));
  const [rainProbPct, setRainProbPctState] = useState<number>(() => initNum(RADIO_STORAGE_KEYS.RAIN_PROB_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_RAIN_PROB_PCT));

  // Alert Category toggles
  const [tyreAlertsEnabled, setTyreAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_TYRE);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [thermalAlertsEnabled, setThermalAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_THERMAL);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [rivalAlertsEnabled, setRivalAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_RIVAL);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [pitWindowAlertsEnabled, setPitWindowAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_PIT_WINDOW);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const [trackAlertsEnabled, setTrackAlertsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_TRACK);
      return v !== null ? v === 'true' : true;
    } catch {
      return true;
    }
  });

  const setIsRadioEnabled = useCallback((enabled: boolean) => {
    setIsRadioEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_ENABLED, String(enabled));
    } catch {}
  }, []);

  const setPersona = useCallback((p: RadioPersona) => {
    setPersonaState(p);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.PERSONA, p);
    } catch {}
  }, []);

  const setRadioLanguage = useCallback((lang: RadioLanguage) => {
    setRadioLanguageState(lang);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.LANGUAGE, lang);
    } catch {}

    // Reset neural voice if it belongs to a mismatched language family
    const nextEffectiveLang: 'es' | 'en' =
      lang === RADIO_LANGUAGES.AUTO
        ? (uiLocale === 'es' ? 'es' : 'en')
        : (lang === RADIO_LANGUAGES.ES ? 'es' : 'en');

    setNeuralVoiceState((currentVoice) => {
      if (
        (nextEffectiveLang === 'es' && currentVoice.startsWith('en-')) ||
        (nextEffectiveLang === 'en' && currentVoice.startsWith('es-'))
      ) {
        try {
          localStorage.removeItem(RADIO_STORAGE_KEYS.NEURAL_VOICE);
        } catch {}
        return '';
      }
      return currentVoice;
    });
  }, [uiLocale]);

  const setCustomPrompt = useCallback((prompt: string) => {
    setCustomPromptState(prompt);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.CUSTOM_PROMPT, prompt);
    } catch {}
  }, []);

  const setDriverCallsign = useCallback((callsign: string) => {
    setDriverCallsignState(callsign);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.DRIVER_CALLSIGN, callsign);
    } catch {}
  }, []);

  const setBeepsEnabled = useCallback((enabled: boolean) => {
    setBeepsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.BEEPS_ENABLED, String(enabled));
    } catch {}
  }, []);

  const setFilterEnabled = useCallback((enabled: boolean) => {
    setFilterEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.FILTER_ENABLED, String(enabled));
    } catch {}
  }, []);

  const setStaticFxEnabled = useCallback((enabled: boolean) => {
    setStaticFxEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.STATIC_FX_ENABLED, String(enabled));
    } catch {}
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.VOLUME, String(clamped));
    } catch {}
  }, []);

  const setSpeechRate = useCallback((rate: number) => {
    const clamped = Math.max(-20, Math.min(30, rate));
    setSpeechRateState(clamped);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.SPEECH_RATE, String(clamped));
    } catch {}
  }, []);

  const setSpeechPitch = useCallback((pitch: number) => {
    const clamped = Math.max(-20, Math.min(20, pitch));
    setSpeechPitchState(clamped);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.SPEECH_PITCH, String(clamped));
    } catch {}
  }, []);

  const setNeuralVoice = useCallback((v: string) => {
    setNeuralVoiceState(v);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.NEURAL_VOICE, v);
    } catch {}
  }, []);

  const setSmartDiscretionEnabled = useCallback((enabled: boolean) => {
    setSmartDiscretionEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.SMART_DISCRETION_ENABLED, String(enabled));
    } catch {}
  }, []);

  const setChatterCooldownSeconds = useCallback((sec: number) => {
    const clamped = Math.max(10, Math.min(180, sec));
    setChatterCooldownSecondsState(clamped);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.CHATTER_COOLDOWN_SEC, String(clamped));
    } catch {}
  }, []);

  const setTyreWearWarningPct = useCallback((pct: number) => {
    const clamped = Math.max(10, Math.min(60, pct));
    setTyreWearWarningPctState(clamped);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.TYRE_WEAR_WARN_PCT, String(clamped));
    } catch {}
  }, []);

  const setTyreWearCriticalPct = useCallback((pct: number) => {
    const clamped = Math.max(50, Math.min(90, pct));
    setTyreWearCriticalPctState(clamped);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.TYRE_WEAR_CRIT_PCT, String(clamped));
    } catch {}
  }, []);

  const setRivalGapThresholdSec = useCallback((sec: number) => {
    const clamped = Math.max(0.5, Math.min(3.0, sec));
    setRivalGapThresholdSecState(clamped);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.RIVAL_GAP_THRESHOLD_SEC, String(clamped));
    } catch {}
  }, []);

  const setRainHorizonMin = useCallback((min: number) => {
    const clamped = Math.max(1, Math.min(15, min));
    setRainHorizonMinState(clamped);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.RAIN_HORIZON_MIN, String(clamped));
    } catch {}
  }, []);

  // Subsystem setters
  const setTyreAlertsEnabled = useCallback((enabled: boolean) => {
    setTyreAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_TYRE, String(enabled));
    } catch {}
  }, []);

  const setThermalAlertsEnabled = useCallback((enabled: boolean) => {
    setThermalAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_THERMAL, String(enabled));
    } catch {}
  }, []);

  const setDamageAlertsEnabled = useCallback((enabled: boolean) => {
    setDamageAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_DAMAGE, String(enabled));
    } catch {}
  }, []);

  const setErsAlertsEnabled = useCallback((enabled: boolean) => {
    setErsAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_ERS, String(enabled));
    } catch {}
  }, []);

  const setBrakesAlertsEnabled = useCallback((enabled: boolean) => {
    setBrakesAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_BRAKES, String(enabled));
    } catch {}
  }, []);

  const setFuelAlertsEnabled = useCallback((enabled: boolean) => {
    setFuelAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_FUEL, String(enabled));
    } catch {}
  }, []);

  const setRivalAlertsEnabled = useCallback((enabled: boolean) => {
    setRivalAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_RIVAL, String(enabled));
    } catch {}
  }, []);

  const setPitWindowAlertsEnabled = useCallback((enabled: boolean) => {
    setPitWindowAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_PIT_WINDOW, String(enabled));
    } catch {}
  }, []);

  const setTrackAlertsEnabled = useCallback((enabled: boolean) => {
    setTrackAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_TRACK, String(enabled));
    } catch {}
  }, []);

  const setQualyAlertsEnabled = useCallback((enabled: boolean) => {
    setQualyAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_QUALY, String(enabled));
    } catch {}
  }, []);

  const setFlagsPensAlertsEnabled = useCallback((enabled: boolean) => {
    setFlagsPensAlertsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_FLAGS_PENS, String(enabled));
    } catch {}
  }, []);

  // Sub-toggle setters
  const createSubSetter = (key: string, setter: (v: boolean) => void) => (enabled: boolean) => {
    setter(enabled);
    try {
      localStorage.setItem(key, String(enabled));
    } catch {}
  };

  const setSubTyreWear = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_WEAR, setSubTyreWearState), []);
  const setSubTyrePuncture = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_PUNCTURE, setSubTyrePunctureState), []);
  const setSubTyreThermal = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_THERMAL, setSubTyreThermalState), []);
  const setSubTyreCold = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_COLD, setSubTyreColdState), []);
  const setSubDamageWing = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_WING, setSubDamageWingState), []);
  const setSubDamageFloor = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FLOOR, setSubDamageFloorState), []);
  const setSubDamageEngine = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_ENGINE, setSubDamageEngineState), []);
  const setSubDamageFaults = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FAULTS, setSubDamageFaultsState), []);
  const setSubErsLow = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_ERS_LOW, setSubErsLowState), []);
  const setSubEngineTemp = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_ENGINE_TEMP, setSubEngineTempState), []);
  const setSubBrakeTemp = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_TEMP, setSubBrakeTempState), []);
  const setSubBrakeCold = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_COLD, setSubBrakeColdState), []);
  const setSubFuelDelta = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_FUEL_DELTA, setSubFuelDeltaState), []);
  const setSubUndercut = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_UNDERCUT, setSubUndercutState), []);
  const setSubPitWindow = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_PIT_WINDOW, setSubPitWindowState), []);
  const setSubRivalDefend = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_DEFEND, setSubRivalDefendState), []);
  const setSubRivalAttack = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_ATTACK, setSubRivalAttackState), []);
  const setSubQualyTraffic = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TRAFFIC, setSubQualyTrafficState), []);
  const setSubQualyInvalid = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_INVALID, setSubQualyInvalidState), []);
  const setSubQualyTime = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TIME, setSubQualyTimeState), []);
  const setSubQualyElim = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_ELIM, setSubQualyElimState), []);
  const setSubSafetyCar = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_SAFETY_CAR, setSubSafetyCarState), []);
  const setSubRedFlag = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_RED_FLAG, setSubRedFlagState), []);
  const setSubRain = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_RAIN, setSubRainState), []);
  const setSubTrackLimits = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_TRACK_LIMITS, setSubTrackLimitsState), []);
  const setSubPenalties = useCallback(createSubSetter(RADIO_STORAGE_KEYS.SUB_ALERT_PENALTIES, setSubPenaltiesState), []);

  // Threshold setters
  const createNumSetter = (key: string, setter: (v: number) => void, min: number, max: number) => (val: number) => {
    const clamped = Math.max(min, Math.min(max, val));
    setter(clamped);
    try {
      localStorage.setItem(key, String(clamped));
    } catch {}
  };

  const setTyreOverheatC = useCallback(createNumSetter(RADIO_STORAGE_KEYS.TYRE_OVERHEAT_C, setTyreOverheatCState, 90, 140), []);
  const setTyreColdC = useCallback(createNumSetter(RADIO_STORAGE_KEYS.TYRE_COLD_C, setTyreColdCState, 60, 100), []);
  const setWingDamageWarnPct = useCallback(createNumSetter(RADIO_STORAGE_KEYS.WING_DAMAGE_WARN_PCT, setWingDamageWarnPctState, 5, 50), []);
  const setFloorDamageWarnPct = useCallback(createNumSetter(RADIO_STORAGE_KEYS.FLOOR_DAMAGE_WARN_PCT, setFloorDamageWarnPctState, 10, 50), []);
  const setEngineWearWarnPct = useCallback(createNumSetter(RADIO_STORAGE_KEYS.ENGINE_WEAR_WARN_PCT, setEngineWearWarnPctState, 40, 95), []);
  const setErsLowPct = useCallback(createNumSetter(RADIO_STORAGE_KEYS.ERS_LOW_PCT, setErsLowPctState, 5, 40), []);
  const setEngineOverheatC = useCallback(createNumSetter(RADIO_STORAGE_KEYS.ENGINE_OVERHEAT_C, setEngineOverheatCState, 100, 150), []);
  const setBrakeOverheatC = useCallback(createNumSetter(RADIO_STORAGE_KEYS.BRAKE_OVERHEAT_C, setBrakeOverheatCState, 600, 1200), []);
  const setBrakeColdC = useCallback(createNumSetter(RADIO_STORAGE_KEYS.BRAKE_COLD_C, setBrakeColdCState, 50, 400), []);
  const setFuelDeltaLaps = useCallback(createNumSetter(RADIO_STORAGE_KEYS.FUEL_DELTA_LAPS, setFuelDeltaLapsState, -3.0, 0.0), []);
  const setUndercutGapSec = useCallback(createNumSetter(RADIO_STORAGE_KEYS.UNDERCUT_GAP_SEC, setUndercutGapSecState, 1.0, 5.0), []);
  const setRivalAheadGapSec = useCallback(createNumSetter(RADIO_STORAGE_KEYS.RIVAL_AHEAD_GAP_SEC, setRivalAheadGapSecState, 0.5, 3.0), []);
  const setQualyCleanAirSec = useCallback(createNumSetter(RADIO_STORAGE_KEYS.QUALY_CLEAN_AIR_SEC, setQualyCleanAirSecState, 1.5, 7.0), []);
  const setCornerCutWarnThreshold = useCallback(createNumSetter(RADIO_STORAGE_KEYS.CORNER_CUT_WARN_THRESHOLD, setCornerCutWarnThresholdState, 1, 3), []);
  const setRainProbPct = useCallback(createNumSetter(RADIO_STORAGE_KEYS.RAIN_PROB_PCT, setRainProbPctState, 20, 80), []);

  // Presets applicator
  const applyTriggerPreset = useCallback((preset: RadioTriggerPreset) => {
    setTriggerPresetState(preset);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.TRIGGER_PRESET, preset);
    } catch {}

    if (preset === RADIO_TRIGGER_PRESETS.IMMERSIVE) {
      setTyreAlertsEnabled(true);
      setDamageAlertsEnabled(true);
      setErsAlertsEnabled(false);
      setBrakesAlertsEnabled(false);
      setFuelAlertsEnabled(true);
      setRivalAlertsEnabled(true);
      setQualyAlertsEnabled(true);
      setFlagsPensAlertsEnabled(true);
      setChatterCooldownSeconds(RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL);
      setSubTyreWear(true);
      setSubTyrePuncture(true);
      setSubTyreThermal(false);
      setSubTyreCold(false);
      setSubDamageWing(true);
      setSubDamageFaults(true);
      setSubUndercut(true);
      setSubSafetyCar(true);
      setSubRedFlag(true);
      setSubRain(true);
      setSubPenalties(true);
      setSubQualyInvalid(true);
    } else if (preset === RADIO_TRIGGER_PRESETS.COACHING) {
      setTyreAlertsEnabled(true);
      setDamageAlertsEnabled(true);
      setErsAlertsEnabled(true);
      setBrakesAlertsEnabled(true);
      setFuelAlertsEnabled(true);
      setRivalAlertsEnabled(true);
      setQualyAlertsEnabled(true);
      setFlagsPensAlertsEnabled(true);
      setChatterCooldownSeconds(RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.TALKATIVE);
      setSubTyreWear(true);
      setSubTyrePuncture(true);
      setSubTyreThermal(true);
      setSubTyreCold(true);
      setSubDamageWing(true);
      setSubDamageFloor(true);
      setSubDamageEngine(true);
      setSubDamageFaults(true);
      setSubErsLow(true);
      setSubEngineTemp(true);
      setSubBrakeTemp(true);
      setSubBrakeCold(true);
      setSubFuelDelta(true);
      setSubUndercut(true);
      setSubPitWindow(true);
      setSubRivalDefend(true);
      setSubRivalAttack(true);
      setSubQualyTraffic(true);
      setSubQualyInvalid(true);
      setSubQualyTime(true);
      setSubQualyElim(true);
      setSubSafetyCar(true);
      setSubRedFlag(true);
      setSubRain(true);
      setSubTrackLimits(true);
      setSubPenalties(true);
    } else if (preset === RADIO_TRIGGER_PRESETS.MINIMAL) {
      setTyreAlertsEnabled(true);
      setDamageAlertsEnabled(true);
      setErsAlertsEnabled(false);
      setBrakesAlertsEnabled(false);
      setFuelAlertsEnabled(false);
      setRivalAlertsEnabled(false);
      setQualyAlertsEnabled(false);
      setFlagsPensAlertsEnabled(true);
      setChatterCooldownSeconds(RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.MINIMAL);
      setSubTyreWear(false);
      setSubTyrePuncture(true);
      setSubTyreThermal(false);
      setSubTyreCold(false);
      setSubDamageWing(true);
      setSubDamageFloor(false);
      setSubDamageEngine(false);
      setSubDamageFaults(true);
      setSubSafetyCar(true);
      setSubRedFlag(true);
      setSubRain(false);
      setSubPenalties(true);
    }
  }, [
    setTyreAlertsEnabled,
    setDamageAlertsEnabled,
    setErsAlertsEnabled,
    setBrakesAlertsEnabled,
    setFuelAlertsEnabled,
    setRivalAlertsEnabled,
    setQualyAlertsEnabled,
    setFlagsPensAlertsEnabled,
    setChatterCooldownSeconds,
    setSubTyreWear,
    setSubTyrePuncture,
    setSubTyreThermal,
    setSubTyreCold,
    setSubDamageWing,
    setSubDamageFloor,
    setSubDamageEngine,
    setSubDamageFaults,
    setSubErsLow,
    setSubEngineTemp,
    setSubBrakeTemp,
    setSubBrakeCold,
    setSubFuelDelta,
    setSubUndercut,
    setSubPitWindow,
    setSubRivalDefend,
    setSubRivalAttack,
    setSubQualyTraffic,
    setSubQualyInvalid,
    setSubQualyTime,
    setSubQualyElim,
    setSubSafetyCar,
    setSubRedFlag,
    setSubRain,
    setSubTrackLimits,
    setSubPenalties,
  ]);

  // Reset to factory defaults
  const resetTriggerDefaults = useCallback(() => {
    applyTriggerPreset(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    setTyreWearWarningPct(RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_WARN_PCT);
    setTyreWearCriticalPct(RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_CRIT_PCT);
    setTyreOverheatC(RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_OVERHEAT_C);
    setTyreColdC(RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_COLD_C);
    setWingDamageWarnPct(RADIO_ALERT_CONSTANTS.DEFAULT_WING_DAMAGE_WARN_PCT);
    setFloorDamageWarnPct(RADIO_ALERT_CONSTANTS.DEFAULT_FLOOR_DAMAGE_WARN_PCT);
    setEngineWearWarnPct(RADIO_ALERT_CONSTANTS.DEFAULT_ENGINE_WEAR_WARN_PCT);
    setErsLowPct(RADIO_ALERT_CONSTANTS.DEFAULT_ERS_LOW_PCT);
    setEngineOverheatC(RADIO_ALERT_CONSTANTS.DEFAULT_ENGINE_OVERHEAT_C);
    setBrakeOverheatC(RADIO_ALERT_CONSTANTS.DEFAULT_BRAKE_OVERHEAT_C);
    setBrakeColdC(RADIO_ALERT_CONSTANTS.DEFAULT_BRAKE_COLD_C);
    setFuelDeltaLaps(RADIO_ALERT_CONSTANTS.DEFAULT_FUEL_DELTA_LAPS);
    setUndercutGapSec(RADIO_ALERT_CONSTANTS.DEFAULT_UNDERCUT_GAP_SEC);
    setRivalGapThresholdSec(RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_GAP_SEC);
    setRivalAheadGapSec(RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_AHEAD_GAP_SEC);
    setQualyCleanAirSec(RADIO_ALERT_CONSTANTS.DEFAULT_QUALY_CLEAN_AIR_SEC);
    setCornerCutWarnThreshold(RADIO_ALERT_CONSTANTS.DEFAULT_CORNER_CUT_WARN_THRESHOLD);
    setRainHorizonMin(RADIO_ALERT_CONSTANTS.DEFAULT_RAIN_HORIZON_MIN);
    setRainProbPct(RADIO_ALERT_CONSTANTS.DEFAULT_RAIN_PROB_PCT);
  }, [
    applyTriggerPreset,
    setTyreWearWarningPct,
    setTyreWearCriticalPct,
    setTyreOverheatC,
    setTyreColdC,
    setWingDamageWarnPct,
    setFloorDamageWarnPct,
    setEngineWearWarnPct,
    setErsLowPct,
    setEngineOverheatC,
    setBrakeOverheatC,
    setBrakeColdC,
    setFuelDeltaLaps,
    setUndercutGapSec,
    setRivalGapThresholdSec,
    setRivalAheadGapSec,
    setQualyCleanAirSec,
    setCornerCutWarnThreshold,
    setRainHorizonMin,
    setRainProbPct,
  ]);

  // Compute effective radio language based on setting and current UI locale
  const effectiveLanguage: 'es' | 'en' =
    radioLanguage === RADIO_LANGUAGES.AUTO
      ? (uiLocale === 'es' ? 'es' : 'en')
      : (radioLanguage === RADIO_LANGUAGES.ES ? 'es' : 'en');

  // Recognition instance & refs
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const currentTranscriptRef = useRef<string>('');
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const getRecognitionLang = useCallback(() => {
    return effectiveLanguage === 'es' ? 'es-AR' : 'en-GB';
  }, [effectiveLanguage]);

  const stopRadio = useCallback(() => {
    stopRadioSpeech();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setRadioState('idle');
  }, []);

  const speakMessage = useCallback(
    async (text: string, forceInterrupt = false) => {
      if (!isRadioEnabled || !text.trim()) return;

      if (forceInterrupt) {
        stopRadio();
      }

      setRadioState('speaking');
      setLastResponse(text);
      if (onResponseReceived) {
        onResponseReceived(text);
      }

      const rateStr = speechRate >= 0 ? `+${speechRate}%` : `${speechRate}%`;
      const pitchStr = speechPitch >= 0 ? `+${speechPitch}Hz` : `${speechPitch}Hz`;

      await speakRadioResponse(text, {
        volume,
        voice: neuralVoice || undefined,
        persona,
        language: effectiveLanguage,
        rate: rateStr,
        pitch: pitchStr,
        enableBeeps: beepsEnabled,
        enableCockpitFilter: filterEnabled,
        enableStaticFx: staticFxEnabled,
        onEnd: () => {
          setRadioState('idle');
        },
        onError: () => {
          setRadioState('idle');
        },
      });
    },
    [
      isRadioEnabled,
      stopRadio,
      onResponseReceived,
      speechRate,
      speechPitch,
      volume,
      neuralVoice,
      persona,
      effectiveLanguage,
      beepsEnabled,
      filterEnabled,
      staticFxEnabled,
    ]
  );

  // Audio test for specific trigger types
  const testTriggerAlert = useCallback(
    async (triggerType: string) => {
      const isEs = effectiveLanguage === 'es';
      let sampleText = '';
      switch (triggerType) {
        case 'tyres':
        case 'tyre_wear':
          sampleText = isEs
            ? '[PROACTIVE PIT WALL CALL: Desgaste en la delantera izquierda llegó al 45%. Cuidá la tracción en salida de curvas lentas.]'
            : '[PROACTIVE PIT WALL CALL: Tyre wear reached 45% on front left. Manage traction out of slow turns.]';
          break;
        case 'damage':
        case 'damage_wing':
          sampleText = isEs
            ? '[PROACTIVE PIT WALL CALL: Daño en el alerón delantero detectado. Vas a sentir subviraje en curva media y rápida.]'
            : '[PROACTIVE PIT WALL CALL: Front wing flap damage detected. Expect understeer in medium and high speed corners.]';
          break;
        case 'ers':
        case 'ers_low':
          sampleText = isEs
            ? '[PROACTIVE PIT WALL CALL: Reserva de batería baja al 12%. Cambiá a modo None en rectas para recargar.]'
            : '[PROACTIVE PIT WALL CALL: ERS battery reserve is low at 12%. Switch to None mode on straights to harvest.]';
          break;
        case 'brakes':
        case 'brakes_overheat':
          sampleText = isEs
            ? '[PROACTIVE PIT WALL CALL: Los discos de freno están a 950°C en la curva 1. Pasá el balance hacia adelante y levantá antes.]'
            : '[PROACTIVE PIT WALL CALL: Brake temps critically high at 950°C. Move brake bias forward and lift earlier.]';
          break;
        case 'fuel':
        case 'fuel_delta':
          sampleText = isEs
            ? '[PROACTIVE PIT WALL CALL: Estamos a menos 0.8 vueltas del target de combustible. Hacé Lift and Coast en frenadas fuertes.]'
            : '[PROACTIVE PIT WALL CALL: Fuel target deficit is -0.8 laps below target. Introduce Lift and Coast into heavy braking.]';
          break;
        case 'rivals':
        case 'rival_defend':
          sampleText = isEs
            ? '[PROACTIVE PIT WALL CALL: Rival detrás a menos de 0.8 segundos con DRS. Cubrí la cuerda interna en la frenada.]'
            : '[PROACTIVE PIT WALL CALL: Car behind is within 0.8 seconds in DRS zone. Defend the inside line into Turn 1.]';
          break;
        case 'qualy':
        case 'qualy_traffic':
          sampleText = isEs
            ? '[PROACTIVE PIT WALL CALL: Tráfico en el Sector 3 antes de abrir vuelta. Frená el ritmo para armar 4 segundos de aire limpio.]'
            : '[PROACTIVE PIT WALL CALL: Traffic ahead in Sector 3 before hot lap. Slow down to build 4 seconds of clean air.]';
          break;
        case 'flags':
        case 'flags_sc':
          sampleText = isEs
            ? '[PROACTIVE PIT WALL CALL: ¡Safety Car en pista! Mantené el delta positivo y estate atento a la orden de boxes.]'
            : '[PROACTIVE PIT WALL CALL: Safety Car deployed! Maintain delta positive and stand by for pit call.]';
          break;
        default:
          sampleText = isEs
            ? '[PROACTIVE PIT WALL CALL: Canal de radio verificado. Telemetría y enlace del muro de boxes operando al 100%.]'
            : '[PROACTIVE PIT WALL CALL: Radio check confirmed. Pit wall telemetry link active and operational.]';
      }

      await speakMessage(sampleText, true);
    },
    [effectiveLanguage, speakMessage]
  );

  const testRadioTransmission = useCallback(async () => {
    let sampleMessage = '';
    if (effectiveLanguage === 'es') {
      if (persona === RADIO_PERSONAS.BONO) {
        sampleMessage = 'Radio check, te copio fuerte y claro. Modo carrera activado, gestioná la diferencia.';
      } else if (persona === RADIO_PERSONAS.COLAPINTO) {
        sampleMessage = 'Radio check, te copio fuerte y claro. Venís con muy buen ritmo, dale que va.';
      } else {
        sampleMessage = 'Radio check, te copio en boxes. Todos los sistemas en verde.';
      }
    } else {
      if (persona === RADIO_PERSONAS.BONO) {
        sampleMessage = 'Radio check, loud and clear. It is Hammer time, let us manage the delta.';
      } else if (persona === RADIO_PERSONAS.COLAPINTO) {
        sampleMessage = 'Radio check mate, loud and clear! Looking really rapid out there, keep pushing!';
      } else {
        sampleMessage = 'Radio check, pit wall copy. All telemetry systems nominal.';
      }
    }
    await speakMessage(sampleMessage, true);
  }, [effectiveLanguage, persona, speakMessage]);

  // Handle Gamepad PTT
  const onPTTPress = useCallback(() => {
    if (!isRadioEnabled || radioState === 'transmitting') return;
    stopRadioSpeech();
    currentTranscriptRef.current = '';
    setError(null);
    setRadioState('transmitting');

    if (beepsEnabled) {
      playRadioBeep('start');
    }

    const SpeechRec = getSpeechRecognitionClass();
    if (!SpeechRec) {
      setError('Speech recognition not supported in browser');
      setRadioState('idle');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = getRecognitionLang();

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        currentTranscriptRef.current = transcript;
        setLastTranscript(transcript);
        if (onTranscriptReceived) {
          onTranscriptReceived(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          setError(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      setError(err?.message || 'Failed to start speech recognition');
      setRadioState('idle');
    }
  }, [isRadioEnabled, radioState, beepsEnabled, getRecognitionLang, onTranscriptReceived]);

  const onPTTRelease = useCallback(async () => {
    if (radioState !== 'transmitting') return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (beepsEnabled) {
      await playRadioBeep('end');
    }

    const finalTranscript = currentTranscriptRef.current.trim();
    if (!finalTranscript) {
      setRadioState('idle');
      return;
    }

    setRadioState('processing');

    try {
      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;

      const liveContext = getLiveTelemetrySummary ? getLiveTelemetrySummary() : '';
      const prompt = `[DRIVER RADIO TRANSMISSION]: "${finalTranscript}"\n\n${liveContext}`;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode: 'live',
          telemetry: telemetryContext,
          persona,
          customPrompt: persona === RADIO_PERSONAS.CUSTOM ? customPrompt : undefined,
          driverCallsign: driverCallsign || undefined,
          language: effectiveLanguage,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`AI Service returned status ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullReply += parsed.content;
                }
              } catch {
                fullReply += data;
              }
            }
          }
        }
      }

      if (fullReply.trim()) {
        await speakMessage(fullReply.trim());
      } else {
        setRadioState('idle');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err?.message || 'Error processing radio response');
      }
      setRadioState('idle');
    } finally {
      activeAbortControllerRef.current = null;
    }
  }, [
    radioState,
    beepsEnabled,
    getLiveTelemetrySummary,
    telemetryContext,
    persona,
    customPrompt,
    driverCallsign,
    effectiveLanguage,
    speakMessage,
  ]);

  const gamepadPTT = useGamepadPTT({
    enabled: isRadioEnabled,
    onPTTDown: onPTTPress,
    onPTTUp: onPTTRelease,
  });

  return {
    radioState,
    isRadioEnabled,
    setIsRadioEnabled,
    persona,
    setPersona,
    radioLanguage,
    setRadioLanguage,
    effectiveLanguage,
    customPrompt,
    setCustomPrompt,
    driverCallsign,
    setDriverCallsign,
    beepsEnabled,
    setBeepsEnabled,
    filterEnabled,
    setFilterEnabled,
    staticFxEnabled,
    setStaticFxEnabled,
    volume,
    setVolume,
    speechRate,
    setSpeechRate,
    speechPitch,
    setSpeechPitch,
    neuralVoice,
    setNeuralVoice,
    smartDiscretionEnabled,
    setSmartDiscretionEnabled,
    chatterCooldownSeconds,
    setChatterCooldownSeconds,
    triggerPreset,
    applyTriggerPreset,
    resetTriggerDefaults,
    // Subsystems
    tyreAlertsEnabled,
    setTyreAlertsEnabled,
    thermalAlertsEnabled,
    setThermalAlertsEnabled,
    damageAlertsEnabled,
    setDamageAlertsEnabled,
    ersAlertsEnabled,
    setErsAlertsEnabled,
    brakesAlertsEnabled,
    setBrakesAlertsEnabled,
    fuelAlertsEnabled,
    setFuelAlertsEnabled,
    rivalAlertsEnabled,
    setRivalAlertsEnabled,
    pitWindowAlertsEnabled,
    setPitWindowAlertsEnabled,
    trackAlertsEnabled,
    setTrackAlertsEnabled,
    qualyAlertsEnabled,
    setQualyAlertsEnabled,
    flagsPensAlertsEnabled,
    setFlagsPensAlertsEnabled,
    // Sub-toggles
    subTyreWear,
    setSubTyreWear,
    subTyrePuncture,
    setSubTyrePuncture,
    subTyreThermal,
    setSubTyreThermal,
    subTyreCold,
    setSubTyreCold,
    subDamageWing,
    setSubDamageWing,
    subDamageFloor,
    setSubDamageFloor,
    subDamageEngine,
    setSubDamageEngine,
    subDamageFaults,
    setSubDamageFaults,
    subErsLow,
    setSubErsLow,
    subEngineTemp,
    setSubEngineTemp,
    subBrakeTemp,
    setSubBrakeTemp,
    subBrakeCold,
    setSubBrakeCold,
    subFuelDelta,
    setSubFuelDelta,
    subUndercut,
    setSubUndercut,
    subPitWindow,
    setSubPitWindow,
    subRivalDefend,
    setSubRivalDefend,
    subRivalAttack,
    setSubRivalAttack,
    subQualyTraffic,
    setSubQualyTraffic,
    subQualyInvalid,
    setSubQualyInvalid,
    subQualyTime,
    setSubQualyTime,
    subQualyElim,
    setSubQualyElim,
    subSafetyCar,
    setSubSafetyCar,
    subRedFlag,
    setSubRedFlag,
    subRain,
    setSubRain,
    subTrackLimits,
    setSubTrackLimits,
    subPenalties,
    setSubPenalties,
    // Granular thresholds
    tyreWearWarningPct,
    setTyreWearWarningPct,
    tyreWearCriticalPct,
    setTyreWearCriticalPct,
    tyreOverheatC,
    setTyreOverheatC,
    tyreColdC,
    setTyreColdC,
    wingDamageWarnPct,
    setWingDamageWarnPct,
    floorDamageWarnPct,
    setFloorDamageWarnPct,
    engineWearWarnPct,
    setEngineWearWarnPct,
    ersLowPct,
    setErsLowPct,
    engineOverheatC,
    setEngineOverheatC,
    brakeOverheatC,
    setBrakeOverheatC,
    brakeColdC,
    setBrakeColdC,
    fuelDeltaLaps,
    setFuelDeltaLaps,
    undercutGapSec,
    setUndercutGapSec,
    rivalGapThresholdSec,
    setRivalGapThresholdSec,
    rivalAheadGapSec,
    setRivalAheadGapSec,
    qualyCleanAirSec,
    setQualyCleanAirSec,
    cornerCutWarnThreshold,
    setCornerCutWarnThreshold,
    rainHorizonMin,
    setRainHorizonMin,
    rainProbPct,
    setRainProbPct,
    lastTranscript,
    lastResponse,
    error,
    // PTT props
    isPTTActive: gamepadPTT.isPTTActive,
    isLearning: gamepadPTT.isLearning,
    startLearning: gamepadPTT.startLearning,
    cancelLearning: gamepadPTT.cancelLearning,
    mappedGamepadButton: gamepadPTT.mappedGamepadButton,
    setMappedGamepadButton: gamepadPTT.setMappedGamepadButton,
    mappedKey: gamepadPTT.mappedKey,
    setMappedKey: gamepadPTT.setMappedKey,
    gamepadConnected: gamepadPTT.gamepadConnected,
    gamepadName: gamepadPTT.gamepadName,
    // Actions
    testRadioTransmission,
    testTriggerAlert,
    stopRadio,
    speakMessage,
  };
}
