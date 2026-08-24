import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRadioController } from './useRadioController';
import { RADIO_PERSONAS, RADIO_STORAGE_KEYS } from '../constants/f1';
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

  it('initializes with default Colapinto persona and idle state', () => {
    const { result } = renderHook(() => useRadioController());

    expect(result.current.radioState).toBe('idle');
    expect(result.current.persona).toBe(RADIO_PERSONAS.COLAPINTO);
    expect(result.current.isRadioEnabled).toBe(true);
    expect(result.current.beepsEnabled).toBe(true);
    expect(result.current.filterEnabled).toBe(true);
  });

  it('updates persona and stores in localStorage', () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      result.current.setPersona(RADIO_PERSONAS.BONO);
    });

    expect(result.current.persona).toBe(RADIO_PERSONAS.BONO);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.PERSONA)).toBe(RADIO_PERSONAS.BONO);
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

    // Test transmission with Colapinto in English
    await act(async () => {
      await result.current.testRadioTransmission();
    });

    expect(result.current.lastResponse).toContain('Radio check mate');
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
});
