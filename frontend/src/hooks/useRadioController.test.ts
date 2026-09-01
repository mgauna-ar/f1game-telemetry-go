import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRadioController } from './useRadioController';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { RADIO_PERSONAS, RADIO_STORAGE_KEYS, RADIO_LANGUAGES } from '../constants/f1';
import * as radioAudio from '../utils/radioAudio';

describe('useRadioController hook', () => {
  beforeEach(() => {
    localStorage.clear();
    useRadioSettingsStore.getState().resetStoreToDefaults();
    vi.clearAllMocks();
    vi.spyOn(radioAudio, 'playRadioBeep').mockResolvedValue();
    vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (_text, opts) => {
      opts?.onStart?.();
      opts?.onEnd?.();
    });
  });

  afterEach(() => {
    localStorage.clear();
    useRadioSettingsStore.getState().resetStoreToDefaults();
    vi.restoreAllMocks();
  });

  it('initializes with default Bono persona and idle state', () => {
    const { result } = renderHook(() => useRadioController());

    expect(result.current.radioState).toBe('idle');
    expect(result.current.persona).toBe(RADIO_PERSONAS.BONO);
    expect(result.current.isRadioEnabled).toBe(true);
    expect(result.current.driverCallsign).toBe('');
  });

  it('updates persona and reacts to store updates', () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      useRadioSettingsStore.getState().setPersona(RADIO_PERSONAS.COLAPINTO);
    });

    expect(result.current.persona).toBe(RADIO_PERSONAS.COLAPINTO);
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.PERSONA)).toBe(RADIO_PERSONAS.COLAPINTO);
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

    act(() => {
      useRadioSettingsStore.getState().setRadioLanguage(RADIO_LANGUAGES.EN);
    });

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
      useRadioSettingsStore.getState().setPersona(RADIO_PERSONAS.BONO);
      useRadioSettingsStore.getState().setRadioLanguage(RADIO_LANGUAGES.ES);
    });

    expect(result.current.persona).toBe(RADIO_PERSONAS.BONO);
    expect(result.current.effectiveLanguage).toBe('es');

    await act(async () => {
      await result.current.testRadioTransmission();
    });

    expect(result.current.lastResponse).toContain('Modo carrera activado');
  });

  it('updates driver callsign via store', () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      useRadioSettingsStore.getState().setDriverCallsign('Max');
    });

    expect(result.current.driverCallsign).toBe('Max');
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.DRIVER_CALLSIGN)).toBe('Max');
  });

  it('triggers audio tests for specific subsystems without proactive debug prefixes', async () => {
    const { result } = renderHook(() => useRadioController());

    act(() => {
      useRadioSettingsStore.getState().setRadioLanguage(RADIO_LANGUAGES.ES);
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
