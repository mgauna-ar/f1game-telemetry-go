import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRadioController } from './useRadioController';
import { RADIO_PERSONAS, RADIO_STORAGE_KEYS, RADIO_ALERT_CONSTANTS, RADIO_TRIGGER_PRESETS } from '../constants/f1';
import * as radioAudio from '../utils/radioAudio';

describe('useRadioController hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(radioAudio, 'playRadioBeep').mockResolvedValue();
    vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (_text, opts) => {
      opts?.onStart?.();
      opts?.onEnd?.();
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('initializes with default Bono persona and idle state', () => {
    const { result } = renderHook(() => useRadioController());

    expect(result.current.radioState).toBe('idle');
    expect(result.current.persona).toBe(RADIO_PERSONAS.BONO);
    expect(result.current.isRadioEnabled).toBe(true);
    expect(result.current.beepsEnabled).toBe(true);
    expect(result.current.filterEnabled).toBe(true);
  });

  it('updates persona and stores in localStorage', () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      result.current.setPersona(RADIO_PERSONAS.COLAPINTO);
    });

    expect(result.current.persona).toBe(RADIO_PERSONAS.COLAPINTO);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.PERSONA)).toBe(RADIO_PERSONAS.COLAPINTO);
  });

  it('updates volume with clamping', () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      result.current.setVolume(1.5);
    });
    expect(result.current.volume).toBe(1.0);

    act(() => {
      result.current.setVolume(-0.2);
    });
    expect(result.current.volume).toBe(0.0);
  });

  it('triggers test radio transmission', async () => {
    const { result } = renderHook(() => useRadioController());

    await act(async () => {
      await result.current.testRadioTransmission();
    });

    expect(radioAudio.speakRadioResponse).toHaveBeenCalled();
    expect(result.current.lastResponse).toContain('Radio check');
  });

  it('speaks messages and handles radio state progression', async () => {
    const onResponseReceived = vi.fn();
    const { result } = renderHook(() =>
      useRadioController({ onResponseReceived })
    );

    await act(async () => {
      await result.current.speakMessage('P2, gap is 1.4s to leader');
    });

    expect(onResponseReceived).toHaveBeenCalledWith('P2, gap is 1.4s to leader');
    expect(result.current.lastResponse).toBe('P2, gap is 1.4s to leader');
    expect(result.current.radioState).toBe('idle');
  });

  it('updates radio language independently of persona', async () => {
    const { result } = renderHook(() => useRadioController());

    expect(result.current.radioLanguage).toBe('auto');

    act(() => {
      result.current.setRadioLanguage('en');
    });

    expect(result.current.radioLanguage).toBe('en');
    expect(result.current.effectiveLanguage).toBe('en');
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.LANGUAGE)).toBe('en');

    // Test transmission with default Bono in English
    await act(async () => {
      await result.current.testRadioTransmission();
    });

    expect(result.current.lastResponse).toContain('Hammer time');
  });

  it('supports Bono persona speaking Spanish', async () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      result.current.setPersona(RADIO_PERSONAS.BONO);
      result.current.setRadioLanguage('es');
    });

    expect(result.current.persona).toBe(RADIO_PERSONAS.BONO);
    expect(result.current.effectiveLanguage).toBe('es');

    await act(async () => {
      await result.current.testRadioTransmission();
    });

    expect(result.current.lastResponse).toContain('Modo carrera activado');
  });

  it('updates driver callsign and stores in localStorage', () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      result.current.setDriverCallsign('Max');
    });

    expect(result.current.driverCallsign).toBe('Max');
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.DRIVER_CALLSIGN)).toBe('Max');
  });

  it('updates speech rate and pitch with clamping and passes to speakRadioResponse', async () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      result.current.setSpeechRate(15);
      result.current.setSpeechPitch(-6);
      result.current.setStaticFxEnabled(true);
    });

    expect(result.current.speechRate).toBe(15);
    expect(result.current.speechPitch).toBe(-6);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.SPEECH_RATE)).toBe('15');
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.SPEECH_PITCH)).toBe('-6');

    await act(async () => {
      await result.current.speakMessage('Box this lap');
    });

    expect(radioAudio.speakRadioResponse).toHaveBeenCalledWith(
      'Box this lap',
      expect.objectContaining({
        rate: '+15%',
        pitch: '-6Hz',
        enableStaticFx: true,
      })
    );
  });

  it('manages trigger thresholds, chatter cooldown, and smart discretion', () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      result.current.setSmartDiscretionEnabled(false);
      result.current.setChatterCooldownSeconds(30);
      result.current.setTyreWearWarningPct(35);
      result.current.setTyreWearCriticalPct(70);
      result.current.setRivalGapThresholdSec(1.5);
      result.current.setRainHorizonMin(8);
      result.current.setThermalAlertsEnabled(true);
      result.current.setPitWindowAlertsEnabled(true);
    });

    expect(result.current.smartDiscretionEnabled).toBe(false);
    expect(result.current.chatterCooldownSeconds).toBe(30);
    expect(result.current.tyreWearWarningPct).toBe(35);
    expect(result.current.tyreWearCriticalPct).toBe(70);
    expect(result.current.rivalGapThresholdSec).toBe(1.5);
    expect(result.current.rainHorizonMin).toBe(8);
    expect(result.current.thermalAlertsEnabled).toBe(true);
    expect(result.current.pitWindowAlertsEnabled).toBe(true);
  });

  it('applies quick style presets and configures all subsystems accordingly', () => {
    const { result } = renderHook(() => useRadioController());

    // Apply Coaching preset (all active, chatter 20s)
    act(() => {
      result.current.applyTriggerPreset(RADIO_TRIGGER_PRESETS.COACHING);
    });

    expect(result.current.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.COACHING);
    expect(result.current.damageAlertsEnabled).toBe(true);
    expect(result.current.ersAlertsEnabled).toBe(true);
    expect(result.current.brakesAlertsEnabled).toBe(true);
    expect(result.current.fuelAlertsEnabled).toBe(true);
    expect(result.current.chatterCooldownSeconds).toBe(20);
    expect(result.current.subDamageFloor).toBe(true);
    expect(result.current.subErsLow).toBe(true);

    // Apply Minimal preset (critical alerts only, chatter 90s)
    act(() => {
      result.current.applyTriggerPreset(RADIO_TRIGGER_PRESETS.MINIMAL);
    });

    expect(result.current.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.MINIMAL);
    expect(result.current.ersAlertsEnabled).toBe(false);
    expect(result.current.brakesAlertsEnabled).toBe(false);
    expect(result.current.chatterCooldownSeconds).toBe(90);
    expect(result.current.subDamageFloor).toBe(false);
    expect(result.current.subDamageWing).toBe(true); // Retains critical damage
  });

  it('resets trigger defaults back to factory settings', () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      result.current.setWingDamageWarnPct(40);
      result.current.setTyreOverheatC(130);
      result.current.resetTriggerDefaults();
    });

    expect(result.current.triggerPreset).toBe(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    expect(result.current.wingDamageWarnPct).toBe(RADIO_ALERT_CONSTANTS.DEFAULT_WING_DAMAGE_WARN_PCT);
    expect(result.current.tyreOverheatC).toBe(RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_OVERHEAT_C);
  });

  it('triggers audio tests for specific subsystems without proactive debug prefixes', async () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      result.current.setRadioLanguage('es');
    });

    await act(async () => {
      await result.current.testTriggerAlert('damage');
    });

    expect(result.current.lastResponse).toContain('alerón delantero');
    expect(result.current.lastResponse).not.toContain('PROACTIVE');
    expect(result.current.lastResponse).not.toContain('PIT WALL');
    expect(result.current.lastResponse).toBe(
      'Daño en el alerón delantero detectado. Vas a sentir subviraje en curva media y rápida.'
    );
  });
});
