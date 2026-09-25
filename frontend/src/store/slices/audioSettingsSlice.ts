import type { StateCreator } from 'zustand';
import {
  RADIO_STORAGE_KEYS,
  LEGACY_RADIO_STORAGE_KEYS,
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

/** The engineer's voice, shared by every device through GET/PUT /api/settings/voice. */
export interface VoiceSettingsPayload {
  persona: string;
  language: string;
  custom_prompt: string;
  driver_callsign: string;
  neural_voice: string;
  speech_rate: number;
  speech_pitch: number;
}

export type VoiceSettingsValues = Pick<
  AudioSettingsSlice,
  | 'persona'
  | 'radioLanguage'
  | 'customPrompt'
  | 'driverCallsign'
  | 'neuralVoice'
  | 'speechRate'
  | 'speechPitch'
>;

const clampSpeechRate = (rate: number): number =>
  Math.max(
    RADIO_AUDIO_CONSTANTS.MIN_SPEECH_RATE_PERCENT,
    Math.min(RADIO_AUDIO_CONSTANTS.MAX_SPEECH_RATE_PERCENT, rate)
  );

const clampSpeechPitch = (pitch: number): number =>
  Math.max(
    RADIO_AUDIO_CONSTANTS.MIN_SPEECH_PITCH_HZ,
    Math.min(RADIO_AUDIO_CONSTANTS.MAX_SPEECH_PITCH_HZ, pitch)
  );

const isOneOf = <T extends string>(value: unknown, allowed: Record<string, T>): value is T =>
  typeof value === 'string' && (Object.values(allowed) as string[]).includes(value);

export function getDefaultVoiceSettings(): VoiceSettingsValues {
  return {
    persona: RADIO_PERSONAS.BONO,
    radioLanguage: RADIO_LANGUAGES.AUTO,
    customPrompt: '',
    driverCallsign: '',
    neuralVoice: '',
    speechRate: RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_RATE_PERCENT,
    speechPitch: RADIO_AUDIO_CONSTANTS.DEFAULT_SPEECH_PITCH_HZ,
  };
}

export function voiceToPayload(v: VoiceSettingsValues): VoiceSettingsPayload {
  return {
    persona: v.persona,
    language: v.radioLanguage,
    custom_prompt: v.customPrompt,
    driver_callsign: v.driverCallsign,
    neural_voice: v.neuralVoice,
    speech_rate: v.speechRate,
    speech_pitch: v.speechPitch,
  };
}

/** Reads a server payload, keeping `fallback` for any value this dashboard can't use. */
export function voiceFromPayload(
  p: Partial<VoiceSettingsPayload>,
  fallback: VoiceSettingsValues
): VoiceSettingsValues {
  return {
    persona: isOneOf(p.persona, RADIO_PERSONAS) ? p.persona : fallback.persona,
    radioLanguage: isOneOf(p.language, RADIO_LANGUAGES) ? p.language : fallback.radioLanguage,
    customPrompt: typeof p.custom_prompt === 'string' ? p.custom_prompt : fallback.customPrompt,
    driverCallsign: typeof p.driver_callsign === 'string' ? p.driver_callsign : fallback.driverCallsign,
    neuralVoice: typeof p.neural_voice === 'string' ? p.neural_voice : fallback.neuralVoice,
    speechRate: Number.isFinite(p.speech_rate) ? clampSpeechRate(p.speech_rate as number) : fallback.speechRate,
    speechPitch: Number.isFinite(p.speech_pitch) ? clampSpeechPitch(p.speech_pitch as number) : fallback.speechPitch,
  };
}

const LEGACY_VOICE_KEYS = [
  LEGACY_RADIO_STORAGE_KEYS.PERSONA,
  LEGACY_RADIO_STORAGE_KEYS.LANGUAGE,
  LEGACY_RADIO_STORAGE_KEYS.CUSTOM_PROMPT,
  LEGACY_RADIO_STORAGE_KEYS.DRIVER_CALLSIGN,
  LEGACY_RADIO_STORAGE_KEYS.NEURAL_VOICE,
  LEGACY_RADIO_STORAGE_KEYS.SPEECH_RATE,
  LEGACY_RADIO_STORAGE_KEYS.SPEECH_PITCH,
] as const;

/** The voice setup an older version kept in this browser, or null when it kept none. */
export function getLegacyVoiceSettings(): VoiceSettingsValues | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!LEGACY_VOICE_KEYS.some((key) => localStorage.getItem(key) !== null)) return null;
  } catch {
    return null;
  }
  const defaults = getDefaultVoiceSettings();
  return {
    persona: getStoredStr<RadioPersona>(
      LEGACY_RADIO_STORAGE_KEYS.PERSONA,
      defaults.persona,
      Object.values(RADIO_PERSONAS)
    ),
    radioLanguage: getStoredStr<RadioLanguage>(
      LEGACY_RADIO_STORAGE_KEYS.LANGUAGE,
      defaults.radioLanguage,
      Object.values(RADIO_LANGUAGES)
    ),
    customPrompt: getStoredStr(LEGACY_RADIO_STORAGE_KEYS.CUSTOM_PROMPT, defaults.customPrompt),
    driverCallsign: getStoredStr(LEGACY_RADIO_STORAGE_KEYS.DRIVER_CALLSIGN, defaults.driverCallsign),
    neuralVoice: getStoredStr(LEGACY_RADIO_STORAGE_KEYS.NEURAL_VOICE, defaults.neuralVoice),
    speechRate: clampSpeechRate(getStoredNum(LEGACY_RADIO_STORAGE_KEYS.SPEECH_RATE, defaults.speechRate)),
    speechPitch: clampSpeechPitch(getStoredNum(LEGACY_RADIO_STORAGE_KEYS.SPEECH_PITCH, defaults.speechPitch)),
  };
}

export function clearLegacyVoiceSettings(): void {
  if (typeof window === 'undefined') return;
  try {
    LEGACY_VOICE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
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
    // Voice settings start at their defaults until loadVoiceFromBackend brings the saved ones.
    ...getDefaultVoiceSettings(),
    isRadioEnabled: getStoredBool(RADIO_STORAGE_KEYS.ALERTS_ENABLED, true),
    beepsEnabled: getStoredBool(RADIO_STORAGE_KEYS.BEEPS_ENABLED, true),
    filterEnabled: getStoredBool(RADIO_STORAGE_KEYS.FILTER_ENABLED, true),
    staticFxEnabled: getStoredBool(RADIO_STORAGE_KEYS.STATIC_FX_ENABLED, true),
    volume: getStoredNum(
      RADIO_STORAGE_KEYS.VOLUME,
      RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME,
      0,
      1
    ),
  };
}

export const createAudioSettingsSlice: StateCreator<
  RadioSettingsState,
  [],
  [],
  AudioSettingsSlice
> = (set, get) => ({
  ...getInitialAudioSettings(),

  setIsRadioEnabled: (val) => {
    saveStorage(RADIO_STORAGE_KEYS.ALERTS_ENABLED, val);
    set({ isRadioEnabled: val });
  },
  setPersona: (p) => {
    set({ persona: p });
    get().syncVoiceToBackend();
  },
  setRadioLanguage: (lang) => {
    set({ radioLanguage: lang });
    get().syncVoiceToBackend();
  },
  setCustomPrompt: (prompt) => {
    set({ customPrompt: prompt });
    get().syncVoiceToBackend();
  },
  setDriverCallsign: (callsign) => {
    set({ driverCallsign: callsign });
    get().syncVoiceToBackend();
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
    set({ speechRate: clampSpeechRate(r) });
    get().syncVoiceToBackend();
  },
  setSpeechPitch: (p) => {
    set({ speechPitch: clampSpeechPitch(p) });
    get().syncVoiceToBackend();
  },
  setNeuralVoice: (v) => {
    set({ neuralVoice: v });
    get().syncVoiceToBackend();
  },
});
