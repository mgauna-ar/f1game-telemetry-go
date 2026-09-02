import type { StateCreator } from 'zustand';
import {
  RADIO_STORAGE_KEYS,
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_AUDIO_CONSTANTS,
  type RadioPersona,
  type RadioLanguage,
} from '../../constants/f1';
import type { RadioSettingsState } from '../useRadioSettingsStore';

export function getStoredBool(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val === 'true' : def;
  } catch {
    return def;
  }
}

export function getStoredNum(key: string, def: number, min?: number, max?: number): number {
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

export function getStoredStr<T extends string>(key: string, def: T, allowedValues?: readonly T[]): T {
  if (typeof window === 'undefined') return def;
  try {
    const val = localStorage.getItem(key) as T;
    if (val && (!allowedValues || allowedValues.includes(val))) return val;
    return def;
  } catch {
    return def;
  }
}

export function saveStorage(key: string, val: string | number | boolean): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, String(val));
    } catch {
      // ignore
    }
  }
}

export interface AudioSettingsSlice {
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
}

export function getInitialAudioSettings(): Omit<
  AudioSettingsSlice,
  | 'setIsRadioEnabled'
  | 'setPersona'
  | 'setRadioLanguage'
  | 'setCustomPrompt'
  | 'setDriverCallsign'
  | 'setBeepsEnabled'
  | 'setFilterEnabled'
  | 'setStaticFxEnabled'
  | 'setVolume'
  | 'setSpeechRate'
  | 'setSpeechPitch'
  | 'setNeuralVoice'
> {
  return {
    isRadioEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_ENABLED, true),
    persona: getStoredStr<RadioPersona>(
      RADIO_STORAGE_KEYS.PERSONA,
      RADIO_PERSONAS.BONO,
      Object.values(RADIO_PERSONAS)
    ),
    radioLanguage: getStoredStr<RadioLanguage>(
      RADIO_STORAGE_KEYS.LANGUAGE,
      RADIO_LANGUAGES.AUTO,
      Object.values(RADIO_LANGUAGES)
    ),
    customPrompt: getStoredStr(RADIO_STORAGE_KEYS.CUSTOM_PROMPT, ''),
    driverCallsign: getStoredStr(RADIO_STORAGE_KEYS.DRIVER_CALLSIGN, ''),
    beepsEnabled: getStoredBool(RADIO_STORAGE_KEYS.BEEPS_ENABLED, true),
    filterEnabled: getStoredBool(RADIO_STORAGE_KEYS.FILTER_ENABLED, true),
    staticFxEnabled: getStoredBool(RADIO_STORAGE_KEYS.STATIC_FX_ENABLED, true),
    volume: getStoredNum(
      RADIO_STORAGE_KEYS.VOLUME,
      RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME,
      0,
      1
    ),
    speechRate: getStoredNum(
      RADIO_STORAGE_KEYS.SPEECH_RATE,
      RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_RATE_PERCENT,
      -20,
      30
    ),
    speechPitch: getStoredNum(
      RADIO_STORAGE_KEYS.SPEECH_PITCH,
      RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_PITCH_HZ,
      -100,
      100
    ),
    neuralVoice: getStoredStr(RADIO_STORAGE_KEYS.NEURAL_VOICE, ''),
  };
}

export const createAudioSettingsSlice: StateCreator<
  RadioSettingsState,
  [],
  [],
  AudioSettingsSlice
> = (set) => ({
  ...getInitialAudioSettings(),

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
});
