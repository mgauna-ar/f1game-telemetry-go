import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRadioAudio } from './useRadioAudio';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { RADIO_LANGUAGES } from '../constants/f1';
import * as radioAudio from '../utils/radioAudio';

describe('useRadioAudio hook', () => {
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

  it('initializes in idle state with correct effective language', () => {
    const { result } = renderHook(() => useRadioAudio());

    expect(result.current.radioState).toBe('idle');
    expect(result.current.effectiveLanguage).toBe('en');
    expect(result.current.lastTranscript).toBeNull();
    expect(result.current.lastResponse).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('speaks messages and triggers response callbacks', async () => {
    const onResponseReceived = vi.fn();
    const { result } = renderHook(() => useRadioAudio({ onResponseReceived }));

    await act(async () => {
      await result.current.speakMessage('P1 Sebastian, P1! Bring it home!');
    });

    expect(onResponseReceived).toHaveBeenCalledWith('P1 Sebastian, P1! Bring it home!');
    expect(result.current.lastResponse).toBe('P1 Sebastian, P1! Bring it home!');
    expect(result.current.radioState).toBe('idle');
    expect(radioAudio.speakRadioResponse).toHaveBeenCalled();
  });

  it('tests alert messages for triggers in spanish and english', async () => {
    const { result } = renderHook(() => useRadioAudio());

    act(() => {
      useRadioSettingsStore.getState().setRadioLanguage(RADIO_LANGUAGES.ES);
    });

    await act(async () => {
      await result.current.testTriggerAlert('tyres');
    });

    expect(result.current.lastResponse).toContain('Desgaste');

    act(() => {
      useRadioSettingsStore.getState().setRadioLanguage(RADIO_LANGUAGES.EN);
    });

    await act(async () => {
      await result.current.testTriggerAlert('tyres');
    });

    expect(result.current.lastResponse).toContain('Tyre wear');
  });

  it('stops radio speech cleanly', () => {
    const stopSpy = vi.spyOn(radioAudio, 'stopRadioSpeech').mockImplementation(() => {});
    const { result } = renderHook(() => useRadioAudio());

    act(() => {
      result.current.stopRadio();
    });

    expect(stopSpy).toHaveBeenCalled();
    expect(result.current.radioState).toBe('idle');
  });
});
