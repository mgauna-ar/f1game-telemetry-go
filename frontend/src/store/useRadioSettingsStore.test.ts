import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRadioSettingsStore } from './useRadioSettingsStore';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_STORAGE_KEYS,
  LEGACY_RADIO_STORAGE_KEYS,
  RADIO_AUDIO_CONSTANTS,
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

  it('keeps volume per device and saves the voice to the server', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({});
    const store = useRadioSettingsStore.getState();

    // Volume stays in this browser
    store.setVolume(0.5);
    expect(useRadioSettingsStore.getState().volume).toBe(0.5);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.VOLUME)).toBe('0.5');

    // Voice settings are shared through the server, in one debounced save
    store.setSpeechRate(15);
    store.setSpeechPitch(-20);
    store.setPersona(RADIO_PERSONAS.COLAPINTO);
    store.setRadioLanguage(RADIO_LANGUAGES.ES);
    store.setSpeechRate(99);
    const state = useRadioSettingsStore.getState();
    expect(state.speechRate).toBe(RADIO_AUDIO_CONSTANTS.MAX_SPEECH_RATE_PERCENT);
    expect(state.speechPitch).toBe(-20);
    expect(state.persona).toBe(RADIO_PERSONAS.COLAPINTO);
    expect(state.radioLanguage).toBe(RADIO_LANGUAGES.ES);
    expect(putSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(putSpy).toHaveBeenCalledWith('/api/settings/voice', {
      persona: RADIO_PERSONAS.COLAPINTO,
      language: RADIO_LANGUAGES.ES,
      custom_prompt: '',
      driver_callsign: '',
      neural_voice: '',
      speech_rate: RADIO_AUDIO_CONSTANTS.MAX_SPEECH_RATE_PERCENT,
      speech_pitch: -20,
    });
    expect(localStorage.getItem(LEGACY_RADIO_STORAGE_KEYS.PERSONA)).toBeNull();

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

  it('serializes global_chatter_cooldown_ms and canonical alert keys in engineerConfig', () => {
    const store = useRadioSettingsStore.getState();
    const config = store.engineerConfig;

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
    expect(state.engineerConfig.trigger_preset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(state.engineerConfig.enabled_categories?.tyre_thermal).toBe(false);
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
  it('loads the saved voice from the server and drops old browser copies', async () => {
    localStorage.setItem(LEGACY_RADIO_STORAGE_KEYS.PERSONA, RADIO_PERSONAS.CUSTOM);
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      saved: true,
      persona: RADIO_PERSONAS.COLAPINTO,
      language: 'klingon',
      custom_prompt: '',
      driver_callsign: 'Mati',
      neural_voice: 'es-AR-TomasNeural',
      speech_rate: 5,
      speech_pitch: -500,
    });
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({});

    await useRadioSettingsStore.getState().loadVoiceFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.persona).toBe(RADIO_PERSONAS.COLAPINTO);
    expect(state.radioLanguage).toBe(RADIO_LANGUAGES.AUTO); // unknown language keeps the current one
    expect(state.driverCallsign).toBe('Mati');
    expect(state.speechPitch).toBe(RADIO_AUDIO_CONSTANTS.MIN_SPEECH_PITCH_HZ);
    expect(putSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(LEGACY_RADIO_STORAGE_KEYS.PERSONA)).toBeNull();
  });

  it('moves the voice an older version kept in this browser to the server once', async () => {
    localStorage.setItem(LEGACY_RADIO_STORAGE_KEYS.PERSONA, RADIO_PERSONAS.COLAPINTO);
    localStorage.setItem(LEGACY_RADIO_STORAGE_KEYS.DRIVER_CALLSIGN, 'Franco');
    localStorage.setItem(LEGACY_RADIO_STORAGE_KEYS.SPEECH_RATE, '10');
    vi.spyOn(api, 'get').mockResolvedValueOnce({ saved: false });
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({});

    await useRadioSettingsStore.getState().loadVoiceFromBackend();

    expect(useRadioSettingsStore.getState().persona).toBe(RADIO_PERSONAS.COLAPINTO);
    expect(putSpy).toHaveBeenCalledWith(
      '/api/settings/voice',
      expect.objectContaining({ persona: RADIO_PERSONAS.COLAPINTO, driver_callsign: 'Franco', speech_rate: 10 })
    );
    expect(localStorage.getItem(LEGACY_RADIO_STORAGE_KEYS.DRIVER_CALLSIGN)).toBeNull();
  });

  it('does not save defaults over the server when this browser kept no voice', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ saved: false });
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({});

    await useRadioSettingsStore.getState().loadVoiceFromBackend();

    expect(putSpy).not.toHaveBeenCalled();
  });
});
