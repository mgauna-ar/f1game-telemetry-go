import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRadioSettingsStore } from './useRadioSettingsStore';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_STORAGE_KEYS,
  RADIO_TRIGGER_PRESETS,
} from '../constants/f1';
import { api } from '../utils/apiClient';
import type { EngineerConfig } from '../types/telemetry';
import { ALERT_TOGGLE_KEYS, TRIGGER_PRESET_VALUES } from './slices/triggerPresets';

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
    expect(localStorage.getItem('f1_radio_tyre_wear_warn_pct')).toBeNull();

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

  it('serializes global_chatter_cooldown_ms and canonical alert keys in aiConfig', () => {
    const store = useRadioSettingsStore.getState();
    const config = store.aiConfig;

    expect(config.global_chatter_cooldown_ms).toBe(4000);
    expect(config.enabled_categories?.damage_wing).toBeDefined();
    expect(config.enabled_categories?.damage_floor).toBeDefined();
    expect(config.enabled_categories?.damage_engine).toBeDefined();
    expect(config.enabled_categories?.tyre_overheat).toBeDefined();
    expect(config.enabled_categories?.flags_rain_live).toBeDefined();
  });

  it('hydrates canonical backend alert keys (damage_wing, tyre_overheat, flags_rain_live)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      chatter_cooldown_ms: 30000,
      global_chatter_cooldown_ms: 4000,
      enabled_categories: {
        damage_wing: false,
        damage_floor: false,
        tyre_overheat: false,
        flags_rain_live: false,
      },
    });

    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.subDamageWing).toBe(false);
    expect(state.subDamageFloor).toBe(false);
    expect(state.subTyreThermal).toBe(false);
    expect(state.subRain).toBe(false);
  });
  it('starts on the Immersive preset with matching alert switches', () => {
    const state = useRadioSettingsStore.getState();
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    for (const key of ALERT_TOGGLE_KEYS) {
      expect(state[key]).toBe(TRIGGER_PRESET_VALUES.immersive[key]);
    }
    expect(state.aiConfig.trigger_preset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(state.aiConfig.enabled_categories?.tyre_thermal).toBe(false);
  });

  it('restores category switches and preset after a reload', async () => {
    let saved: EngineerConfig | null = null;
    const postSpy = vi.spyOn(api, 'post').mockImplementation(async (_url, body) => {
      saved = body as EngineerConfig;
      return { status: 'success' };
    });
    const store = useRadioSettingsStore.getState();
    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.MINIMAL);
    store.setTyreAlertsEnabled(false);
    await useRadioSettingsStore.getState().syncConfigToBackend(true);

    expect(saved!.alert_switches?.tyreAlertsEnabled).toBe(false);
    expect(saved!.alert_switches?.subTyrePuncture).toBe(true);
    expect(saved!.enabled_categories?.tyre_puncture).toBe(false);

    // Simulate a page reload
    useRadioSettingsStore.getState().resetStoreToDefaults();
    postSpy.mockClear();
    vi.spyOn(api, 'get').mockResolvedValue(saved);
    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.MINIMAL);
    expect(state.tyreAlertsEnabled).toBe(false);
    expect(state.thermalAlertsEnabled).toBe(false);
    expect(state.subTyrePuncture).toBe(true);
    expect(state.chatterCooldownSeconds).toBe(90);
    // Already in the current shape, so nothing is written back
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('migrates configs saved without panel state and writes them back once', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const minimal = TRIGGER_PRESET_VALUES.minimal;
    vi.spyOn(api, 'get').mockResolvedValue({
      chatter_cooldown_ms: minimal.chatterCooldownSeconds * 1000,
      // Old configs stored "category AND alert", so Minimal's disabled categories read as all-off
      enabled_categories: {
        tyre_wear: false,
        tyre_puncture: true,
        damage_wing: true,
        damage_aero_fault: true,
        flags_sc: true,
        flags_red: true,
        penalties: true,
      },
    });

    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.subTyreWear).toBe(false);
    expect(state.subTyrePuncture).toBe(true);
    expect(postSpy).toHaveBeenCalledTimes(1);
    const posted = postSpy.mock.calls[0][1] as EngineerConfig;
    expect(posted.alert_switches).toBeDefined();
    expect(posted.trigger_preset).toBe(state.triggerPreset);
  });

  it('keeps Immersive on a fresh install and saves it to the server', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    vi.spyOn(api, 'get').mockResolvedValue({
      chatter_cooldown_ms: 45000,
      global_chatter_cooldown_ms: 4000,
      smart_discretion_enabled: true,
      brake_overheat_c: 900,
    });

    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(state.subTyreThermal).toBe(false);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect((postSpy.mock.calls[0][1] as EngineerConfig).enabled_categories?.tyre_thermal).toBe(false);
  });

  it('resets thresholds to the server defaults', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ brake_overheat_c: 950, undercut_gap_sec: 2.0 });
    const store = useRadioSettingsStore.getState();
    store.setBrakeOverheatC(1100);
    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.COACHING);

    await useRadioSettingsStore.getState().resetTriggerDefaults();

    expect(getSpy).toHaveBeenCalledWith('/api/ai/engineer/config/defaults');
    const state = useRadioSettingsStore.getState();
    expect(state.brakeOverheatC).toBe(950);
    expect(state.undercutGapSec).toBe(2.0);
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(state.subTyreThermal).toBe(false);
  });

  it('falls back to bundled defaults when the server defaults are unavailable', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    vi.spyOn(api, 'get').mockRejectedValue(new Error('offline'));
    useRadioSettingsStore.getState().setBrakeOverheatC(1100);

    await useRadioSettingsStore.getState().resetTriggerDefaults();

    expect(useRadioSettingsStore.getState().brakeOverheatC).toBe(900);
  });
});
