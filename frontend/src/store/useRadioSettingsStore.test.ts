import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { engineerSettingsFromValues, useRadioSettingsStore } from './useRadioSettingsStore';
import { useSettingsSaveStore } from './useSettingsSaveStore';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_STORAGE_KEYS,
  LEGACY_RADIO_STORAGE_KEYS,
  RADIO_AUDIO_CONSTANTS,
  RADIO_TRIGGER_PRESETS,
} from '../constants/f1';
import { api, ApiError } from '../utils/apiClient';
import { DASHBOARD_CLIENT_HEADER, DASHBOARD_CLIENT_ID } from '../utils/settingsClient';
import type { EngineerSettings, EngineerSettingsResponse } from '../types/settings';
import { ALERT_TOGGLE_KEYS, TRIGGER_PRESET_VALUES } from './slices/triggerPresets';

const withClientId = { headers: { [DASHBOARD_CLIENT_HEADER]: DASHBOARD_CLIENT_ID } };

/** A GET /api/settings/engineer answer: saved defaults with `overrides`. */
function serverSettings(overrides: Partial<EngineerSettingsResponse> = {}): EngineerSettingsResponse {
  return {
    saved: true,
    version: 1,
    chatter_cooldown_ms: 45000,
    smart_discretion_enabled: true,
    tyre_wear_warn_pct: 40,
    tyre_wear_crit_pct: 75,
    tyre_temp_margin_c: 5,
    wing_damage_warn_pct: 20,
    floor_damage_warn_pct: 25,
    engine_wear_warn_pct: 70,
    ers_low_pct: 15,
    engine_overheat_c: 120,
    brake_overheat_c: 900,
    brake_cold_c: 200,
    fuel_delta_laps: -0.2,
    undercut_gap_sec: 1.5,
    rival_gap_sec: 1,
    rival_ahead_gap_sec: 1,
    qualy_clean_air_sec: 4,
    corner_cut_warn_threshold: 2,
    rain_horizon_min: 10,
    rain_prob_pct: 50,
    pit_call_lead_m: 500,
    trigger_preset: RADIO_TRIGGER_PRESETS.IMMERSIVE,
    alert_switches: immersiveSwitches(),
    ...overrides,
  };
}

/** The Immersive preset's switches, as a setup saved on Immersive stores them. */
function immersiveSwitches(): Record<string, boolean> {
  return Object.fromEntries(ALERT_TOGGLE_KEYS.map((key) => [key, TRIGGER_PRESET_VALUES.immersive[key]]));
}

/** The answer to a successful PUT /api/settings/engineer. */
function savedResponse(version: number): EngineerSettingsResponse {
  return serverSettings({ version });
}

/** The body of the `n`th race engineer save. */
function engineerBody(putSpy: { mock: { calls: unknown[][] } }, n = 0): EngineerSettings {
  const calls = putSpy.mock.calls.filter(([url]) => url === '/api/settings/engineer');
  return calls[n][1] as EngineerSettings;
}

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
    useSettingsSaveStore.getState().clear();
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
    expect(putSpy).toHaveBeenCalledWith(
      '/api/settings/voice',
      {
        persona: RADIO_PERSONAS.COLAPINTO,
        language: RADIO_LANGUAGES.ES,
        custom_prompt: '',
        driver_callsign: '',
        neural_voice: '',
        speech_rate: RADIO_AUDIO_CONSTANTS.MAX_SPEECH_RATE_PERCENT,
        speech_pitch: -20,
      },
      withClientId
    );
    expect(localStorage.getItem(LEGACY_RADIO_STORAGE_KEYS.PERSONA)).toBeNull();

    // Audio effects
    store.setBeepsEnabled(false);
    expect(useRadioSettingsStore.getState().beepsEnabled).toBe(false);

    store.setFilterEnabled(false);
    expect(useRadioSettingsStore.getState().filterEnabled).toBe(false);

    store.setStaticFxEnabled(false);
    expect(useRadioSettingsStore.getState().staticFxEnabled).toBe(false);
  });

  it('saves thresholds to the server after a pause, without localStorage writes', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue(savedResponse(1));
    const store = useRadioSettingsStore.getState();

    store.setTyreWearWarningPct(55);
    expect(useRadioSettingsStore.getState().tyreWearWarningPct).toBe(55);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.CUSTOM);
    expect(localStorage.getItem('f1_radio_tyre_wear_warn_pct')).toBeNull();
    expect(putSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(putSpy).toHaveBeenCalledWith('/api/settings/engineer', expect.anything(), withClientId);
    const body = engineerBody(putSpy);
    expect(body.tyre_wear_warn_pct).toBe(55);
    expect(body.version).toBe(0);
    expect(useRadioSettingsStore.getState().engineerVersion).toBe(1);
  });

  it('sends only the panel values, never what the server derives or owns', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue(savedResponse(1));
    await useRadioSettingsStore.getState().syncConfigToBackend(true);

    const body = engineerBody(putSpy) as unknown as Record<string, unknown>;
    for (const serverOwned of ['enabled_categories', 'global_chatter_cooldown_ms', 'wing_damage_crit_pct', 'qualy_time_warn_sec']) {
      expect(body).not.toHaveProperty(serverOwned);
    }
    expect(Object.keys(body.alert_switches as object).sort()).toEqual([...ALERT_TOGGLE_KEYS].sort());
    expect(body.trigger_preset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
  });

  it('debounces rapid changes into one save and resolves every waiting caller', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue(savedResponse(1));
    const store = useRadioSettingsStore.getState();

    store.setTyreWearWarningPct(40);
    const first = store.syncConfigToBackend();
    store.setTyreWearWarningPct(50);
    const second = store.syncConfigToBackend();
    store.setTyreWearWarningPct(55);

    let resolved = 0;
    void first.then(() => resolved++);
    void second.then(() => resolved++);

    await vi.advanceTimersByTimeAsync(500);

    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(engineerBody(putSpy).tyre_wear_warn_pct).toBe(55);
    expect(resolved).toBe(2);
  });

  it('saves a change made during a save right after it, with the new version', async () => {
    let finishFirst: (value: EngineerSettingsResponse) => void = () => {};
    const putSpy = vi
      .spyOn(api, 'put')
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve as typeof finishFirst)))
      .mockResolvedValue(savedResponse(2));
    const store = useRadioSettingsStore.getState();

    store.setTyreWearWarningPct(50);
    await vi.advanceTimersByTimeAsync(500);
    expect(putSpy).toHaveBeenCalledTimes(1);

    store.setTyreWearWarningPct(60);
    await vi.advanceTimersByTimeAsync(500);
    expect(putSpy).toHaveBeenCalledTimes(1); // waits for the first save

    finishFirst(savedResponse(1));
    await vi.advanceTimersByTimeAsync(0);

    expect(putSpy).toHaveBeenCalledTimes(2);
    const second = engineerBody(putSpy, 1);
    expect(second.version).toBe(1);
    expect(second.tyre_wear_warn_pct).toBe(60);
    expect(useRadioSettingsStore.getState().engineerVersion).toBe(2);
  });

  it('reports a failed save and still resolves', async () => {
    vi.spyOn(api, 'put').mockRejectedValue(new ApiError('failed to save race engineer settings', 500, 'Internal Server Error'));

    await useRadioSettingsStore.getState().syncConfigToBackend(true);

    expect(useSettingsSaveStore.getState().problem).toMatchObject({
      section: 'engineer',
      kind: 'failed',
      message: 'failed to save race engineer settings',
    });
  });

  it('reloads the newer settings when another device saved first', async () => {
    vi.spyOn(api, 'put').mockRejectedValue(new ApiError('changed on another device', 409, 'Conflict'));
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(
      serverSettings({ version: 7, tyre_wear_warn_pct: 33, trigger_preset: RADIO_TRIGGER_PRESETS.COACHING })
    );
    useRadioSettingsStore.getState().setTyreWearWarningPct(70);

    await vi.advanceTimersByTimeAsync(500);

    expect(getSpy).toHaveBeenCalledWith('/api/settings/engineer');
    const state = useRadioSettingsStore.getState();
    expect(state.tyreWearWarningPct).toBe(33);
    expect(state.engineerVersion).toBe(7);
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.COACHING);
    expect(useSettingsSaveStore.getState().problem).toMatchObject({ section: 'engineer', kind: 'conflict' });
  });

  it('handles tactical settings toggles and saves them', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue(savedResponse(1));
    const store = useRadioSettingsStore.getState();

    store.setSubTyreThermal(false);
    expect(useRadioSettingsStore.getState().subTyreThermal).toBe(false);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.CUSTOM);

    await vi.advanceTimersByTimeAsync(500);
    expect(engineerBody(putSpy).alert_switches?.subTyreThermal).toBe(false);
  });

  it('applies trigger presets cleanly (Immersive, Coaching, Minimal)', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue(savedResponse(1));
    const store = useRadioSettingsStore.getState();

    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.COACHING);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.COACHING);
    expect(useRadioSettingsStore.getState().chatterCooldownSeconds).toBe(20);
    expect(useRadioSettingsStore.getState().subTyreThermal).toBe(true);

    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.MINIMAL);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.MINIMAL);
    expect(useRadioSettingsStore.getState().chatterCooldownSeconds).toBe(90);
    expect(useRadioSettingsStore.getState().subTyreWear).toBe(false);
    expect(useRadioSettingsStore.getState().subTyrePuncture).toBe(true);

    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(useRadioSettingsStore.getState().chatterCooldownSeconds).toBe(45);
    expect(useRadioSettingsStore.getState().subTyreWear).toBe(true);
    expect(useRadioSettingsStore.getState().subTyreThermal).toBe(false);

    await vi.advanceTimersByTimeAsync(500);
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(engineerBody(putSpy).trigger_preset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
  });

  it('loads the saved settings from the server', async () => {
    const putSpy = vi.spyOn(api, 'put');
    vi.spyOn(api, 'get').mockResolvedValue(
      serverSettings({
        version: 4,
        chatter_cooldown_ms: 25000,
        smart_discretion_enabled: false,
        tyre_wear_warn_pct: 48,
        tyre_wear_crit_pct: 82,
        tyre_temp_margin_c: 8,
        alert_switches: { ...immersiveSwitches(), subTyreWear: true, subTyreThermal: true, subRain: false },
      })
    );

    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.engineerVersion).toBe(4);
    expect(state.chatterCooldownSeconds).toBe(25);
    expect(state.smartDiscretionEnabled).toBe(false);
    expect(state.tyreWearWarningPct).toBe(48);
    expect(state.tyreWearCriticalPct).toBe(82);
    expect(state.tyreTempMarginC).toBe(8);
    expect(state.subTyreWear).toBe(true);
    expect(state.subTyreThermal).toBe(true);
    expect(state.subRain).toBe(false);
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('gives switches added since the setup was saved their preset value, and saves them', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue(savedResponse(2));
    const addedSince = ['subAeroZones', 'subFlags'];
    const switches = Object.fromEntries(
      ALERT_TOGGLE_KEYS.filter((key) => !addedSince.includes(key)).map((key) => [
        key,
        TRIGGER_PRESET_VALUES.minimal[key],
      ])
    );
    vi.spyOn(api, 'get').mockResolvedValue(
      serverSettings({
        trigger_preset: RADIO_TRIGGER_PRESETS.MINIMAL,
        chatter_cooldown_ms: 90000,
        alert_switches: switches,
      })
    );

    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.MINIMAL);
    expect(state.subAeroZones).toBe(false);
    expect(state.subFlags).toBe(true);
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(engineerBody(putSpy).alert_switches?.subAeroZones).toBe(false);
    expect(engineerBody(putSpy).alert_switches?.subFlags).toBe(true);
  });

  it('turns on switches a custom setup was saved without, as the server does', async () => {
    vi.spyOn(api, 'put').mockResolvedValue(savedResponse(2));
    vi.spyOn(api, 'get').mockResolvedValue(
      serverSettings({ trigger_preset: RADIO_TRIGGER_PRESETS.CUSTOM, alert_switches: { subTyreWear: false } })
    );

    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.subTyreWear).toBe(false);
    expect(state.subAeroZones).toBe(true);
    expect(state.subSectorDelta).toBe(true);
  });

  it('starts on the Immersive preset with matching alert switches', () => {
    const state = useRadioSettingsStore.getState();
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    for (const key of ALERT_TOGGLE_KEYS) {
      expect(state[key]).toBe(TRIGGER_PRESET_VALUES.immersive[key]);
    }
    const settings = engineerSettingsFromValues(state);
    expect(settings.trigger_preset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(settings.alert_switches?.subTyreThermal).toBe(false);
  });

  it('restores category switches and preset after a reload', async () => {
    let saved: EngineerSettings | null = null;
    const putSpy = vi.spyOn(api, 'put').mockImplementation(async (_url, body) => {
      saved = body as EngineerSettings;
      return savedResponse(1);
    });
    const store = useRadioSettingsStore.getState();
    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.MINIMAL);
    store.setTyreAlertsEnabled(false);
    await useRadioSettingsStore.getState().syncConfigToBackend(true);

    expect(saved!.alert_switches?.tyreAlertsEnabled).toBe(false);
    expect(saved!.alert_switches?.subTyrePuncture).toBe(true);

    // Simulate a page reload
    useRadioSettingsStore.getState().resetStoreToDefaults();
    putSpy.mockClear();
    vi.spyOn(api, 'get').mockResolvedValue({ ...saved!, saved: true, version: 1 });
    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.MINIMAL);
    expect(state.tyreAlertsEnabled).toBe(false);
    expect(state.subTyrePuncture).toBe(true);
    expect(state.chatterCooldownSeconds).toBe(90);
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('works out the preset of settings saved without one', async () => {
    const minimal = TRIGGER_PRESET_VALUES.minimal;
    const switches = Object.fromEntries(ALERT_TOGGLE_KEYS.map((key) => [key, minimal[key]]));
    vi.spyOn(api, 'get').mockResolvedValue(
      serverSettings({
        chatter_cooldown_ms: minimal.chatterCooldownSeconds * 1000,
        trigger_preset: '',
        alert_switches: switches,
      })
    );

    await useRadioSettingsStore.getState().loadConfigFromBackend();

    expect(useRadioSettingsStore.getState().triggerPreset).toBe(RADIO_TRIGGER_PRESETS.MINIMAL);
  });

  it('keeps Immersive on a fresh install and saves it to the server', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue(savedResponse(1));
    vi.spyOn(api, 'get').mockResolvedValue(
      serverSettings({ saved: false, version: 0, trigger_preset: '', alert_switches: undefined, brake_overheat_c: 900 })
    );

    await useRadioSettingsStore.getState().loadConfigFromBackend();

    const state = useRadioSettingsStore.getState();
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(state.subTyreThermal).toBe(false);
    expect(putSpy).toHaveBeenCalledTimes(1);
    const body = engineerBody(putSpy);
    expect(body.alert_switches?.subTyreThermal).toBe(false);
    expect(body.version).toBe(0);
  });

  it('resets thresholds to the server defaults', async () => {
    vi.spyOn(api, 'put').mockResolvedValue(savedResponse(1));
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ brake_overheat_c: 950, undercut_gap_sec: 2.0 });
    const store = useRadioSettingsStore.getState();
    store.setBrakeOverheatC(1100);
    store.applyTriggerPreset(RADIO_TRIGGER_PRESETS.COACHING);

    await useRadioSettingsStore.getState().resetTriggerDefaults();

    expect(getSpy).toHaveBeenCalledWith('/api/settings/engineer/defaults');
    const state = useRadioSettingsStore.getState();
    expect(state.brakeOverheatC).toBe(950);
    expect(state.undercutGapSec).toBe(2.0);
    expect(state.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(state.subTyreThermal).toBe(false);
  });

  it('falls back to bundled defaults when the server defaults are unavailable', async () => {
    vi.spyOn(api, 'put').mockResolvedValue(savedResponse(1));
    vi.spyOn(api, 'get').mockRejectedValue(new Error('offline'));
    useRadioSettingsStore.getState().setBrakeOverheatC(1100);

    await useRadioSettingsStore.getState().resetTriggerDefaults();

    expect(useRadioSettingsStore.getState().brakeOverheatC).toBe(900);
  });

  it('reports a failed voice save', async () => {
    vi.spyOn(api, 'put').mockRejectedValue(new Error('offline'));
    useRadioSettingsStore.getState().setPersona(RADIO_PERSONAS.COLAPINTO);

    await vi.advanceTimersByTimeAsync(500);

    expect(useSettingsSaveStore.getState().problem).toMatchObject({ section: 'voice', kind: 'failed', message: 'offline' });
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
      expect.objectContaining({ persona: RADIO_PERSONAS.COLAPINTO, driver_callsign: 'Franco', speech_rate: 10 }),
      withClientId
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
