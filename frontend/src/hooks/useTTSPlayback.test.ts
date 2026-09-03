import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTTSPlayback } from './useTTSPlayback';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import * as radioAudio from '../utils/radioAudio';

describe('useTTSPlayback hook', () => {
  beforeEach(() => {
    localStorage.clear();
    useRadioSettingsStore.getState().resetStoreToDefaults();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    useRadioSettingsStore.getState().resetStoreToDefaults();
    vi.restoreAllMocks();
  });

  it('queues non-critical messages sequentially without clipping', async () => {
    let activeOnEnd: (() => void) | undefined;
    const spokenMessages: string[] = [];

    vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (text, opts) => {
      spokenMessages.push(text);
      activeOnEnd = opts?.onEnd;
    });

    const { result } = renderHook(() =>
      useTTSPlayback({ effectiveLanguage: 'en' })
    );

    // 1. Speak first message
    await act(async () => {
      await result.current.speakMessage('First directive: manage fuel delta', false);
    });

    expect(result.current.isSpeaking).toBe(true);
    expect(spokenMessages).toEqual(['First directive: manage fuel delta']);

    // 2. Speak second message while first is still speaking -> should NOT call speakRadioResponse yet
    await act(async () => {
      await result.current.speakMessage('Second directive: tyre wear is 45%', false);
    });

    expect(spokenMessages.length).toBe(1);

    // 3. First message finishes playback
    await act(async () => {
      activeOnEnd?.();
    });

    // Now second message should have been played from queue!
    expect(spokenMessages).toEqual([
      'First directive: manage fuel delta',
      'Second directive: tyre wear is 45%',
    ]);

    // 4. Second message finishes
    await act(async () => {
      activeOnEnd?.();
    });

    expect(result.current.isSpeaking).toBe(false);
  });

  it('immediately preempts active chatter upon emergency (forceInterrupt)', async () => {
    const stopSpy = vi.spyOn(radioAudio, 'stopRadioSpeech').mockImplementation(() => {});
    const spokenMessages: string[] = [];
    let activeOnEnd: (() => void) | undefined;

    vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (text, opts) => {
      spokenMessages.push(text);
      activeOnEnd = opts?.onEnd;
    });

    const { result } = renderHook(() =>
      useTTSPlayback({ effectiveLanguage: 'en' })
    );

    // 1. Speak non-critical message
    await act(async () => {
      await result.current.speakMessage('Non-critical chatter: track temp 32 degrees', false);
    });

    expect(spokenMessages).toEqual(['Non-critical chatter: track temp 32 degrees']);

    // 2. Critical emergency arrives with forceInterrupt = true
    await act(async () => {
      await result.current.speakMessage('Safety Car deployed! Box box box!', true);
    });

    // Must call stopRadioSpeech immediately and play the critical message
    expect(stopSpy).toHaveBeenCalled();
    expect(spokenMessages).toEqual([
      'Non-critical chatter: track temp 32 degrees',
      'Safety Car deployed! Box box box!',
    ]);

    // 3. Finish critical message
    await act(async () => {
      activeOnEnd?.();
    });
    expect(result.current.isSpeaking).toBe(false);
  });

  it('clears queue and stops audio on stopSpeech', async () => {
    const stopSpy = vi.spyOn(radioAudio, 'stopRadioSpeech').mockImplementation(() => {});
    vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async () => {});

    const { result } = renderHook(() =>
      useTTSPlayback({ effectiveLanguage: 'en' })
    );

    await act(async () => {
      await result.current.speakMessage('Test radio chatter', false);
    });

    act(() => {
      result.current.stopSpeech();
    });

    expect(stopSpy).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });
});
