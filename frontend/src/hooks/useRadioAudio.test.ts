import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRadioAudio } from './useRadioAudio';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import type { AIChatRequest } from '../types/ai';
import { RADIO_LANGUAGES } from '../constants/f1';
import * as radioAudio from '../utils/radioAudio';
import type { ISpeechRecognitionEvent } from '../utils/radioAudio';
import { api } from '../utils/apiClient';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { SESSION_TYPES } from '../constants/f1';
import type { SessionData } from '../types/telemetry';
import { makeLiveSession } from '../test/wireFactories';
import { getExchangeSpeech } from '../utils/radioPhrases';
import type { ExchangeLine, PTTTraceRequest } from '../types/telemetry';

class FakeSpeechRecognition {
  static last: FakeSpeechRecognition | null = null;
  /** Like a browser, end a moment after stop(); off to send words after the release. */
  static endOnStop = true;
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: ISpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  start() {
    FakeSpeechRecognition.last = this;
  }
  stop() {
    if (FakeSpeechRecognition.endOnStop) queueMicrotask(() => this.onend?.());
  }
  abort() {
    this.onend?.();
  }
  hear(text: string) {
    this.hearSegments([text]);
  }
  /** Results for a question said with pauses in it, one segment each. */
  hearSegments(segments: string[]) {
    const results: ISpeechRecognitionEvent['results'] = { length: segments.length };
    segments.forEach((transcript, i) => {
      results[i] = { 0: { transcript } };
    });
    this.onaudiostart?.();
    this.onspeechstart?.();
    this.onresult?.({ results });
  }
  static say(text: string) {
    FakeSpeechRecognition.last?.hear(text);
  }
  /** The recognizer reports an error, as browsers do before ending. */
  static fail(error: string) {
    FakeSpeechRecognition.last?.onerror?.({ error });
  }
  /** The recognizer ends, after its last words. */
  static end() {
    FakeSpeechRecognition.last?.onend?.();
  }
}

function createMockSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function mockSession(overrides: Partial<SessionData> = {}): SessionData {
  return makeLiveSession({
    Weather: 0,
    TrackTemperature: 30,
    AirTemperature: 22,
    TotalLaps: 50,
    SessionType: SESSION_TYPES.RACE,
    TrackId: 7,
    SessionTimeLeft: 3600,
    SafetyCarStatus: 0,
    SessionUID: '0xabc',
    ...overrides,
  });
}

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

  describe('push-to-talk questions', () => {
    beforeEach(() => {
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeSpeechRecognition;
      FakeSpeechRecognition.endOnStop = true;
      useSessionStatusStore.getState().setSessionStatus({ session: mockSession() });
      vi.spyOn(api, 'post').mockResolvedValue({});
    });

    afterEach(() => {
      delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
      useSessionStatusStore.getState().resetSession();
    });

    async function askOverRadio(result: { current: ReturnType<typeof useRadioAudio> }, question: string) {
      act(() => {
        result.current.onPTTPress();
      });
      act(() => {
        FakeSpeechRecognition.say(question);
      });
      await act(async () => {
        await result.current.onPTTRelease();
      });
    }

    function requestBody(call: number): AIChatRequest {
      return vi.mocked(api.stream).mock.calls[call][1] as AIChatRequest;
    }

    const spoken = () => vi.mocked(radioAudio.speakRadioResponse).mock.calls.map((call) => call[0]);

    /** What the engineer says for this line with the default settings, given Math.random is 0. */
    function exchangeLine(line: ExchangeLine) {
      const { persona, driverCallsign } = useRadioSettingsStore.getState();
      return getExchangeSpeech(line, 'en', persona, driverCallsign);
    }

    /** The push-to-talk traces sent to the app log. */
    const traces = () =>
      vi
        .mocked(api.post)
        .mock.calls.filter(([path]) => path === '/api/ai/ptt/trace')
        .map(([, body]) => body as PTTTraceRequest);

    it('sends only the live context mode; the server builds the race briefing and phase', async () => {
      vi.spyOn(api, 'stream').mockImplementation(async () => createMockSSEResponse(['data: {"text":"Copy."}\n\n']));
      const { result } = renderHook(() => useRadioAudio());

      await askOverRadio(result, 'How are the tyres?');

      const body = requestBody(0);
      expect(body.context).toEqual({ context_mode: 'live' });
      expect(body.language).toBe('en');
      expect(body).not.toHaveProperty('provider');
    });

    it('remembers earlier exchanges in the same session', async () => {
      const replies = ['Gap to Leclerc is 1.2 seconds.', 'Car behind is Norris, 0.8 back.'];
      vi.spyOn(api, 'stream').mockImplementation(async () =>
        createMockSSEResponse([`data: ${JSON.stringify({ text: replies.shift() })}\n\n`])
      );
      const { result } = renderHook(() => useRadioAudio());

      await askOverRadio(result, 'Gap to the car ahead?');
      await askOverRadio(result, 'And behind?');

      const second = requestBody(1);
      expect(second.messages).toEqual([
        { role: 'user', content: '[DRIVER RADIO TRANSMISSION]: "Gap to the car ahead?"' },
        { role: 'assistant', content: 'Gap to Leclerc is 1.2 seconds.' },
        { role: 'user', content: '[DRIVER RADIO TRANSMISSION]: "And behind?"' },
      ]);
    });

    it('speaks each sentence of the answer as it streams in', async () => {
      vi.spyOn(api, 'stream').mockImplementation(async () =>
        createMockSSEResponse([
          'data: {"text":"Gap to Leclerc is 1."}\n\n',
          'data: {"text":"2 seconds and closing. Norris is "}\n\n',
          'data: {"text":"0.8 behind."}\n\n',
          'data: [DONE]\n\n',
        ])
      );
      const { result } = renderHook(() => useRadioAudio());

      await askOverRadio(result, 'Gaps?');

      const spoken = vi.mocked(radioAudio.speakRadioResponse).mock.calls.map((call) => call[0]);
      expect(spoken).toEqual(['Gap to Leclerc is 1.2 seconds and closing.', 'Norris is 0.8 behind.']);
      expect(result.current.lastResponse).toBe('Gap to Leclerc is 1.2 seconds and closing. Norris is 0.8 behind.');
      expect(result.current.radioState).toBe('idle');
    });

    it('says the pit wall has no answer and shows the AI error sent in the stream', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      vi.spyOn(api, 'stream').mockImplementation(async () =>
        createMockSSEResponse([
          'data: {"error":"429 from upstream","code":"QUOTA_EXCEEDED","provider":"gemini","message":"Quota exceeded."}\n\n',
        ])
      );
      const { result } = renderHook(() => useRadioAudio());

      await askOverRadio(result, 'Gap to the car ahead?');

      expect(spoken()).toEqual([exchangeLine('answer_failed')]);
      expect(result.current.error).toBe('Quota exceeded.');
      expect(result.current.radioState).toBe('idle');
      expect(traces()).toEqual([
        expect.objectContaining({ outcome: 'answer_failed', ai_error: 'Quota exceeded.', heard: 'Gap to the car ahead?' }),
      ]);
    });

    it('shows the message of a failed request', async () => {
      vi.spyOn(api, 'stream').mockImplementation(
        async () =>
          new Response(JSON.stringify({ error: 'no key', code: 'MISSING_API_KEY', message: 'No API key configured.' }), {
            status: 400,
          })
      );
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const { result } = renderHook(() => useRadioAudio());

      await askOverRadio(result, 'Radio check');

      expect(spoken()).toEqual([exchangeLine('answer_failed')]);
      expect(result.current.error).toBe('No API key configured.');
      expect(result.current.radioState).toBe('idle');
    });

    it('drops the pending answer when the driver keys the radio again', async () => {
      const signals: AbortSignal[] = [];
      vi.spyOn(api, 'stream').mockImplementation(
        (_path, _body, signal) =>
          new Promise<Response>((_resolve, reject) => {
            const s = signal as AbortSignal;
            signals.push(s);
            s.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          })
      );
      const { result } = renderHook(() => useRadioAudio());

      act(() => {
        result.current.onPTTPress();
      });
      act(() => {
        FakeSpeechRecognition.say('Gap to the car ahead?');
      });
      let pending!: Promise<void>;
      act(() => {
        pending = result.current.onPTTRelease();
      });
      await act(async () => {
        await vi.waitFor(() => expect(signals).toHaveLength(1));
      });
      expect(result.current.radioState).toBe('processing');

      act(() => {
        result.current.onPTTPress();
      });
      await act(async () => {
        await pending;
      });

      expect(signals[0].aborted).toBe(true);
      expect(result.current.radioState).toBe('transmitting');
      expect(result.current.error).toBeNull();
    });

    describe('when no words come through', () => {
      let now = 0;

      beforeEach(() => {
        now = 10_000;
        vi.spyOn(Date, 'now').mockImplementation(() => now);
        // The first phrase of each pool, so the spoken line can be compared.
        vi.spyOn(Math, 'random').mockReturnValue(0);
        vi.spyOn(api, 'stream');
      });

      // Holds the button for pressMs, lets the recognizer act after the release, then waits for it.
      async function transmit(
        result: { current: ReturnType<typeof useRadioAudio> },
        pressMs: number,
        afterRelease: () => void = () => FakeSpeechRecognition.end()
      ) {
        act(() => {
          result.current.onPTTPress();
        });
        now += pressMs;
        let released!: Promise<void>;
        act(() => {
          released = result.current.onPTTRelease();
        });
        act(afterRelease);
        await act(async () => {
          await released;
        });
      }

      const notHeardLine = (radioFault: boolean) => exchangeLine(radioFault ? 'radio_fault' : 'say_again');

      it('asks the driver to say again after a press that heard nothing', async () => {
        const { result } = renderHook(() => useRadioAudio());

        await transmit(result, 1200);

        expect(spoken()).toEqual([notHeardLine(false)]);
        expect(result.current.error).toBe('Nothing heard on your last transmission.');
        expect(api.stream).not.toHaveBeenCalled();
        expect(result.current.radioState).toBe('idle');
      });

      it('says nothing about a short accidental tap', async () => {
        const { result } = renderHook(() => useRadioAudio());

        await transmit(result, 200);

        expect(spoken()).toEqual([]);
        expect(result.current.error).toBeNull();
        expect(result.current.radioState).toBe('idle');
      });

      it('says the radio is not working when the microphone is blocked, however short the press', async () => {
        const { result } = renderHook(() => useRadioAudio());

        await transmit(result, 200, () => {
          FakeSpeechRecognition.fail('not-allowed');
          FakeSpeechRecognition.end();
        });

        expect(spoken()).toEqual([notHeardLine(true)]);
        expect(result.current.error).toMatch(/microphone is blocked/);
      });

      it('says the radio is not working without speech recognition in the browser', async () => {
        delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
        const { result } = renderHook(() => useRadioAudio());

        await transmit(result, 800, () => {});

        expect(spoken()).toEqual([notHeardLine(true)]);
        expect(result.current.error).toBe('Speech Recognition is not supported in this browser.');
      });

      it('waits for the words that arrive after the release', async () => {
        vi.mocked(api.stream).mockImplementation(async () => createMockSSEResponse(['data: {"text":"Copy."}\n\n']));
        FakeSpeechRecognition.endOnStop = false;
        const { result } = renderHook(() => useRadioAudio());

        act(() => {
          result.current.onPTTPress();
        });
        now += 1500;
        let released!: Promise<void>;
        act(() => {
          released = result.current.onPTTRelease();
        });
        // The recognizer's last words come a moment after the button is up.
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
        });
        act(() => {
          FakeSpeechRecognition.say('Box this lap?');
          FakeSpeechRecognition.end();
        });
        await act(async () => {
          await released;
        });

        expect(requestBody(0).messages).toEqual([
          { role: 'user', content: '[DRIVER RADIO TRANSMISSION]: "Box this lap?"' },
        ]);
        expect(result.current.error).toBeNull();
      });

      it('lets a new press take over from a release still waiting for words', async () => {
        vi.mocked(api.stream).mockImplementation(async () => createMockSSEResponse(['data: {"text":"Copy."}\n\n']));
        FakeSpeechRecognition.endOnStop = false;
        const { result } = renderHook(() => useRadioAudio());

        act(() => {
          result.current.onPTTPress();
        });
        const first = FakeSpeechRecognition.last!;
        now += 1500;
        let waiting!: Promise<void>;
        act(() => {
          waiting = result.current.onPTTRelease();
        });
        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.radioState).toBe('processing');

        // The new press aborts the first recognizer; its late words don't count.
        act(() => {
          result.current.onPTTPress();
        });
        await act(async () => {
          await waiting;
        });
        act(() => {
          first.hear('Stale words');
        });
        expect(result.current.radioState).toBe('transmitting');
        expect(result.current.lastTranscript).toBeNull();

        FakeSpeechRecognition.endOnStop = true;
        act(() => {
          FakeSpeechRecognition.say('Gap behind?');
        });
        await act(async () => {
          await result.current.onPTTRelease();
        });

        expect(api.stream).toHaveBeenCalledTimes(1);
        expect(requestBody(0).messages).toEqual([
          { role: 'user', content: '[DRIVER RADIO TRANSMISSION]: "Gap behind?"' },
        ]);
        expect(spoken()).not.toContain(notHeardLine(false));
        expect(traces().map((trace) => trace.outcome)).toEqual(['replaced', 'answered']);
      });

      it('reports a short tap to the app log without a word to the driver', async () => {
        const { result } = renderHook(() => useRadioAudio());

        await transmit(result, 200);

        expect(traces()).toEqual([
          expect.objectContaining({ outcome: 'tap', held_ms: 200, recognizer_started: true, results: 0 }),
        ]);
      });
    });

    describe('pit wall calls during a question', () => {
      let now = 0;

      beforeEach(() => {
        now = 10_000;
        vi.spyOn(Date, 'now').mockImplementation(() => now);
        vi.spyOn(api, 'stream').mockImplementation(async () =>
          createMockSSEResponse(['data: {"text":"Tyres look good."}\n\n'])
        );
      });

      it('wait while the driver talks and are said after the answer', async () => {
        const { result } = renderHook(() => useRadioAudio());

        act(() => {
          result.current.onPTTPress('global');
        });
        await act(async () => {
          await result.current.speakMessage('Car behind is within a second.');
        });
        expect(spoken()).toEqual([]);
        expect(result.current.radioState).toBe('transmitting');

        act(() => {
          FakeSpeechRecognition.say('How are the tyres?');
        });
        await act(async () => {
          await result.current.onPTTRelease('global');
        });

        expect(requestBody(0).messages).toEqual([
          { role: 'user', content: '[DRIVER RADIO TRANSMISSION]: "How are the tyres?"' },
        ]);
        expect(spoken()).toEqual(['Tyres look good.', 'Car behind is within a second.']);
        expect(traces()).toEqual([
          expect.objectContaining({
            outcome: 'answered',
            calls_held: 1,
            press_source: 'global',
            release_source: 'global',
          }),
        ]);
      });

      it('let an urgent call through once the driver lets go, and drop routine calls gone stale', async () => {
        const { result } = renderHook(() => useRadioAudio());

        act(() => {
          result.current.onPTTPress();
        });
        await act(async () => {
          await result.current.speakMessage('Puncture, box now.', true);
          await result.current.speakMessage('Gap ahead is two seconds.', false, undefined, 1000);
        });
        expect(spoken()).toEqual([]);

        act(() => {
          FakeSpeechRecognition.say('Gap ahead?');
        });
        now += 3000;
        await act(async () => {
          await result.current.onPTTRelease();
        });

        expect(spoken()).toEqual(['Puncture, box now.', 'Tyres look good.']);
      });

      it('are said right away when no question is under way', async () => {
        const { result } = renderHook(() => useRadioAudio());

        await act(async () => {
          await result.current.speakMessage('Car behind is within a second.');
        });

        expect(spoken()).toEqual(['Car behind is within a second.']);
      });
    });

    it('says stand by when the answer takes a while, then the answer', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      let answer!: (response: Response) => void;
      vi.spyOn(api, 'stream').mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          })
      );
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const { result } = renderHook(() => useRadioAudio());

        act(() => {
          result.current.onPTTPress();
        });
        act(() => {
          FakeSpeechRecognition.say('Should we box?');
        });
        let released!: Promise<void>;
        act(() => {
          released = result.current.onPTTRelease();
        });
        await act(async () => {
          await vi.waitFor(() => expect(api.stream).toHaveBeenCalled());
        });
        expect(spoken()).toEqual([]);

        await act(async () => {
          vi.advanceTimersByTime(2000);
        });
        expect(spoken()).toEqual([exchangeLine('stand_by')]);

        await act(async () => {
          answer(createMockSSEResponse(['data: {"text":"Box this lap."}\n\n']));
          await released;
        });
        expect(spoken()).toEqual([exchangeLine('stand_by'), 'Box this lap.']);
        expect(traces()).toEqual([expect.objectContaining({ outcome: 'answered', stand_by: true })]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('hears a question with a pause in it whole', async () => {
      vi.spyOn(api, 'stream').mockImplementation(async () => createMockSSEResponse(['data: {"text":"Copy."}\n\n']));
      const { result } = renderHook(() => useRadioAudio());

      act(() => {
        result.current.onPTTPress();
      });
      expect(FakeSpeechRecognition.last?.continuous).toBe(true);
      act(() => {
        FakeSpeechRecognition.last?.hearSegments(['Gap to the car ahead', ' and behind?']);
      });
      await act(async () => {
        await result.current.onPTTRelease();
      });

      expect(requestBody(0).messages).toEqual([
        { role: 'user', content: '[DRIVER RADIO TRANSMISSION]: "Gap to the car ahead and behind?"' },
      ]);
      expect(traces()).toEqual([
        expect.objectContaining({
          outcome: 'answered',
          heard: 'Gap to the car ahead and behind?',
          recognizer_started: true,
          audio_started: true,
          speech_detected: true,
          results: 1,
        }),
      ]);
    });

    it('forgets the conversation when a new session starts', async () => {
      vi.spyOn(api, 'stream').mockImplementation(async () => createMockSSEResponse(['data: {"text":"Copy."}\n\n']));
      const { result } = renderHook(() => useRadioAudio());

      await askOverRadio(result, 'Radio check');
      act(() => {
        useSessionStatusStore.getState().setSessionStatus({ session: mockSession({ SessionUID: '0xdef' }) });
      });
      await askOverRadio(result, 'Radio check again');

      expect(requestBody(1).messages).toEqual([
        { role: 'user', content: '[DRIVER RADIO TRANSMISSION]: "Radio check again"' },
      ]);
    });
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
