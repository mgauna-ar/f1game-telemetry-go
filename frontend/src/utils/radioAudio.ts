import { RADIO_AUDIO_CONSTANTS } from '../constants/f1';

let audioCtx: AudioContext | null = null;
let activeSourceNode: AudioBufferSourceNode | null = null;
let activeStaticSourceNode: AudioBufferSourceNode | null = null;
let activeStaticGainNode: GainNode | null = null;

// Zero-latency in-memory cache for synthesized audio chunks
const ttsAudioMemoryCache = new Map<string, ArrayBuffer>();

export function _resetAudioContextForTesting(): void {
  audioCtx = null;
  activeSourceNode = null;
  activeStaticSourceNode = null;
  activeStaticGainNode = null;
  ttsAudioMemoryCache.clear();
}

/**
 * Clears the client-side audio memory cache.
 */
export function clearRadioAudioCache(): void {
  ttsAudioMemoryCache.clear();
}

/**
 * Returns a shared AudioContext instance, initializing or resuming it upon user interaction.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx || audioCtx.state === 'closed') {
    try {
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

/**
 * Generates a non-linear distortion transfer curve for the WaveShaperNode
 * to emulate subtle cockpit radio saturation.
 */
export function makeDistortionCurve(amount: number = RADIO_AUDIO_CONSTANTS.DISTORTION_AMOUNT): Float32Array {
  const nSamples = 256;
  const curve = new Float32Array(nSamples);
  const deg = Math.PI / 180;
  const k = typeof amount === 'number' && amount > 0 ? amount : 0;

  for (let i = 0; i < nSamples; ++i) {
    const x = (i * 2) / nSamples - 1;
    if (k === 0) {
      curve[i] = x;
    } else {
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
  }
  return curve;
}

/**
 * Generates an audio buffer containing filtered white noise to emulate analog cockpit radio squelch/static.
 */
export function createStaticNoiseBuffer(ctx: AudioContext, durationSeconds = 3): AudioBuffer {
  const bufferSize = ctx.sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    // Pink noise / mild lowpass filter integration for natural radio hiss
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5;
  }
  return buffer;
}

/**
 * Plays FOM-style F1 team radio tones (start or end transmission beeps).
 */
export function playRadioBeep(
  type: 'start' | 'end',
  volume: number = RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    if (!ctx) {
      resolve();
      return;
    }

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(RADIO_AUDIO_CONSTANTS.BEEP_GAIN * volume, now);
      masterGain.connect(ctx.destination);

      if (type === 'start') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(RADIO_AUDIO_CONSTANTS.BEEP_START_FREQ_1, now);
        gain1.gain.setValueAtTime(0.01, now);
        gain1.gain.exponentialRampToValueAtTime(1.0, now + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S);

        const t2 = now + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S + 0.02;
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(RADIO_AUDIO_CONSTANTS.BEEP_START_FREQ_2, t2);
        gain2.gain.setValueAtTime(0.01, t2);
        gain2.gain.exponentialRampToValueAtTime(1.0, t2 + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.01, t2 + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S);

        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc2.connect(gain2);
        gain2.connect(masterGain);

        osc1.start(now);
        osc1.stop(now + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S);
        osc2.start(t2);
        osc2.stop(t2 + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S);

        const totalDurationMs = (RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S * 2 + 0.04) * 1000;
        setTimeout(resolve, totalDurationMs);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(RADIO_AUDIO_CONSTANTS.BEEP_END_FREQ_START, now);
        osc.frequency.exponentialRampToValueAtTime(
          RADIO_AUDIO_CONSTANTS.BEEP_END_FREQ_END,
          now + RADIO_AUDIO_CONSTANTS.BEEP_END_DURATION_S
        );

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.exponentialRampToValueAtTime(1.0, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, now + RADIO_AUDIO_CONSTANTS.BEEP_END_DURATION_S);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + RADIO_AUDIO_CONSTANTS.BEEP_END_DURATION_S);

        const totalDurationMs = (RADIO_AUDIO_CONSTANTS.BEEP_END_DURATION_S + 0.02) * 1000;
        setTimeout(resolve, totalDurationMs);
      }
    } catch {
      resolve();
    }
  });
}

export interface RadioSpeechOptions {
  volume?: number;
  enableBeeps?: boolean;
  enableCockpitFilter?: boolean;
  enableStaticFx?: boolean;
  voice?: string;
  persona?: string;
  language?: string;
  rate?: string;
  pitch?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Plays an audio ArrayBuffer (e.g. from backend Neural TTS) through the F1 team radio audio graph.
 */
export async function playRadioAudioBuffer(
  arrayBuffer: ArrayBuffer,
  options: RadioSpeechOptions = {}
): Promise<void> {
  const {
    volume = RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME,
    enableBeeps = true,
    enableCockpitFilter = true,
    enableStaticFx = true,
    onStart,
    onEnd,
    onError,
  } = options;

  const ctx = getAudioContext();
  if (!ctx) {
    onError?.(new Error('AudioContext unavailable'));
    return;
  }

  stopRadioSpeech();

  if (enableBeeps) {
    await playRadioBeep('start', volume);
  }

  return new Promise((resolve) => {
    ctx.decodeAudioData(
      arrayBuffer.slice(0),
      (audioBuffer) => {
        try {
          const now = ctx.currentTime;
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          activeSourceNode = source;

          const masterGain = ctx.createGain();
          masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);

          // Subtle radio background static hiss during speech
          if (enableStaticFx) {
            try {
              const staticBuf = createStaticNoiseBuffer(ctx, 3);
              const staticSource = ctx.createBufferSource();
              staticSource.buffer = staticBuf;
              staticSource.loop = true;

              const staticFilter = ctx.createBiquadFilter();
              staticFilter.type = 'bandpass';
              staticFilter.frequency.setValueAtTime(RADIO_AUDIO_CONSTANTS.FILTER_CENTER_FREQ_HZ, now);
              staticFilter.Q.setValueAtTime(RADIO_AUDIO_CONSTANTS.FILTER_Q, now);

              const staticGain = ctx.createGain();
              const targetStaticGain = RADIO_AUDIO_CONSTANTS.RADIO_STATIC_GAIN * Math.max(0, Math.min(1, volume));
              staticGain.gain.setValueAtTime(0.001, now);
              staticGain.gain.exponentialRampToValueAtTime(targetStaticGain, now + 0.05);

              staticSource.connect(staticFilter);
              staticFilter.connect(staticGain);
              staticGain.connect(masterGain);

              staticSource.start(now);
              activeStaticSourceNode = staticSource;
              activeStaticGainNode = staticGain;
            } catch {}
          }

          if (enableCockpitFilter) {
            // Bandpass filter to emulate band-limited cockpit radio
            const bandpass = ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.setValueAtTime(RADIO_AUDIO_CONSTANTS.FILTER_CENTER_FREQ_HZ, now);
            bandpass.Q.setValueAtTime(RADIO_AUDIO_CONSTANTS.FILTER_Q, now);

            // Waveshaper distortion
            const distortion = ctx.createWaveShaper();
            distortion.curve = makeDistortionCurve(RADIO_AUDIO_CONSTANTS.DISTORTION_AMOUNT) as any;
            distortion.oversample = '2x';

            source.connect(bandpass);
            bandpass.connect(distortion);
            distortion.connect(masterGain);
          } else {
            source.connect(masterGain);
          }

          masterGain.connect(ctx.destination);

          source.onended = async () => {
            stopRadioSpeech();
            if (enableBeeps) {
              await playRadioBeep('end', volume);
            }
            onEnd?.();
            resolve();
          };

          onStart?.();
          source.start(0);
        } catch (err) {
          stopRadioSpeech();
          onError?.(err);
          resolve();
        }
      },
      (decodeErr) => {
        stopRadioSpeech();
        onError?.(decodeErr);
        resolve();
      }
    );
  });
}

/**
 * Sanitizes voice engineer speech text by removing internal debug tags,
 * proactive prompt headers (e.g. [PROACTIVE PIT WALL CALL: ...]), and bracketed instructions.
 */
export function cleanRadioSpeechText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Strip leading [PROACTIVE PIT WALL CALL: ...] or [PROACTIVE PIT WALL CALL] tag
  cleaned = cleaned.replace(/^\[PROACTIVE(?:\s+PIT\s+WALL(?:\s+CALL)?)?\]?:?\s*/i, '');

  // Strip leading PROACTIVE PIT WALL CALL: or PROACTIVE PIT WALL:
  cleaned = cleaned.replace(/^PROACTIVE(?:\s+PIT\s+WALL(?:\s+CALL)?)?:?\s*/i, '');

  // If there's a trailing bracket remaining from opening bracket, e.g. "Message]"
  if (cleaned.endsWith(']') && !cleaned.includes('[')) {
    cleaned = cleaned.slice(0, -1);
  }

  // If the whole string is still wrapped in [...], strip surrounding brackets
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned.trim();
}

/**
 * Requests speech synthesis from the Go backend (Microsoft Edge Neural TTS)
 * and plays it with F1 radio sound effects, static ambience, and callbacks.
 */
export async function speakRadioResponse(
  text: string,
  options: RadioSpeechOptions = {}
): Promise<void> {
  const {
    voice,
    persona = 'bono',
    language,
    rate = '+0%',
    pitch = '+0Hz',
    onError,
  } = options;

  const cleaned = cleanRadioSpeechText(text);
  if (!cleaned) return;

  stopRadioSpeech();

  const cacheKey = `${voice || 'default'}|${persona}|${language || ''}|${rate}|${pitch}|${cleaned}`;
  const cached = ttsAudioMemoryCache.get(cacheKey);
  if (cached) {
    await playRadioAudioBuffer(cached, options);
    return;
  }

  try {
    const response = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleaned,
        voice: voice || undefined,
        persona,
        language,
        rate,
        pitch,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS server error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    ttsAudioMemoryCache.set(cacheKey, audioBuffer);
    await playRadioAudioBuffer(audioBuffer, options);
  } catch (err) {
    console.warn('[Radio Audio] Neural TTS playback failed:', err);
    onError?.(err);
  }
}

/**
 * Stops any ongoing radio audio playback and background static immediately.
 */
export function stopRadioSpeech(): void {
  if (activeSourceNode) {
    try {
      activeSourceNode.stop();
      activeSourceNode.disconnect();
    } catch {}
    activeSourceNode = null;
  }
  if (activeStaticSourceNode) {
    try {
      activeStaticSourceNode.stop();
      activeStaticSourceNode.disconnect();
    } catch {}
    activeStaticSourceNode = null;
  }
  if (activeStaticGainNode) {
    try {
      activeStaticGainNode.disconnect();
    } catch {}
    activeStaticGainNode = null;
  }
}

/**
 * Browser API capability checks for Microphone Speech Recognition.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

export type SpeechRecognitionConstructor = new () => ISpeechRecognition;

export function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const anyWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition || null;
}
