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
import { getNotHeardSpeech } from '../utils/radioPhrases';

class FakeSpeechRecognition {
  static last: FakeSpeechRecognition | null = null;
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: ISpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    FakeSpeechRecognition.last = this;
  }
  stop() {}
  abort() {
    this.onend?.();
  }
  hear(text: string) {
    this.onresult?.({ results: { length: 1, 0: { 0: { transcript: text } } } });
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
      useSessionStatusStore.getState().setSessionStatus({ session: mockSession() });
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

    it('shows the AI error sent in the stream instead of going silently idle', async () => {
      vi.spyOn(api, 'stream').mockImplementation(async () =>
        createMockSSEResponse([
          'data: {"error":"429 from upstream","code":"QUOTA_EXCEEDED","provider":"gemini","message":"Quota exceeded."}\n\n',
        ])
      );
      const { result } = renderHook(() => useRadioAudio());

      await askOverRadio(result, 'Gap to the car ahead?');

      expect(result.current.error).toBe('Quota exceeded.');
      expect(result.current.radioState).toBe('idle');
      expect(result.current.lastResponse).toBeNull();
    });

    it('shows the message of a failed request', async () => {
      vi.spyOn(api, 'stream').mockImplementation(
        async () =>
          new Response(JSON.stringify({ error: 'no key', code: 'MISSING_API_KEY', message: 'No API key configured.' }), {
            status: 400,
          })
      );
      const { result } = renderHook(() => useRadioAudio());

      await askOverRadio(result, 'Radio check');

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
        await Promise.resolve();
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
      const EDGE_UA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';

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

      const spoken = () => vi.mocked(radioAudio.speakRadioResponse).mock.calls.map((call) => call[0]);

      function notHeardLine(radioFault: boolean) {
        const { persona, driverCallsign } = useRadioSettingsStore.getState();
        return getNotHeardSpeech('en', persona, radioFault, driverCallsign);
      }

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

      it('says the radio is not working when Edge is hidden behind the game', async () => {
        vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(EDGE_UA);
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        const { result } = renderHook(() => useRadioAudio());

        await transmit(result, 1500);

        expect(spoken()).toEqual([notHeardLine(true)]);
        expect(result.current.error).toMatch(/^Edge stopped listening/);
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
      });
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
