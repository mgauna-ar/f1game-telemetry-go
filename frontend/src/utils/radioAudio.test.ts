import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  playRadioBeep,
  makeDistortionCurve,
  speakRadioResponse,
  playRadioAudioBuffer,
  stopRadioSpeech,
  cleanRadioSpeechText,
  normalizeSpanishRadioSpeech,
  isSpeechRecognitionSupported,
  getRadioAnalyserNode,
  connectMicrophoneToAnalyser,
  disconnectMicrophoneFromAnalyser,
  _resetAudioContextForTesting,
  prefetchRadioSpeech,
} from './radioAudio';
import { RADIO_AUDIO_CONSTANTS } from '../constants/f1';

describe('radioAudio utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAudioContextForTesting();
  });

  describe('cleanRadioSpeechText', () => {
    it('strips [PROACTIVE PIT WALL CALL: ...] prefix, brackets, and prompt instructions', () => {
      expect(
        cleanRadioSpeechText(
          '[PROACTIVE PIT WALL CALL: Desgaste en la delantera izquierda llegó al 45%. Cuidá la tracción en salida de curvas lentas.]'
        )
      ).toBe('Desgaste en la delantera izquierda llegó al 45%. Cuidá la tracción en salida de curvas lentas.');

      expect(
        cleanRadioSpeechText(
          '[PROACTIVE PIT WALL CALL: Front wing flap damage detected. Expect understeer in medium and high speed corners. You are initiating this call — do NOT say \'Entendido\' or \'Copy\'. Order driver to box immediately.]'
        )
      ).toBe('Front wing flap damage detected. Expect understeer in medium and high speed corners.');
    });

    it('strips leading [PROACTIVE PIT WALL CALL] without brackets', () => {
      expect(cleanRadioSpeechText('[PROACTIVE PIT WALL CALL] Box box box')).toBe('Box box box');
      expect(cleanRadioSpeechText('[PROACTIVE PIT WALL CALL: Box box box')).toBe('Box box box');
      expect(cleanRadioSpeechText('[DRIVER RADIO TRANSMISSION]: "Radio check"')).toBe('"Radio check"');
    });

    it('retains regular radio messages unaltered', () => {
      expect(cleanRadioSpeechText('Box this lap, confirm tyres.')).toBe('Box this lap, confirm tyres.');
      expect(cleanRadioSpeechText('  Radio check, loud and clear.  ')).toBe('Radio check, loud and clear.');
    });

    it('handles empty or blank input gracefully', () => {
      expect(cleanRadioSpeechText('')).toBe('');
      expect(cleanRadioSpeechText('   ')).toBe('');
    });
  });

  describe('normalizeSpanishRadioSpeech', () => {
    it('replaces Safety Car and Virtual Safety Car deployed with natural Spanish terms', () => {
      expect(normalizeSpanishRadioSpeech('Virtual Safety Car desplegado.')).toBe('Auto de seguridad virtual en pista.');
      expect(normalizeSpanishRadioSpeech('Safety Car desplegado en pista.')).toBe('Auto de seguridad en pista en pista.');
      expect(normalizeSpanishRadioSpeech('Full Safety Car desplegado')).toBe('Auto de seguridad en pista');
      expect(normalizeSpanishRadioSpeech('Tenemos Safety Car en pista')).toBe('Tenemos Auto de seguridad en pista');
      expect(normalizeSpanishRadioSpeech('VSC desplegado, mantén delta')).toBe('VSC en pista, mantén delta');
    });
  });

  describe('makeDistortionCurve', () => {
    it('generates a 256-sample Float32Array curve', () => {
      const curve = makeDistortionCurve(15);
      expect(curve).toBeInstanceOf(Float32Array);
      expect(curve.length).toBe(256);
      expect(curve[0]).toBeLessThan(0);
      expect(curve[255]).toBeGreaterThan(0);
    });

    it('returns linear curve when amount is 0', () => {
      const curve = makeDistortionCurve(0);
      expect(curve.length).toBe(256);
      expect(curve[0]).toBeCloseTo(-1, 2);
    });
  });

  describe('playRadioBeep', () => {
    it('resolves cleanly even if Web Audio API is not available or mocked', async () => {
      vi.stubGlobal('AudioContext', undefined);
      await expect(playRadioBeep('start')).resolves.toBeUndefined();
      await expect(playRadioBeep('end')).resolves.toBeUndefined();
    });

    it('creates oscillators and gain nodes when AudioContext is provided', async () => {
      const mockGainNode = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      const mockOscNode = {
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      const mockAudioContext = {
        currentTime: 0,
        destination: {},
        state: 'running',
        createGain: vi.fn(() => mockGainNode),
        createOscillator: vi.fn(() => mockOscNode),
        resume: vi.fn().mockResolvedValue(undefined),
      };

      class MockAudioContext {
        constructor() {
          return mockAudioContext;
        }
      }

      vi.stubGlobal('AudioContext', MockAudioContext);

      const promise = playRadioBeep('start', 0.8);
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      // The beep is over when its last tone ends: an audio event, not a timer.
      mockOscNode.onended?.();
      await promise;
    });

    it('still ends when the audio never runs, so nothing waits on it forever', async () => {
      vi.useFakeTimers();
      const mockOscNode = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      const mockAudioContext = {
        currentTime: 0,
        destination: {},
        state: 'suspended',
        createGain: vi.fn(() => ({
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        })),
        createOscillator: vi.fn(() => mockOscNode),
        resume: vi.fn().mockResolvedValue(undefined),
      };
      class MockAudioContext {
        constructor() {
          return mockAudioContext;
        }
      }
      vi.stubGlobal('AudioContext', MockAudioContext);

      let done = false;
      void playRadioBeep('end').then(() => (done = true));
      await vi.advanceTimersByTimeAsync(RADIO_AUDIO_CONSTANTS.AUDIO_END_FALLBACK_MS - 1);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(RADIO_AUDIO_CONSTANTS.BEEP_END_DURATION_S * 1000 + 1);
      expect(done).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('Neural TTS speech synthesis and Web Audio decoding', () => {
    it('detects microphone speech recognition capability', () => {
      expect(isSpeechRecognitionSupported()).toBe(false); // in jsdom default
    });

    it('calls /api/ai/tts and plays audio buffer through Web Audio API', async () => {
      const mockBuffer = new ArrayBuffer(1024);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
      } as unknown as Response);

      const mockSource = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
      };

      const mockGain = {
        gain: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      };

      const mockFilter = {
        type: 'bandpass',
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      };

      const mockShaper = {
        curve: null,
        oversample: '',
        connect: vi.fn(),
      };

      const mockAudioContext = {
        currentTime: 0,
        destination: {},
        state: 'running',
        decodeAudioData: vi.fn((_buf, success) => {
          success({} as AudioBuffer);
        }),
        createBufferSource: vi.fn(() => mockSource),
        createGain: vi.fn(() => mockGain),
        createBiquadFilter: vi.fn(() => mockFilter),
        createWaveShaper: vi.fn(() => mockShaper),
        resume: vi.fn().mockResolvedValue(undefined),
      };

      class MockAudioContext {
        constructor() {
          return mockAudioContext;
        }
      }
      vi.stubGlobal('AudioContext', MockAudioContext);

      const onStart = vi.fn();
      const onEnd = vi.fn();

      const speakPromise = speakRadioResponse('Box box, confirm tyres', {
        volume: 0.8,
        enableBeeps: false,
        enableCockpitFilter: true,
        onStart,
        onEnd,
      });

      // Allow microtask ticks
      await new Promise((r) => setTimeout(r, 10));

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/ai/tts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Box box, confirm tyres'),
        })
      );
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
      expect(mockSource.start).toHaveBeenCalled();
      expect(onStart).toHaveBeenCalled();

      // Trigger onended callback
      if (mockSource.onended) {
        mockSource.onended();
      }

      await speakPromise;
      expect(onEnd).toHaveBeenCalled();
    });

    it('stops active audio source on stopRadioSpeech', async () => {
      const mockSource = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
      };

      const mockAudioContext = {
        currentTime: 0,
        destination: {},
        state: 'running',
        decodeAudioData: vi.fn((_buf, success) => {
          success({} as AudioBuffer);
        }),
        createBufferSource: vi.fn(() => mockSource),
        createGain: vi.fn(() => ({
          gain: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        })),
        createBiquadFilter: vi.fn(() => ({
          type: 'bandpass',
          frequency: { setValueAtTime: vi.fn() },
          Q: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        })),
        createWaveShaper: vi.fn(() => ({
          curve: null,
          oversample: '',
          connect: vi.fn(),
        })),
        resume: vi.fn().mockResolvedValue(undefined),
      };

      class MockAudioContext {
        constructor() {
          return mockAudioContext;
        }
      }
      vi.stubGlobal('AudioContext', MockAudioContext);

      const playPromise = playRadioAudioBuffer(new ArrayBuffer(100), { enableBeeps: false });
      stopRadioSpeech();
      expect(mockSource.stop).toHaveBeenCalled();
      expect(mockSource.disconnect).toHaveBeenCalled();

      if (mockSource.onended) {
        mockSource.onended();
      }
      await playPromise;
    });

    it('uses memory cache on repeated speakRadioResponse calls without refetching', async () => {
      const mockBuffer = new ArrayBuffer(512);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
      } as unknown as Response);

      const mockAudioContext = {
        currentTime: 0,
        destination: {},
        state: 'running',
        decodeAudioData: vi.fn((_buf, success) => {
          success({} as AudioBuffer);
        }),
        createBufferSource: vi.fn(() => {
          const src = {
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(() => {
              setTimeout(() => src.onended?.(), 5);
            }),
            stop: vi.fn(),
            disconnect: vi.fn(),
            onended: null as (() => void) | null,
          };
          return src;
        }),
        createGain: vi.fn(() => ({
          gain: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        })),
        createBiquadFilter: vi.fn(() => ({
          type: 'bandpass',
          frequency: { setValueAtTime: vi.fn() },
          Q: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        })),
        createWaveShaper: vi.fn(() => ({
          curve: null,
          oversample: '',
          connect: vi.fn(),
        })),
        resume: vi.fn().mockResolvedValue(undefined),
      };

      class MockAudioContext {
        constructor() {
          return mockAudioContext;
        }
      }
      vi.stubGlobal('AudioContext', MockAudioContext);

      await speakRadioResponse('Safety Car deployed', { enableBeeps: false, enableStaticFx: false });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Second call with same message & settings should hit memory cache
      await speakRadioResponse('Safety Car deployed', { enableBeeps: false, enableStaticFx: false });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1); // No new network call
    });

    it('does not play a message stopped while its audio was being fetched', async () => {
      let resolveFetch: (r: Response) => void = () => {};
      globalThis.fetch = vi.fn(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));
      const onStart = vi.fn();
      const onEnd = vi.fn();
      const onError = vi.fn();

      const speaking = speakRadioResponse('Car behind on a push lap', { onStart, onEnd, onError, enableBeeps: false });
      stopRadioSpeech(); // an urgent call took the radio
      resolveFetch({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) } as unknown as Response);
      await speaking;

      expect(onStart).not.toHaveBeenCalled();
      expect(onEnd).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('does not play a call that went stale while its audio was synthesized', async () => {
      let resolveFetch: (r: Response) => void = () => {};
      globalThis.fetch = vi.fn(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const onStart = vi.fn();
      const onEnd = vi.fn();
      const onError = vi.fn();

      const speaking = speakRadioResponse('Car ahead within a second', {
        onStart,
        onEnd,
        onError,
        enableBeeps: false,
        expiresAt: 1_000_000 + 2000,
      });
      now.mockReturnValue(1_000_000 + 3000);
      resolveFetch({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) } as unknown as Response);
      await speaking;
      now.mockRestore();

      expect(onStart).not.toHaveBeenCalled();
      expect(onEnd).toHaveBeenCalledTimes(1); // the speech queue moves on
      expect(onError).not.toHaveBeenCalled();
    });

    it('ends at once when there is nothing to say, so the speech queue moves on', async () => {
      const onEnd = vi.fn();
      await speakRadioResponse('   ', { onEnd });
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('manages analyser node and microphone connection', () => {
      const mockAnalyser = {
        fftSize: 64,
        smoothingTimeConstant: 0.8,
        frequencyBinCount: 32,
        getByteFrequencyData: vi.fn(),
      };
      const mockMicSource = {
        connect: vi.fn(),
        disconnect: vi.fn(),
      };

      const mockAudioContext = {
        state: 'running',
        createAnalyser: vi.fn(() => mockAnalyser),
        createMediaStreamSource: vi.fn(() => mockMicSource),
      };

      class MockAudioContext {
        constructor() {
          return mockAudioContext;
        }
      }
      vi.stubGlobal('AudioContext', MockAudioContext);

      _resetAudioContextForTesting();
      const analyser = getRadioAnalyserNode();
      expect(analyser).toBeDefined();

      const mockStream = {} as MediaStream;
      connectMicrophoneToAnalyser(mockStream);
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockMicSource.connect).toHaveBeenCalledWith(mockAnalyser);

      disconnectMicrophoneFromAnalyser();
      expect(mockMicSource.disconnect).toHaveBeenCalled();
    });
  });

  describe('prefetchRadioSpeech', () => {
    const flush = () => new Promise((r) => setTimeout(r, 0));

    function mockTTSFetch() {
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      }));
      return globalThis.fetch as ReturnType<typeof vi.fn>;
    }

    it('shares one synthesis request between a prefetch and the playback that follows', async () => {
      const fetchMock = mockTTSFetch();
      vi.stubGlobal('AudioContext', undefined);

      prefetchRadioSpeech('Box this lap.', { persona: 'bono', language: 'en' });
      prefetchRadioSpeech('Box this lap.', { persona: 'bono', language: 'en' });
      await speakRadioResponse('Box this lap.', { persona: 'bono', language: 'en', onError: () => {} });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('/api/ai/tts', expect.objectContaining({ body: expect.stringContaining('Box this lap.') }));
    });

    it('keeps the audio cache bounded, dropping the oldest clips first', async () => {
      const fetchMock = mockTTSFetch();
      const limit = RADIO_AUDIO_CONSTANTS.TTS_CACHE_MAX_ENTRIES;

      for (let i = 0; i <= limit; i++) {
        prefetchRadioSpeech(`Sentence ${i}.`);
      }
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(limit + 1);

      prefetchRadioSpeech(`Sentence ${limit}.`);
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(limit + 1);

      prefetchRadioSpeech('Sentence 0.');
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(limit + 2);
    });

    it('keeps a clip that is used: the one used longest ago goes first', async () => {
      const fetchMock = mockTTSFetch();
      const limit = RADIO_AUDIO_CONSTANTS.TTS_CACHE_MAX_ENTRIES;

      for (let i = 0; i < limit; i++) {
        prefetchRadioSpeech(`Sentence ${i}.`);
      }
      await flush();
      prefetchRadioSpeech('Sentence 0.'); // a hit: used again
      prefetchRadioSpeech(`Sentence ${limit}.`);
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(limit + 1);

      prefetchRadioSpeech('Sentence 0.');
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(limit + 1);
      prefetchRadioSpeech('Sentence 1.');
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(limit + 2);
    });
  });

  describe('getting a call to the driver without timers', () => {
    interface MockSource {
      buffer: unknown;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      onended: (() => void) | null;
    }

    /** An audio context on the audio clock at `currentTime`, decoding at once unless `holdDecode`. */
    function mockRadioContext(currentTime: number, holdDecode = false) {
      const sources: MockSource[] = [];
      const oscillators: { start: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
      const decodes: (() => void)[] = [];
      const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
      const ctx = {
        currentTime,
        destination: {},
        state: 'running',
        decodeAudioData: vi.fn((_buf: ArrayBuffer, success: (b: AudioBuffer) => void) => {
          const decoded = () => success({ duration: 2 } as AudioBuffer);
          if (holdDecode) decodes.push(decoded);
          else decoded();
        }),
        createBufferSource: vi.fn(() => {
          const src: MockSource = {
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            disconnect: vi.fn(),
            onended: null,
          };
          sources.push(src);
          return src;
        }),
        createOscillator: vi.fn(() => {
          const osc = {
            type: 'sine',
            frequency: param(),
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null,
          };
          oscillators.push(osc);
          return osc;
        }),
        createGain: vi.fn(() => ({ gain: param(), connect: vi.fn() })),
        createBiquadFilter: vi.fn(() => ({
          type: '',
          frequency: param(),
          Q: param(),
          gain: param(),
          connect: vi.fn(),
        })),
        createWaveShaper: vi.fn(() => ({ curve: null, oversample: '', connect: vi.fn() })),
        resume: vi.fn().mockResolvedValue(undefined),
      };
      class MockAudioContext {
        constructor() {
          return ctx;
        }
      }
      vi.stubGlobal('AudioContext', MockAudioContext);
      return { sources, oscillators, decodes };
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('schedules the opening beep and the speech on the audio clock, with no timer before the first word', async () => {
      vi.useFakeTimers();
      const { sources, oscillators } = mockRadioContext(10);
      const onStart = vi.fn();

      void playRadioAudioBuffer(new ArrayBuffer(8), { enableBeeps: true, onStart });

      const beep = RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S * 2 + RADIO_AUDIO_CONSTANTS.BEEP_START_GAP_S;
      expect(oscillators[0].start).toHaveBeenCalledWith(10);
      expect(sources[0].start).toHaveBeenCalledTimes(1);
      expect(sources[0].start.mock.calls[0][0]).toBeCloseTo(10 + beep, 6);
      expect(onStart.mock.calls[0][0]).toBeCloseTo(beep * 1000, 3);
      expect(vi.getTimerCount()).toBe(1); // only the safety net for a context whose audio never runs
    });

    it('closes with the end beep, timed by the audio clock, then ends', async () => {
      const { sources, oscillators } = mockRadioContext(0);
      const onSpeechEnd = vi.fn();
      const onEnd = vi.fn();
      void playRadioAudioBuffer(new ArrayBuffer(8), { enableBeeps: true, onSpeechEnd, onEnd });

      sources[0].onended?.();
      expect(onSpeechEnd).toHaveBeenCalledTimes(1);
      expect(onEnd).not.toHaveBeenCalled(); // the end beep is still playing
      oscillators[oscillators.length - 1].onended?.();
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('does not play a message another one replaced while it was decoded', async () => {
      const { sources, decodes } = mockRadioContext(0, true);
      const onStart = vi.fn();
      const onEnd = vi.fn();
      const onError = vi.fn();

      const playing = playRadioAudioBuffer(new ArrayBuffer(8), { enableBeeps: true, onStart, onEnd, onError });
      stopRadioSpeech(); // an urgent call took the radio
      decodes[0]();
      await playing;

      expect(sources).toHaveLength(0);
      expect(onStart).not.toHaveBeenCalled();
      expect(onEnd).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('skips a call whose voice is still being made when its useful life ends', async () => {
      vi.useFakeTimers({ now: 1_000_000 });
      globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}));
      const onStart = vi.fn();
      const onStale = vi.fn();
      const onEnd = vi.fn();

      void speakRadioResponse('Push-lap car behind', { onStart, onStale, onEnd, expiresAt: 1_000_000 + 2000 });
      await vi.advanceTimersByTimeAsync(1999);
      expect(onEnd).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);

      expect(onStale).toHaveBeenCalledTimes(1);
      expect(onEnd).toHaveBeenCalledTimes(1); // the speech queue moves on
      expect(onStart).not.toHaveBeenCalled();
    });

    it('says how long the voice took, and whether it came from the cache', async () => {
      mockRadioContext(0);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as unknown as Response);
      const onSynthesized = vi.fn();

      await speakRadioResponse('Clean air ahead', {
        enableBeeps: false,
        onSynthesized,
        onStart: () => stopRadioSpeech(),
      });
      await speakRadioResponse('Clean air ahead', {
        enableBeeps: false,
        onSynthesized,
        onStart: () => stopRadioSpeech(),
      });

      expect(onSynthesized.mock.calls.map((call) => call[1])).toEqual([false, true]);
      expect(onSynthesized.mock.calls[0][0]).toBeGreaterThanOrEqual(0);
    });
  });
});
