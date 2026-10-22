import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTTSPlayback } from './useTTSPlayback';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import * as radioAudio from '../utils/radioAudio';
import * as radioHeardReport from '../utils/radioHeardReport';
import type { SpokenCall } from '../utils/radioHeardReport';

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

  it('lets an urgent call finish: the next urgent call waits its turn, ahead of routine calls', async () => {
    const stopSpy = vi.spyOn(radioAudio, 'stopRadioSpeech').mockImplementation(() => {});
    const spokenMessages: string[] = [];
    let activeOnEnd: (() => void) | undefined;
    vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (text, opts) => {
      spokenMessages.push(text);
      activeOnEnd = opts?.onEnd;
    });
    const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

    await act(async () => {
      await result.current.speakMessage('Gap report', false);
      await result.current.speakMessage('Safety Car deployed', true); // cuts the routine call
      await result.current.speakMessage('Tyre wear is building', false); // waits
      await result.current.speakMessage('Yellow flag in this sector', true); // waits for the Safety Car call
    });
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(spokenMessages).toEqual(['Gap report', 'Safety Car deployed']);

    await act(async () => {
      activeOnEnd?.();
    });
    await act(async () => {
      activeOnEnd?.();
    });
    expect(spokenMessages).toEqual([
      'Gap report',
      'Safety Car deployed',
      'Yellow flag in this sector',
      'Tyre wear is building',
    ]);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('skips a queued call that went stale while other speech played', async () => {
    let activeOnEnd: (() => void) | undefined;
    const spokenMessages: string[] = [];
    vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (text, opts) => {
      spokenMessages.push(text);
      activeOnEnd = opts?.onEnd;
    });
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

    await act(async () => {
      await result.current.speakMessage('A long answer', false);
      await result.current.speakMessage('Car behind is within a second', false, undefined, 5000);
      await result.current.speakMessage('Tyre wear is high', false, undefined, 15000);
    });

    now.mockReturnValue(1_000_000 + 8000);
    await act(async () => {
      activeOnEnd?.();
    });

    expect(spokenMessages).toEqual(['A long answer', 'Tyre wear is high']);
  });

  it('makes room in a full queue by dropping stale calls, then the oldest routine call', async () => {
    let activeOnEnd: (() => void) | undefined;
    const spokenMessages: string[] = [];
    vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (text, opts) => {
      spokenMessages.push(text);
      activeOnEnd = opts?.onEnd;
    });
    vi.spyOn(radioAudio, 'prefetchRadioSpeech').mockImplementation(() => {});
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

    await act(async () => {
      await result.current.speakMessage('Gap report', false);
      await result.current.speakMessage('Tyre wear is building', false, undefined, 15000);
      await result.current.speakMessage('Car behind is within a second', false, undefined, 2000);
      await result.current.speakMessage('Fuel is on target', false, undefined, 15000);
    });
    now.mockReturnValue(1_000_000 + 3000);
    await act(async () => {
      await result.current.speakMessage('Brake bias is good', false, undefined, 15000); // the stale call makes room
    });
    await act(async () => {
      activeOnEnd?.();
    });
    expect(spokenMessages).toEqual(['Gap report', 'Tyre wear is building']);

    await act(async () => {
      await result.current.speakMessage('Engine temperature is high', false, undefined, 15000);
      await result.current.speakMessage('Rain in five minutes', false, undefined, 15000); // the oldest one goes
    });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        activeOnEnd?.();
      });
    }

    expect(spokenMessages).toEqual([
      'Gap report',
      'Tyre wear is building',
      'Brake bias is good',
      'Engine temperature is high',
      'Rain in five minutes',
    ]);
  });

  it('synthesizes the next queued call while one plays, and tells the player when it goes stale', async () => {
    let activeOnEnd: (() => void) | undefined;
    const expiries: (number | undefined)[] = [];
    vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (_text, opts) => {
      expiries.push(opts?.expiresAt);
      activeOnEnd = opts?.onEnd;
    });
    const prefetch = vi.spyOn(radioAudio, 'prefetchRadioSpeech').mockImplementation(() => {});
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

    await act(async () => {
      await result.current.speakMessage('Gap report', false);
      await result.current.speakMessage('Tyre wear is building', false, undefined, 15000);
      await result.current.speakMessage('Fuel is on target', false, undefined, 15000);
    });
    expect(prefetch.mock.calls.map((call) => call[0])).toEqual(['Tyre wear is building']);

    await act(async () => {
      activeOnEnd?.();
    });
    expect(prefetch.mock.calls.map((call) => call[0])).toEqual(['Tyre wear is building', 'Fuel is on target']);
    expect(expiries).toEqual([undefined, 1_000_000 + 15000]);
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

  describe('traffic calls and the radio report', () => {
    interface Clip {
      text: string;
      opts?: radioAudio.RadioSpeechOptions;
    }
    let clips: Clip[];
    let reports: MockInstance<typeof radioHeardReport.reportRadioHeard>;

    beforeEach(() => {
      clips = [];
      vi.spyOn(radioAudio, 'stopRadioSpeech').mockImplementation(() => {});
      vi.spyOn(radioAudio, 'prefetchRadioSpeech').mockImplementation(() => {});
      vi.spyOn(radioAudio, 'playRadioBeep').mockResolvedValue();
      vi.spyOn(radioAudio, 'speakRadioResponse').mockImplementation(async (text, opts) => {
        clips.push({ text, opts });
      });
      reports = vi.spyOn(radioHeardReport, 'reportRadioHeard').mockImplementation(() => {});
    });

    const spoken = () => clips.map((c) => c.text);
    const pitWall = (directiveId: string, cutIn = false): SpokenCall => ({
      directiveId,
      receivedAt: Date.now(),
      visible: true,
      cutIn,
    });
    /** Clip i starts speaking; with `toTheEnd`, its speech ends too (its closing beep is playing). */
    const speakClip = (i: number, toTheEnd = true) => {
      clips[i].opts?.onSynthesized?.(0, true);
      clips[i].opts?.onStart?.(0);
      if (toTheEnd) clips[i].opts?.onSpeechEnd?.();
    };
    const endClip = async (i: number) => {
      await act(async () => {
        clips[i].opts?.onEnd?.();
      });
    };
    const outcomes = () => reports.mock.calls.map(([r]) => `${r.directive_id}:${r.outcome}`);

    it('cuts the lap result for a traffic warning, then says the lap result again', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

      await act(async () => {
        await result.current.speakMessage('Lap result', true, undefined, 5000, pitWall('directive_1_qualy_lap_result'));
      });
      speakClip(0, false);
      now.mockReturnValue(1_003_000);
      await act(async () => {
        await result.current.speakMessage(
          'Push-lap car behind',
          true,
          undefined,
          2500,
          pitWall('directive_2_inlap_traffic_behind', true)
        );
      });
      expect(spoken()).toEqual(['Lap result', 'Push-lap car behind']);

      speakClip(1);
      now.mockReturnValue(1_009_000); // the warning took longer than the lap result's useful life
      await endClip(1);
      expect(spoken()).toEqual(['Lap result', 'Push-lap car behind', 'Lap result']);
      expect(clips[2].opts?.expiresAt).toBe(1_009_000 + 5000); // its useful life starts over
      expect(outcomes()).toEqual(['directive_2_inlap_traffic_behind:said']);
    });

    it('does not say the lap result again when only its closing beep was cut', async () => {
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

      await act(async () => {
        await result.current.speakMessage('Lap result', true, undefined, 5000, pitWall('directive_1_qualy_lap_result'));
      });
      speakClip(0);
      await act(async () => {
        await result.current.speakMessage(
          'Push-lap car behind',
          true,
          undefined,
          2500,
          pitWall('directive_2_inlap_traffic_behind', true)
        );
      });
      speakClip(1);
      await endClip(1);

      expect(spoken()).toEqual(['Lap result', 'Push-lap car behind']);
      expect(outcomes()).toEqual(['directive_1_qualy_lap_result:said', 'directive_2_inlap_traffic_behind:said']);
    });

    it('lets a traffic warning finish before the next one, which is synthesized while it waits', async () => {
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

      await act(async () => {
        await result.current.speakMessage(
          'First car behind',
          true,
          undefined,
          2500,
          pitWall('directive_1_inlap_traffic_behind', true)
        );
        await result.current.speakMessage(
          'Second car behind',
          true,
          undefined,
          2500,
          pitWall('directive_2_inlap_traffic_behind', true)
        );
      });
      expect(spoken()).toEqual(['First car behind']);
      expect(radioAudio.prefetchRadioSpeech).toHaveBeenCalledWith('Second car behind', expect.anything());

      speakClip(0);
      await endClip(0);
      expect(spoken()).toEqual(['First car behind', 'Second car behind']);
    });

    it('keeps an urgent call that came during a closing beep: the old call ends without taking the radio back', async () => {
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

      await act(async () => {
        await result.current.speakMessage('Gap report', false, undefined, 15000);
        await result.current.speakMessage('Tyre wear', false, undefined, 15000);
      });
      speakClip(0); // its closing beep is playing
      await act(async () => {
        await result.current.speakMessage(
          'Push-lap car behind',
          true,
          undefined,
          2500,
          pitWall('directive_3_inlap_traffic_behind', true)
        );
      });
      await endClip(0); // the gap report's beep ends late
      expect(spoken()).toEqual(['Gap report', 'Push-lap car behind']);

      speakClip(1);
      await endClip(1);
      expect(spoken()).toEqual(['Gap report', 'Push-lap car behind', 'Tyre wear']);
    });

    it("keeps an urgent call that came while an answer's closing beep played", async () => {
      let beepDone = () => {};
      vi.spyOn(radioAudio, 'playRadioBeep').mockImplementation(
        () => new Promise<void>((resolve) => (beepDone = resolve))
      );
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));
      let stream!: ReturnType<typeof result.current.beginReplyStream>;

      await act(async () => {
        stream = result.current.beginReplyStream();
        stream.pushSentence('Copy.');
      });
      await endClip(0); // the radio stays open for the rest of the answer
      await act(async () => {
        await result.current.speakMessage('Tyre wear', false, undefined, 15000);
        stream.finish(); // the closing beep starts
        await result.current.speakMessage(
          'Push-lap car behind',
          true,
          undefined,
          2500,
          pitWall('directive_4_inlap_traffic_behind', true)
        );
      });
      await act(async () => {
        beepDone();
      });

      expect(spoken()).toEqual(['Copy.', 'Push-lap car behind']);
    });

    it('reports what became of each call, with its timings', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const { result } = renderHook(() => useTTSPlayback({ effectiveLanguage: 'en' }));

      const traffic: SpokenCall = {
        directiveId: 'directive_5_inlap_traffic_behind',
        receivedAt: 999_950,
        visible: false,
        cutIn: true,
      };
      await act(async () => {
        await result.current.speakMessage('Push-lap car behind', true, undefined, 2500, traffic);
      });
      clips[0].opts?.onSynthesized?.(120, false);
      clips[0].opts?.onStart?.(180);
      now.mockReturnValue(1_002_000);
      clips[0].opts?.onSpeechEnd?.();
      await endClip(0);

      expect(reports).toHaveBeenCalledWith({
        directive_id: 'directive_5_inlap_traffic_behind',
        urgent: true,
        outcome: 'said',
        wait_ms: 50,
        start_ms: 230,
        synth_ms: 120,
        cached: false,
        speech_ms: 1820,
        visible: false,
      });

      // A routine call cut for an urgent one, a queued one gone stale, and one that failed.
      await act(async () => {
        await result.current.speakMessage('Gap report', false, undefined, 15000, pitWall('directive_6_gap_report'));
        await result.current.speakMessage('Tyre wear', false, undefined, 1000, pitWall('directive_7_tyre_wear'));
        await result.current.speakMessage('Safety Car', true, undefined, 15000, pitWall('directive_8_flags_sc'));
      });
      now.mockReturnValue(1_004_000);
      clips[2].opts?.onError?.(new Error('no voice'));
      await act(async () => {});

      expect(outcomes()).toEqual([
        'directive_5_inlap_traffic_behind:said',
        'directive_6_gap_report:cut',
        'directive_8_flags_sc:failed',
        'directive_7_tyre_wear:stale',
      ]);
    });
  });
});
