import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRadioAudio } from './useRadioAudio';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { RADIO_LANGUAGES } from '../constants/f1';
import * as radioAudio from '../utils/radioAudio';
import type { ISpeechRecognitionEvent } from '../utils/radioAudio';
import { api } from '../utils/apiClient';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { SESSION_TYPES } from '../constants/f1';
import type { SessionData } from '../types/telemetry';

class FakeSpeechRecognition {
  static last: FakeSpeechRecognition | null = null;
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: ISpeechRecognitionEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    FakeSpeechRecognition.last = this;
  }
  stop() {}
  abort() {}
  static say(text: string) {
    FakeSpeechRecognition.last?.onresult?.({ results: { length: 1, 0: { 0: { transcript: text } } } });
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
  return {
    Weather: 0,
    TrackTemperature: 30,
    AirTemperature: 22,
    TotalLaps: 50,
    TrackLength: 5800,
    SessionType: SESSION_TYPES.RACE,
    TrackId: 7,
    SessionTimeLeft: 3600,
    SessionDuration: 7200,
    SafetyCarStatus: 0,
    SessionUID: '0xabc',
    ...overrides,
  };
}

interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  context: { session_type?: string; track_name?: string };
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

    function requestBody(call: number): ChatRequestBody {
      return vi.mocked(api.stream).mock.calls[call][1] as ChatRequestBody;
    }

    it('sends the session type and track so the engineer knows the session', async () => {
      vi.spyOn(api, 'stream').mockImplementation(async () => createMockSSEResponse(['data: {"text":"Copy."}\n\n']));
      const { result } = renderHook(() => useRadioAudio());

      await askOverRadio(result, 'How are the tyres?');

      const body = requestBody(0);
      expect(body.context.session_type).toBe('Grand Prix Race');
      expect(body.context.track_name).toBe('Silverstone');
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
