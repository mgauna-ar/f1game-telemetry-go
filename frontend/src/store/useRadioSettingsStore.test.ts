import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRadioSettingsStore } from './useRadioSettingsStore';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_STORAGE_KEYS,
  RADIO_TRIGGER_PRESETS,
} from '../constants/f1';
import { api } from '../utils/apiClient';

describe('useRadioSettingsStore and slices', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useRadioSettingsStore.getState().resetStoreToDefaults();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    useRadioSettingsStore.getState().resetStoreToDefaults();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('handles audio settings with localStorage persistence', () => {
    const store = useRadioSettingsStore.getState();

    // Volume
    store.setVolume(0.5);
    expect(useRadioSettingsStore.getState().volume).toBe(0.5);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.VOLUME)).toBe('0.5');

    // Speech Rate & Pitch
    store.setSpeechRate(15);
    expect(useRadioSettingsStore.getState().speechRate).toBe(15);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.SPEECH_RATE)).toBe('15');

    store.setSpeechPitch(-20);
    expect(useRadioSettingsStore.getState().speechPitch).toBe(-20);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.SPEECH_PITCH)).toBe('-20');

    // Persona & Language
    store.setPersona(RADIO_PERSONAS.COLAPINTO);
    expect(useRadioSettingsStore.getState().persona).toBe(RADIO_PERSONAS.COLAPINTO);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.PERSONA)).toBe(RADIO_PERSONAS.COLAPINTO);

    store.setRadioLanguage(RADIO_LANGUAGES.ES);
    expect(useRadioSettingsStore.getState().radioLanguage).toBe(RADIO_LANGUAGES.ES);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.LANGUAGE)).toBe(RADIO_LANGUAGES.ES);

    // Audio effects
    store.setBeepsEnabled(false);
    expect(useRadioSettingsStore.getState().beepsEnabled).toBe(false);

    store.setFilterEnabled(false);
    expect(useRadioSettingsStore.getState().filterEnabled).toBe(false);

    store.setStaticFxEnabled(false);
    expect(useRadioSettingsStore.getState().staticFxEnabled).toBe(false);
  });

  it('handles alert thresholds without localStorage writes and debounces sync to backend', () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const store = useRadioSettingsStore.getState();

    store.setTyreWearWarningPct(55);
    expect(useRadioSettingsStore.getState().tyreWearWarningPct).toBe(55);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.CUSTOM);
    // Should NOT write to localStorage for threshold
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.TYRE_WEAR_WARN_PCT)).toBeNull();

    // Debounced - should not have fired yet
    expect(postSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(postSpy).toHaveBeenCalledTimes(1);
    const lastCall = postSpy.mock.calls[postSpy.mock.calls.length - 1];
    expect(lastCall[0]).toBe('/api/ai/engineer/config');
    expect((lastCall[1] as Record<string, unknown>).tyre_wear_warn_pct).toBe(55);
  });

  it('debounces rapid changes into a single backend sync', () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const store = useRadioSettingsStore.getState();

    store.setTyreWearWarningPct(40);
    store.setTyreWearWarningPct(45);
    store.setTyreWearWarningPct(50);
    store.setTyreWearWarningPct(55);

    expect(postSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(postSpy).toHaveBeenCalledTimes(1);
    const lastCall = postSpy.mock.calls[0];
    expect((lastCall[1] as Record<string, unknown>).tyre_wear_warn_pct).toBe(55);
  });

  it('handles tactical settings toggles and debounces sync to backend', () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const store = useRadioSettingsStore.getState();

    store.setSubTyreThermal(false);
    expect(useRadioSettingsStore.getState().subTyreThermal).toBe(false);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.CUSTOM);

    vi.advanceTimersByTime(500);
    expect(postSpy).toHaveBeenCalled();
  });

  it('applies trigger presets cleanly (Immersive, Coaching, Minimal)', () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const store = useRadioSettingsStore.getState();

    // Coaching preset
    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.COACHING);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.COACHING);
    expect(useRadioSettingsStore.getState().chatterCooldownSeconds).toBe(20);
    expect(useRadioSettingsStore.getState().subTyreThermal).toBe(true);

    // Minimal preset
    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.MINIMAL);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.MINIMAL);
    expect(useRadioSettingsStore.getState().chatterCooldownSeconds).toBe(90);
    expect(useRadioSettingsStore.getState().subTyreWear).toBe(false);
    expect(useRadioSettingsStore.getState().subTyrePuncture).toBe(true);

    // Immersive preset
    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(useRadioSettingsStore.getState().chatterCooldownSeconds).toBe(45);
    expect(useRadioSettingsStore.getState().subTyreWear).toBe(true);
    expect(useRadioSettingsStore.getState().subTyreThermal).toBe(false);

    vi.advanceTimersByTime(500);
    expect(postSpy).toHaveBeenCalled();
  });

  it('hydrates config from backend via loadConfigFromBackend', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      chatter_cooldown_ms: 25000,
      smart_discretion_enabled: false,
      tyre_wear_warn_pct: 48,
      tyre_wear_crit_pct: 82,
      enabled_categories: {
        tyre_wear: true,
        tyre_thermal: true,
        flags_rain: false,
      },
    });

    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.chatterCooldownSeconds).toBe(25);
    expect(state.smartDiscretionEnabled).toBe(false);
    expect(state.tyreWearWarningPct).toBe(48);
    expect(state.tyreWearCriticalPct).toBe(82);
    expect(state.subTyreWear).toBe(true);
    expect(state.subTyreThermal).toBe(true);
    expect(state.subRain).toBe(false);
  });
});
