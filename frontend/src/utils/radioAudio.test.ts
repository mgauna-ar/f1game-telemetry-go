import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  playRadioBeep,
  makeDistortionCurve,
  speakRadioResponse,
  playRadioAudioBuffer,
  stopRadioSpeech,
  isSpeechRecognitionSupported,
  _resetAudioContextForTesting,
} from './radioAudio';

describe('radioAudio utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAudioContextForTesting();
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
      (window as any).AudioContext = undefined;
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

      (window as any).AudioContext = MockAudioContext;

      const promise = playRadioBeep('start', 0.8);
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      await promise;
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
      (window as any).AudioContext = MockAudioContext;

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
      (window as any).AudioContext = MockAudioContext;

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
      (window as any).AudioContext = MockAudioContext;

      await speakRadioResponse('Safety Car deployed', { enableBeeps: false, enableStaticFx: false });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Second call with same message & settings should hit memory cache
      await speakRadioResponse('Safety Car deployed', { enableBeeps: false, enableStaticFx: false });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1); // No new network call
    });
  });
});
