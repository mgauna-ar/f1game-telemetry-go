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

  describe('streamed replies', () => {
    interface SpokenClip {
      text: string;
      beepStart?: boolean;
      beepEnd?: boolean;
      end: () => void;
    }
    let clips: SpokenClip[];
    let beeps: string[];

    beforeEach(() => {
      clips = [];
      beeps = [];
      vi.spyOn(radioAudio, 'stopRadioSpeech').mockImplementation(() => {});
      vi.spyOn(radioAudio, 'prefetchRadioSpeech').mockImplementation(() => {});
      vi.spyOn(radioAudio, 'playRadioBeep').mockImplementation(async (type) => {
        beeps.push(type);
      });
      vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (text, opts) => {
        clips.push({ text, beepStart: opts?.beepStart, beepEnd: opts?.beepEnd, end: () => opts?.onEnd?.() });
      });
    });

    const spoken = () => clips.map((c) => c.text);
    const endClip = async (i: number) => {
      await act(async () => {
        clips[i].end();
      });
    };

    it('speaks sentences in order with one opening and one closing beep', async () => {
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));
      let stream!: ReturnType<typeof result.current.beginReplyStream>;

      await act(async () => {
        stream = result.current.beginReplyStream();
        stream.pushSentence('Gap to Leclerc is 1.2 seconds.');
        stream.pushSentence('Norris is 0.8 behind.');
      });
      expect(spoken()).toEqual(['Gap to Leclerc is 1.2 seconds.']);
      expect(clips[0]).toMatchObject({ beepStart: true, beepEnd: false });
      expect(radioAudio.prefetchRadioSpeech).toHaveBeenCalledTimes(2);

      await endClip(0);
      expect(spoken()).toEqual(['Gap to Leclerc is 1.2 seconds.', 'Norris is 0.8 behind.']);
      expect(clips[1]).toMatchObject({ beepStart: false, beepEnd: false });
      expect(result.current.lastResponse).toBe('Gap to Leclerc is 1.2 seconds. Norris is 0.8 behind.');

      await act(async () => {
        stream.finish();
      });
      expect(beeps).toEqual([]);

      await endClip(1);
      expect(beeps).toEqual(['end']);
      expect(result.current.isSpeaking).toBe(false);
    });

    it('keeps the radio open while the next sentence is still being generated', async () => {
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));
      let stream!: ReturnType<typeof result.current.beginReplyStream>;

      await act(async () => {
        stream = result.current.beginReplyStream();
        stream.pushSentence('Copy.');
      });
      await endClip(0);
      expect(result.current.isSpeaking).toBe(true);
      expect(beeps).toEqual([]);

      await act(async () => {
        stream.pushSentence('Box this lap for hards.');
      });
      expect(spoken()).toEqual(['Copy.', 'Box this lap for hards.']);
      await endClip(1);
      expect(result.current.isSpeaking).toBe(true);

      await act(async () => {
        stream.finish();
      });
      expect(beeps).toEqual(['end']);
      expect(result.current.isSpeaking).toBe(false);
    });

    it('answers the driver before pit wall calls that were already queued', async () => {
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

      await act(async () => {
        await result.current.speakMessage('Track temp 32 degrees.');
        await result.current.speakMessage('Tyre wear 45% front left.');
      });
      await act(async () => {
        const stream = result.current.beginReplyStream();
        stream.pushSentence('Gap is 1.2.');
        stream.finish();
      });
      expect(spoken()).toEqual(['Track temp 32 degrees.']);

      await endClip(0);
      await endClip(1);
      expect(spoken()).toEqual(['Track temp 32 degrees.', 'Gap is 1.2.', 'Tyre wear 45% front left.']);
      expect(beeps).toEqual(['end']);
    });

    it('drops the rest of the reply when a critical call interrupts it', async () => {
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));
      let stream!: ReturnType<typeof result.current.beginReplyStream>;

      await act(async () => {
        stream = result.current.beginReplyStream();
        stream.pushSentence('Gap to Leclerc is 1.2 seconds.');
        stream.pushSentence('Norris is 0.8 behind.');
      });
      await act(async () => {
        await result.current.speakMessage('Safety Car deployed!', true);
      });
      await act(async () => {
        stream.pushSentence('Tyres are fine.');
        stream.finish();
      });
      await endClip(1);

      expect(spoken()).toEqual(['Gap to Leclerc is 1.2 seconds.', 'Safety Car deployed!']);
      expect(beeps).toEqual([]);
      expect(result.current.isSpeaking).toBe(false);
    });

    it('closes without a beep when the reply had nothing to say', async () => {
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));
      await act(async () => {
        const stream = result.current.beginReplyStream();
        stream.pushSentence('   ');
        stream.finish();
      });
      expect(spoken()).toEqual([]);
      expect(beeps).toEqual([]);
      expect(result.current.isSpeaking).toBe(false);
    });
  });
});
