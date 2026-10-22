import { RADIO_AUDIO_CONSTANTS } from '../constants/f1';
import { api } from './apiClient';

let audioCtx: AudioContext | null = null;
let activeSourceNode: AudioBufferSourceNode | null = null;
/** Goes up each time speech stops, so a message still being fetched then is not played. */
let speechGeneration = 0;
let activeStaticSourceNode: AudioBufferSourceNode | null = null;
let activeStaticGainNode: GainNode | null = null;
let activeWorkletNode: AudioWorkletNode | null = null;
let activeMasterGainNode: GainNode | null = null;
let activeExtraNodes: AudioNode[] = [];
let activePlaybackResolve: (() => void) | null = null;
let sharedAnalyserNode: AnalyserNode | null = null;
let micSourceNode: MediaStreamAudioSourceNode | null = null;
let workletLoaded = false;
let workletLoadingPromise: Promise<boolean> | null = null;

// Zero-latency in-memory cache for synthesized audio chunks, oldest entries evicted first
const ttsAudioMemoryCache = new Map<string, ArrayBuffer>();
// Synthesis requests still in flight, so a prefetched sentence is not requested twice
const ttsInFlightRequests = new Map<string, Promise<ArrayBuffer>>();

export function _resetAudioContextForTesting(): void {
  audioCtx = null;
  activeSourceNode = null;
  activeStaticSourceNode = null;
  activeStaticGainNode = null;
  activeWorkletNode = null;
  activeMasterGainNode = null;
  activeExtraNodes = [];
  activePlaybackResolve = null;
  sharedAnalyserNode = null;
  micSourceNode = null;
  workletLoaded = false;
  workletLoadingPromise = null;
  ttsAudioMemoryCache.clear();
  ttsInFlightRequests.clear();
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
 * Returns a shared AnalyserNode for real-time waveform visualizers.
 */
export function getRadioAnalyserNode(): AnalyserNode | null {
  const ctx = getAudioContext();
  if (!ctx || typeof ctx.createAnalyser !== 'function') return null;

  if (!sharedAnalyserNode) {
    try {
      sharedAnalyserNode = ctx.createAnalyser();
      sharedAnalyserNode.fftSize = RADIO_AUDIO_CONSTANTS.ANALYZER_FFT_SIZE;
      sharedAnalyserNode.smoothingTimeConstant = 0.8;
    } catch {
      return null;
    }
  }
  return sharedAnalyserNode;
}

/**
 * Connects a live microphone MediaStream to the shared AnalyserNode for real-time PTT waveform rendering.
 */
export function connectMicrophoneToAnalyser(stream: MediaStream): void {
  const ctx = getAudioContext();
  const analyser = getRadioAnalyserNode();
  if (!ctx || !analyser || !stream) return;

  try {
    disconnectMicrophoneFromAnalyser();
    micSourceNode = ctx.createMediaStreamSource(stream);
    micSourceNode.connect(analyser);
  } catch {}
}

/**
 * Disconnects the microphone stream from the AnalyserNode.
 */
export function disconnectMicrophoneFromAnalyser(): void {
  if (micSourceNode) {
    try {
      micSourceNode.disconnect();
    } catch {}
    micSourceNode = null;
  }
}

/**
 * Loads the AudioWorklet radio processor module.
 */
export async function initRadioWorklet(ctx: AudioContext): Promise<boolean> {
  if (workletLoaded) return true;
  if (workletLoadingPromise) return workletLoadingPromise;

  if (!ctx.audioWorklet || typeof ctx.audioWorklet.addModule !== 'function') {
    return false;
  }

  workletLoadingPromise = ctx.audioWorklet
    .addModule('/radio-processor.js')
    .then(() => {
      workletLoaded = true;
      return true;
    })
    .catch(() => {
      workletLoaded = false;
      return false;
    });

  return workletLoadingPromise;
}

/**
 * Generates a non-linear distortion transfer curve for the WaveShaperNode
 * to emulate subtle cockpit radio saturation.
 */
export function makeDistortionCurve(amount: number = RADIO_AUDIO_CONSTANTS.DISTORTION_AMOUNT): Float32Array<ArrayBuffer> {
  const nSamples = 256;
  const buffer = new ArrayBuffer(nSamples * Float32Array.BYTES_PER_ELEMENT);
  const curve = new Float32Array(buffer);
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
 * Calls `done` once `node` stops playing: an audio event, which a hidden page (the Live page
 * behind a fullscreen game) doesn't hold back the way it holds back timers. A context whose audio
 * never ran (no user gesture yet) fires no event, so a timer `endsInS` plus
 * AUDIO_END_FALLBACK_MS later stands in.
 */
function onAudioEnded(node: AudioScheduledSourceNode, endsInS: number, done: () => void): void {
  let called = false;
  const once = () => {
    if (called) return;
    called = true;
    clearTimeout(fallback);
    done();
  };
  const endsInMs = Number.isFinite(endsInS) ? Math.max(0, endsInS) * 1000 : 0;
  const fallback = setTimeout(once, endsInMs + RADIO_AUDIO_CONSTANTS.AUDIO_END_FALLBACK_MS);
  node.onended = once;
}

/** A beep scheduled on the audio clock: when it ends, and its last tone, whose end marks it. */
interface ScheduledBeep {
  endsAt: number;
  lastTone: OscillatorNode;
}

/** Schedules FOM-style F1 team radio tones (start or end transmission beeps) at `at` on the audio clock. */
function scheduleRadioBeep(ctx: AudioContext, type: 'start' | 'end', volume: number, at: number): ScheduledBeep {
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(RADIO_AUDIO_CONSTANTS.BEEP_GAIN * volume, at);

  const analyser = getRadioAnalyserNode();
  if (analyser) {
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
  } else {
    masterGain.connect(ctx.destination);
  }

  if (type === 'start') {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(RADIO_AUDIO_CONSTANTS.BEEP_START_FREQ_1, at);
    gain1.gain.setValueAtTime(0.01, at);
    gain1.gain.exponentialRampToValueAtTime(1.0, at + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.01, at + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S);

    const t2 = at + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S + RADIO_AUDIO_CONSTANTS.BEEP_START_GAP_S;
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(RADIO_AUDIO_CONSTANTS.BEEP_START_FREQ_2, t2);
    gain2.gain.setValueAtTime(0.01, t2);
    gain2.gain.exponentialRampToValueAtTime(1.0, t2 + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.01, t2 + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S);

    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc2.connect(gain2);
    gain2.connect(masterGain);

    const endsAt = t2 + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S;
    osc1.start(at);
    osc1.stop(at + RADIO_AUDIO_CONSTANTS.BEEP_START_DURATION_S);
    osc2.start(t2);
    osc2.stop(endsAt);
    return { endsAt, lastTone: osc2 };
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(RADIO_AUDIO_CONSTANTS.BEEP_END_FREQ_START, at);
  osc.frequency.exponentialRampToValueAtTime(
    RADIO_AUDIO_CONSTANTS.BEEP_END_FREQ_END,
    at + RADIO_AUDIO_CONSTANTS.BEEP_END_DURATION_S
  );

  gain.gain.setValueAtTime(0.01, at);
  gain.gain.exponentialRampToValueAtTime(1.0, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.01, at + RADIO_AUDIO_CONSTANTS.BEEP_END_DURATION_S);

  osc.connect(gain);
  gain.connect(masterGain);

  const endsAt = at + RADIO_AUDIO_CONSTANTS.BEEP_END_DURATION_S;
  osc.start(at);
  osc.stop(endsAt);
  return { endsAt, lastTone: osc };
}

/**
 * Plays FOM-style F1 team radio tones (start or end transmission beeps). Resolves when the beep has
 * played, timed by the audio clock rather than a timer.
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
      const beep = scheduleRadioBeep(ctx, type, volume, ctx.currentTime);
      onAudioEnded(beep.lastTone, beep.endsAt - ctx.currentTime, resolve);
    } catch {
      resolve();
    }
  });
}

export interface RadioSpeechOptions {
  volume?: number;
  enableBeeps?: boolean;
  /** Overrides enableBeeps for the opening beep, e.g. to open a multi-sentence reply only once. */
  beepStart?: boolean;
  /** Overrides enableBeeps for the closing beep, e.g. to close a multi-sentence reply only once. */
  beepEnd?: boolean;
  enableCockpitFilter?: boolean;
  enableStaticFx?: boolean;
  voice?: string;
  persona?: string;
  language?: string;
  rate?: string;
  pitch?: string;
  /** The speech is scheduled: it starts in `startsInMs` (after the opening beep and the device's latency). */
  onStart?: (startsInMs: number) => void;
  /** The speech itself ended, before the closing beep. */
  onSpeechEnd?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  /** Epoch ms after which the message is no longer worth saying: if its audio is ready later, it ends without playing. */
  expiresAt?: number;
  /** The audio is ready: it took `synthMs` to make, or came from the cache. */
  onSynthesized?: (synthMs: number, cached: boolean) => void;
  /** The message went stale before its audio was ready, so it ends (onEnd) without playing. */
  onStale?: () => void;
}

/**
 * Plays an audio ArrayBuffer (e.g. from backend Neural TTS) through the F1 team radio audio graph.
 * The opening beep and the speech are scheduled on the audio clock once the audio is decoded, so no
 * timer stands between the message and the driver's ears. A message another one replaced while it
 * was decoded is not played, and calls none of its callbacks.
 */
export async function playRadioAudioBuffer(
  arrayBuffer: ArrayBuffer,
  options: RadioSpeechOptions = {}
): Promise<void> {
  const {
    volume = RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME,
    enableBeeps = true,
    beepStart = enableBeeps,
    beepEnd = enableBeeps,
    enableCockpitFilter = true,
    enableStaticFx = true,
    onStart,
    onSpeechEnd,
    onEnd,
    onError,
  } = options;

  const ctx = getAudioContext();
  if (!ctx) {
    onError?.(new Error('AudioContext unavailable'));
    return;
  }

  stopRadioSpeech();
  const generation = speechGeneration;

  // Ensure AudioWorklet initialization in background
  if (!workletLoaded) {
    initRadioWorklet(ctx).catch(() => {});
  }
  const hasWorklet = workletLoaded;

  return new Promise((resolve) => {
    activePlaybackResolve = resolve;

    ctx.decodeAudioData(
      arrayBuffer.slice(0),
      (audioBuffer) => {
        // Another message took the radio while this one was decoded (stopRadioSpeech already
        // settled this playback).
        if (generation !== speechGeneration) return;
        try {
          const now = ctx.currentTime;
          const speechAt = beepStart ? scheduleRadioBeep(ctx, 'start', volume, now).endsAt : now;
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          activeSourceNode = source;

          const masterGain = ctx.createGain();
          masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
          activeMasterGainNode = masterGain;

          // 1. Helmet Simulation & Spatial EQ filter chain
          const helmetHighCut = ctx.createBiquadFilter();
          helmetHighCut.type = 'lowpass';
          helmetHighCut.frequency?.setValueAtTime?.(RADIO_AUDIO_CONSTANTS.HELMET_HIGHCUT_FREQ_HZ, now);

          const helmetWarmth = ctx.createBiquadFilter();
          helmetWarmth.type = 'peaking';
          helmetWarmth.frequency?.setValueAtTime?.(RADIO_AUDIO_CONSTANTS.HELMET_WARMTH_FREQ_HZ, now);
          helmetWarmth.gain?.setValueAtTime?.(RADIO_AUDIO_CONSTANTS.HELMET_WARMTH_GAIN_DB, now);
          helmetWarmth.Q?.setValueAtTime?.(1.2, now);

          activeExtraNodes.push(helmetHighCut, helmetWarmth);

          // 2. AudioWorklet processing or classic Node processing
          if (hasWorklet && enableStaticFx && typeof window !== 'undefined' && 'AudioWorkletNode' in window) {
            try {
              const workletNode = new AudioWorkletNode(ctx, 'f1-radio-processor');
              activeWorkletNode = workletNode;
              const staticParam = workletNode.parameters?.get('staticLevel');
              if (staticParam) {
                staticParam.setValueAtTime(enableStaticFx ? 0.04 : 0.0, now);
              }
              const distParam = workletNode.parameters?.get('distortion');
              if (distParam) {
                distParam.setValueAtTime(enableCockpitFilter ? 0.15 : 0.0, now);
              }
              const activeParam = workletNode.parameters?.get('active');
              if (activeParam) {
                activeParam.setValueAtTime(1, now);
              }

              source.connect(workletNode);
              workletNode.connect(helmetHighCut);
            } catch {
              // Fallback to classic graph
              connectClassicRadioGraph(ctx, masterGain, enableStaticFx, volume, speechAt);
              source.connect(helmetHighCut);
            }
          } else {
            // Classic node graph
            if (enableStaticFx) {
              connectClassicRadioGraph(ctx, masterGain, enableStaticFx, volume, speechAt);
            }

            if (enableCockpitFilter) {
              const bandpass = ctx.createBiquadFilter();
              bandpass.type = 'bandpass';
              bandpass.frequency.setValueAtTime(RADIO_AUDIO_CONSTANTS.FILTER_CENTER_FREQ_HZ, now);
              bandpass.Q.setValueAtTime(RADIO_AUDIO_CONSTANTS.FILTER_Q, now);

              const distortion = ctx.createWaveShaper();
              distortion.curve = makeDistortionCurve(RADIO_AUDIO_CONSTANTS.DISTORTION_AMOUNT);
              distortion.oversample = '2x';

              activeExtraNodes.push(bandpass, distortion);

              source.connect(bandpass);
              bandpass.connect(distortion);
              distortion.connect(helmetHighCut);
            } else {
              source.connect(helmetHighCut);
            }
          }

          helmetHighCut.connect(helmetWarmth);
          helmetWarmth.connect(masterGain);

          // 3. Connect master output through shared AnalyserNode to destination
          const analyser = getRadioAnalyserNode();
          if (analyser) {
            masterGain.connect(analyser);
            analyser.connect(ctx.destination);
          } else {
            masterGain.connect(ctx.destination);
          }

          const finish = () => {
            onEnd?.();
            if (activePlaybackResolve) {
              const res = activePlaybackResolve;
              activePlaybackResolve = null;
              res();
            }
          };
          onAudioEnded(source, speechAt - now + audioBuffer.duration, () => {
            // Cut off by another message: that one has the radio now.
            if (generation !== speechGeneration) return;
            stopRadioSpeech();
            onSpeechEnd?.();
            if (!beepEnd) {
              finish();
              return;
            }
            try {
              const beep = scheduleRadioBeep(ctx, 'end', volume, ctx.currentTime);
              onAudioEnded(beep.lastTone, beep.endsAt - ctx.currentTime, finish);
            } catch {
              finish();
            }
          });

          onStart?.((speechAt - now + (ctx.outputLatency || 0)) * 1000);
          source.start(speechAt);
        } catch (err) {
          stopRadioSpeech();
          onError?.(err);
          if (activePlaybackResolve) {
            const res = activePlaybackResolve;
            activePlaybackResolve = null;
            res();
          }
        }
      },
      (decodeErr) => {
        if (generation !== speechGeneration) return;
        stopRadioSpeech();
        onError?.(decodeErr);
        if (activePlaybackResolve) {
          const res = activePlaybackResolve;
          activePlaybackResolve = null;
          res();
        }
      }
    );
  });
}

/** Adds the radio's static under the speech, from `now` on the audio clock (when the speech starts). */
function connectClassicRadioGraph(
  ctx: AudioContext,
  masterGain: GainNode,
  enableStaticFx: boolean,
  volume: number,
  now: number
) {
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
      activeExtraNodes.push(staticFilter);
    } catch {}
  }
}

/**
 * Sanitizes voice engineer speech text by removing internal debug tags,
 * proactive prompt headers (e.g. [PROACTIVE PIT WALL CALL: ...]),
 * LLM system instructions (e.g. You are initiating this call...), and bracketed instructions.
 */
export function cleanRadioSpeechText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Strip leading [PROACTIVE PIT WALL CALL: ...] or [PROACTIVE PIT WALL CALL] or similar
  cleaned = cleaned.replace(/^\[PROACTIVE(?:\s+PIT\s+WALL(?:\s+CALL)?)?:\s*/i, '');
  cleaned = cleaned.replace(/^\[PROACTIVE(?:\s+PIT\s+WALL(?:\s+CALL)?)?\]:?\s*/i, '');
  cleaned = cleaned.replace(/^PROACTIVE(?:\s+PIT\s+WALL(?:\s+CALL)?)?:?\s*/i, '');

  // Strip [DRIVER RADIO TRANSMISSION]: or [PIT WALL BROADCAST]:
  cleaned = cleaned.replace(/^\[(?:DRIVER\s+RADIO\s+TRANSMISSION|PIT\s+WALL\s+BROADCAST)\]:?\s*/i, '');

  // Strip internal prompt instructions directed to LLMs
  cleaned = cleaned.replace(/\s*You are initiating this call(?:—|--|-|:|\.).*$/i, '');
  cleaned = cleaned.replace(/\s*You are initiating this call.*$/i, '');
  cleaned = cleaned.replace(/\s*do NOT say\s+['"][^'"]+['"]\s+or\s+['"][^'"]+['"][^.]*\.?/gi, '');
  cleaned = cleaned.replace(/\s*do NOT say\s+[^.]*\.?/gi, '');

  // If there's a trailing bracket remaining from opening bracket, e.g. "Message]"
  if (cleaned.endsWith(']') && !cleaned.includes('[')) {
    cleaned = cleaned.slice(0, -1);
  }

  // If the whole string is still wrapped in [...], strip surrounding brackets
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1);
  }

  // Strip leading colons, hyphens, em-dashes, or whitespace left over from header tags
  cleaned = cleaned.replace(/^[:\-\s—–]+/, '');

  return cleaned.trim();
}

/**
 * Normalizes motorsport terminology for natural Spanish TTS pronunciation,
 * converting raw English / literal Spanglish terms into authentic Latin American / Spanish phrases.
 */
export function normalizeSpanishRadioSpeech(text: string): string {
  if (!text) return '';
  let result = text;

  // 1. SC & VSC terminology (prevents "safti car desplegado" pronunciation)
  result = result.replace(/\bVirtual\s+Safety\s+Car\s+desplegado\b/gi, 'Auto de seguridad virtual en pista');
  result = result.replace(/\b(?:Full\s+)?Safety\s+Car\s+desplegado\b/gi, 'Auto de seguridad en pista');
  result = result.replace(/\bVirtual\s+Safety\s+Car\b/gi, 'Auto de seguridad virtual');
  result = result.replace(/\b(?:Full\s+)?Safety\s+Car\b/gi, 'Auto de seguridad');
  result = result.replace(/\bSafety\s+Car\s+in\s+pista\b/gi, 'Auto de seguridad en pista');

  // 2. Remove robotic 'desplegado' translations
  result = result.replace(/\bVSC\s+desplegado\b/gi, 'VSC en pista');
  result = result.replace(/\bBandera\s+roja\s+desplegada\b/gi, 'Bandera roja en pista');

  return result;
}

interface RadioSpeechRequest {
  cleaned: string;
  cacheKey: string;
  body: { text: string; voice?: string; persona: string; language?: string; rate: string; pitch: string };
}

/** Cleans the text and builds the synthesis request and cache key for it. */
function buildRadioSpeechRequest(text: string, options: RadioSpeechOptions): RadioSpeechRequest | null {
  const { voice, persona = 'bono', language, rate = '+0%', pitch = '+0Hz' } = options;

  let cleaned = cleanRadioSpeechText(text);
  if (language === 'es' || (!language && persona === 'colapinto')) {
    cleaned = normalizeSpanishRadioSpeech(cleaned);
  }
  if (!cleaned) return null;

  return {
    cleaned,
    cacheKey: `${voice || 'default'}|${persona}|${language || ''}|${rate}|${pitch}|${cleaned}`,
    body: { text: cleaned, voice: voice || undefined, persona, language, rate, pitch },
  };
}

function cacheRadioAudio(cacheKey: string, audio: ArrayBuffer): void {
  ttsAudioMemoryCache.delete(cacheKey);
  ttsAudioMemoryCache.set(cacheKey, audio);
  while (ttsAudioMemoryCache.size > RADIO_AUDIO_CONSTANTS.TTS_CACHE_MAX_ENTRIES) {
    const oldest = ttsAudioMemoryCache.keys().next().value;
    if (oldest === undefined) break;
    ttsAudioMemoryCache.delete(oldest);
  }
}

/**
 * Returns the synthesized audio from the cache, a request already in flight, or a new request. A
 * hit counts as a use, so the lines said or synthesized ahead again and again stay cached.
 */
function fetchRadioSpeechAudio(request: RadioSpeechRequest): Promise<ArrayBuffer> {
  const cached = ttsAudioMemoryCache.get(request.cacheKey);
  if (cached) {
    cacheRadioAudio(request.cacheKey, cached);
    return Promise.resolve(cached);
  }

  const inFlight = ttsInFlightRequests.get(request.cacheKey);
  if (inFlight) return inFlight;

  const pending = api
    .postArrayBuffer('/api/ai/tts', request.body)
    .then((audio) => {
      cacheRadioAudio(request.cacheKey, audio);
      return audio;
    })
    .finally(() => {
      ttsInFlightRequests.delete(request.cacheKey);
    });
  ttsInFlightRequests.set(request.cacheKey, pending);
  return pending;
}

/**
 * Starts synthesizing a radio message in the background so it plays without delay
 * when its turn comes. Uses the same options as speakRadioResponse. Resolves once the audio is
 * cached, or the request failed.
 */
export function prefetchRadioSpeech(text: string, options: RadioSpeechOptions = {}): Promise<void> {
  const request = buildRadioSpeechRequest(text, options);
  if (!request) return Promise.resolve();
  return fetchRadioSpeechAudio(request).then(
    () => {},
    () => {}
  );
}

/**
 * Requests speech synthesis from the Go backend (Microsoft Edge Neural TTS)
 * and plays it with F1 radio sound effects, static ambience, and callbacks.
 */
export async function speakRadioResponse(
  text: string,
  options: RadioSpeechOptions = {}
): Promise<void> {
  const request = buildRadioSpeechRequest(text, options);
  if (!request) {
    // Nothing to say: done, so the caller's queue moves on.
    options.onEnd?.();
    return;
  }

  stopRadioSpeech();
  const generation = speechGeneration;

  const cached = ttsAudioMemoryCache.has(request.cacheKey);
  const fetchedFrom = Date.now();
  let audioBuffer: ArrayBuffer | null;
  try {
    audioBuffer = await untilExpiry(fetchRadioSpeechAudio(request), options.expiresAt);
  } catch (err) {
    if (generation === speechGeneration) options.onError?.(err);
    return;
  }
  // Stopped, or another message took the radio, while the audio was fetched: it is not played.
  if (generation !== speechGeneration) return;
  // A pit wall call that went stale while its audio was synthesized is skipped; the queue moves on.
  // A slow synthesis doesn't hold the radio past the call's useful life.
  if (audioBuffer === null || (options.expiresAt !== undefined && Date.now() > options.expiresAt)) {
    options.onStale?.();
    options.onEnd?.();
    return;
  }
  options.onSynthesized?.(Date.now() - fetchedFrom, cached);
  await playRadioAudioBuffer(audioBuffer, options);
}

/**
 * Settles with what `work` gives, or with null once `expiresAt` (epoch ms) has passed without it.
 * The work goes on either way: a synthesis still fills the cache.
 */
function untilExpiry<T>(work: Promise<T>, expiresAt?: number): Promise<T | null> {
  if (expiresAt === undefined) return work;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), Math.max(0, expiresAt - Date.now()));
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Stops any ongoing radio audio playback and background static immediately.
 */
export function stopRadioSpeech(): void {
  speechGeneration++;
  if (activeSourceNode) {
    try {
      activeSourceNode.onended = null;
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
  if (activeWorkletNode) {
    try {
      const activeParam = activeWorkletNode.parameters.get('active');
      if (activeParam && audioCtx) {
        activeParam.setValueAtTime(0, audioCtx.currentTime);
      }
      activeWorkletNode.disconnect();
    } catch {}
    activeWorkletNode = null;
  }
  if (activeMasterGainNode) {
    try {
      if (audioCtx) {
        activeMasterGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      }
      activeMasterGainNode.disconnect();
    } catch {}
    activeMasterGainNode = null;
  }
  for (const node of activeExtraNodes) {
    try {
      node.disconnect();
    } catch {}
  }
  activeExtraNodes = [];

  if (activePlaybackResolve) {
    const res = activePlaybackResolve;
    activePlaybackResolve = null;
    res();
  }
}

/**
 * Browser API capability checks for Microphone Speech Recognition.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export interface ISpeechRecognitionResult {
  transcript: string;
}

export interface ISpeechRecognitionResultList {
  length: number;
  [index: number]: { [index: number]: ISpeechRecognitionResult };
}

export interface ISpeechRecognitionEvent {
  results: ISpeechRecognitionResultList;
}

export interface ISpeechRecognitionErrorEvent {
  error: string;
}

export interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  /** The microphone started sending audio. */
  onaudiostart?: (() => void) | null;
  /** The recognizer detected speech in the audio. */
  onspeechstart?: (() => void) | null;
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
