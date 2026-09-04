import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  playRadioBeep,
  makeDistortionCurve,
  speakRadioResponse,
  playRadioAudioBuffer,
  stopRadioSpeech,
  cleanRadioSpeechText,
  normalizeSpanishRadioSpeech,
  formatProactiveFallbackSpeech,
  isSpeechRecognitionSupported,
  getRadioAnalyserNode,
  connectMicrophoneToAnalyser,
  disconnectMicrophoneFromAnalyser,
  _resetAudioContextForTesting,
} from './radioAudio';

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

  describe('formatProactiveFallbackSpeech', () => {
    it('formats safety car alert in Spanish and English with driver callsign', () => {
      const scPrompt = '[PROACTIVE PIT WALL CALL: Full Safety Car deployed! You are initiating this call — do NOT say "Entendido" or "Copy". Directly announce Safety Car in pista / on track, maintain delta positive, stand by for pit stop window.]';
      
      const speechEs = formatProactiveFallbackSpeech(scPrompt, 'es', 'colapinto', 'Franco');
      expect(speechEs).toMatch(/auto de seguridad/i);
      expect(speechEs).toContain('Franco');

      const speechEn = formatProactiveFallbackSpeech(scPrompt, 'en', 'bono', 'Lewis');
      expect(speechEn).toContain('Safety Car');
      expect(speechEn).toContain('Lewis');
    });

    it('formats VSC and Red Flag alerts authentically', () => {
      const vscPrompt = '[PROACTIVE PIT WALL CALL: Virtual Safety Car (VSC) deployed! Directly announce VSC deployed, maintain delta, no overtaking.]';
      expect(formatProactiveFallbackSpeech(vscPrompt, 'es', 'bono')).toMatch(/VSC|Auto de seguridad virtual/i);
      expect(formatProactiveFallbackSpeech(vscPrompt, 'en', 'bono')).toMatch(/VSC|Virtual Safety Car/i);

      const redFlagPrompt = '[PROACTIVE PIT WALL CALL: Red Flag deployed! Session stopped.]';
      expect(formatProactiveFallbackSpeech(redFlagPrompt, 'es', 'bono')).toMatch(/Bandera roja/i);
      expect(formatProactiveFallbackSpeech(redFlagPrompt, 'en', 'bono')).toMatch(/Red flag/i);
    });

    it('formats critical tyre puncture alerts', () => {
      const puncturePrompt = '[PROACTIVE PIT WALL CALL: Critical tyre puncture on car! Wear is at 96%. Order driver to box immediately.]';
      const speech = formatProactiveFallbackSpeech(puncturePrompt, 'es', 'bono', 'Mateo');
      expect(speech.toLowerCase()).toContain('pinchadura');
      expect(speech).toContain('Mateo');
    });

    it('formats clean air pit window and new categories authentically', () => {
      const directivePrompt = '[PROACTIVE PIT WALL CALL: Clean Air Pit Window — Pit window offers clean air on rejoin. You are initiating this call — do NOT say "Entendido" or "Copy".]';
      const speech = formatProactiveFallbackSpeech(directivePrompt, 'es', 'bono', 'Driver');
      expect(speech).toMatch(/ventana de parada|aire limpio/i);
      expect(speech).toContain('Driver');
      expect(speech).not.toContain('You are initiating this call');
    });

    it('formats structured RadioAlertPayload objects directly', () => {
      const payload: import('../types/telemetry').RadioAlertPayload = {
        category: 'pit_clean_air',
        isCritical: false,
        message: 'Clean Air Pit Window — Pit window offers clean air on rejoin.',
      };
      const speech = formatProactiveFallbackSpeech(payload, 'es', 'bono', 'Driver');
      expect(speech).toMatch(/ventana de parada|aire limpio/i);
      expect(speech).toContain('Driver');
    });

    it('formats general directives cleanly without debug prompt instructions as fallback', () => {
      const customDirective = '[PROACTIVE PIT WALL CALL: System Test Notification — All telemetry channels nominal. You are initiating this call — do NOT say "Entendido" or "Copy".]';
      const speech = formatProactiveFallbackSpeech(customDirective, 'es', 'bono', 'Driver');
      expect(speech).toContain('Driver, System Test Notification — All telemetry channels nominal.');
      expect(speech).not.toContain('You are initiating this call');
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
});
