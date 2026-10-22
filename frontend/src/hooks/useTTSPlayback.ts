import { useState, useCallback, useRef } from 'react';
import { RADIO_PERSONAS } from '../constants/f1';
import {
  speakRadioResponse,
  stopRadioSpeech,
  cleanRadioSpeechText,
  prefetchRadioSpeech,
  playRadioBeep,
  type RadioSpeechOptions,
} from '../utils/radioAudio';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import type { RadioHeardOutcome } from '../types/telemetry';
import { reportRadioHeard, type SpokenCall } from '../utils/radioHeardReport';

export interface UseTTSPlaybackOptions {
  effectiveLanguage: 'es' | 'en';
  onResponseReceived?: (response: string) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

/** A reply spoken sentence by sentence while it is still being generated. */
export interface ReplySpeechStream {
  /** Queues the next sentence; the first one opens the radio with a beep. */
  pushSentence: (sentence: string) => void;
  /** Marks the reply complete; the radio closes with a beep after the last sentence. */
  finish: () => void;
  /** Resolves once the reply has been spoken to the end, or was cut off. */
  done: Promise<void>;
}

type SpeechEmotion = { rateModifier?: number; pitchModifier?: number };

interface SpeechQueueItem {
  id: string;
  text: string;
  emotion?: SpeechEmotion;
  /** Set on sentences of a streamed reply. */
  stream?: ReplyStreamState;
  /** Epoch ms after which a queued pit wall call is stale and is skipped instead of spoken. */
  expiresAt?: number;
  /** How long the call stays worth saying (ms): an urgent call cut off is said again with this much life. */
  ttlMs?: number;
  /** A high or critical pit wall call: it goes ahead of routine calls and cuts them off. */
  urgent?: boolean;
  /** The pit wall call this is, followed for the app log. */
  call?: SpokenCall;
  /** How the call fared on the radio, for its report. */
  heard: HeardTimings;
  /**
   * Cut off midway by a traffic warning: it doesn't age while the warnings are said, and gets its
   * whole useful life again when its turn comes back.
   */
  resumed?: boolean;
}

/** When a pit wall call got the radio and was said, in epoch ms, and how long its voice took. */
interface HeardTimings {
  turnAt?: number;
  synthMs: number;
  cached: boolean;
  speechAt?: number;
  speechEndedAt?: number;
  /** Its report was sent: a call is reported once, with what finally became of it. */
  reported?: boolean;
}

const newHeard = (): HeardTimings => ({ synthMs: 0, cached: false });

/** Tells the app log what became of a pit wall call; replies and test lines aren't reported. */
function reportCall(item: SpeechQueueItem, outcome: RadioHeardOutcome): void {
  const { call, heard } = item;
  if (!call || heard.reported) return;
  heard.reported = true;
  const turnAt = heard.turnAt ?? Date.now();
  reportRadioHeard({
    directive_id: call.directiveId,
    urgent: item.urgent === true,
    outcome,
    wait_ms: Math.max(0, Math.round(turnAt - call.receivedAt)),
    start_ms: heard.speechAt ? Math.max(0, Math.round(heard.speechAt - call.receivedAt)) : 0,
    synth_ms: Math.round(heard.synthMs),
    cached: heard.cached,
    speech_ms:
      heard.speechAt && heard.speechEndedAt ? Math.max(0, Math.round(heard.speechEndedAt - heard.speechAt)) : 0,
    visible: call.visible,
  });
}

interface ReplyStreamState {
  /** The first sentence has started playing. */
  started: boolean;
  /** No more sentences will arrive. */
  finished: boolean;
  /** Interrupted by stopSpeech, a forced call or a newer reply. */
  cancelled: boolean;
  /** The last queued sentence ended and the next one has not arrived yet. */
  awaiting: boolean;
  /** Sentences spoken so far, shown as the last response. */
  spoken: string;
  /** Resolves the stream's `done` promise. */
  settle: () => void;
}

const newQueueItemId = () => Math.random().toString(36).substring(2, 9);

export interface UseTTSPlaybackReturn {
  isSpeaking: boolean;
  lastResponse: string | null;
  setLastResponse: React.Dispatch<React.SetStateAction<string | null>>;
  speakMessage: (
    text: string,
    forceInterrupt?: boolean,
    emotion?: { rateModifier?: number; pitchModifier?: number },
    ttlMs?: number,
    call?: SpokenCall
  ) => Promise<void>;
  stopSpeech: () => void;
  testRadioTransmission: () => Promise<void>;
  testTriggerAlert: (triggerType: string) => Promise<void>;
  beginReplyStream: () => ReplySpeechStream;
  /** Synthesizes a call's speech ahead, so it starts at once if it is said. */
  /** Synthesizes a message ahead of saying it; resolves once it is cached, or couldn't be. */
  prefetchMessage: (text: string, emotion?: SpeechEmotion) => Promise<void>;
}

export function useTTSPlayback(options: UseTTSPlaybackOptions): UseTTSPlaybackReturn {
  const { effectiveLanguage, onResponseReceived, onSpeakingChange } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  // Settings from Zustand store
  const isRadioEnabled = useRadioSettingsStore((s) => s.isRadioEnabled);
  const persona = useRadioSettingsStore((s) => s.persona);
  const beepsEnabled = useRadioSettingsStore((s) => s.beepsEnabled);
  const filterEnabled = useRadioSettingsStore((s) => s.filterEnabled);
  const staticFxEnabled = useRadioSettingsStore((s) => s.staticFxEnabled);
  const volume = useRadioSettingsStore((s) => s.volume);
  const speechRate = useRadioSettingsStore((s) => s.speechRate);
  const speechPitch = useRadioSettingsStore((s) => s.speechPitch);
  const neuralVoice = useRadioSettingsStore((s) => s.neuralVoice);

  const onSpeakingChangeRef = useRef(onSpeakingChange);
  onSpeakingChangeRef.current = onSpeakingChange;

  const onResponseReceivedRef = useRef(onResponseReceived);
  onResponseReceivedRef.current = onResponseReceived;

  const isSpeakingRef = useRef(false);
  /** Whether the call on the air is an urgent one. */
  const speakingUrgentRef = useRef(false);
  const queueRef = useRef<SpeechQueueItem[]>([]);
  const streamRef = useRef<ReplyStreamState | null>(null);
  /** The item on the air, if any. */
  const currentRef = useRef<SpeechQueueItem | null>(null);
  /**
   * Goes up whenever an item takes the radio or the radio is stopped: an item that was cut off
   * still ends (its closing beep, a late callback), and must not then start the next one over the
   * call that took the radio.
   */
  const tokenRef = useRef(0);
  const MAX_QUEUE_SIZE = 3;

  const speechOptions = useCallback(
    (emotion?: SpeechEmotion): RadioSpeechOptions => {
      const effectiveRate = speechRate + (emotion?.rateModifier || 0);
      const effectivePitch = speechPitch + (emotion?.pitchModifier || 0);
      return {
        volume,
        voice: neuralVoice || undefined,
        persona,
        language: effectiveLanguage,
        rate: effectiveRate >= 0 ? `+${effectiveRate}%` : `${effectiveRate}%`,
        pitch: effectivePitch >= 0 ? `+${effectivePitch}Hz` : `${effectivePitch}Hz`,
        enableBeeps: beepsEnabled,
        enableCockpitFilter: filterEnabled,
        enableStaticFx: staticFxEnabled,
      };
    },
    [speechRate, speechPitch, volume, neuralVoice, persona, effectiveLanguage, beepsEnabled, filterEnabled, staticFxEnabled]
  );

  const prefetchMessage = useCallback(
    (text: string, emotion?: SpeechEmotion) => {
      const cleaned = cleanRadioSpeechText(text);
      return isRadioEnabled && cleaned ? prefetchRadioSpeech(cleaned, speechOptions(emotion)) : Promise.resolve();
    },
    [isRadioEnabled, speechOptions]
  );

  const cancelReplyStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.cancelled = true;
    streamRef.current = null;
    queueRef.current = queueRef.current.filter((item) => item.stream !== stream);
    stream.settle();
  }, []);

  const hasQueuedSentences = (stream: ReplyStreamState) => queueRef.current.some((item) => item.stream === stream);

  // Closes a finished reply: the end beep once after its last sentence, then the radio is free.
  const closeReplyStream = useCallback(
    async (stream: ReplyStreamState) => {
      if (streamRef.current === stream) streamRef.current = null;
      if (stream.started && beepsEnabled && !stream.cancelled) {
        await playRadioBeep('end', volume);
      }
      stream.settle();
    },
    [beepsEnabled, volume]
  );

  const playNext = useCallback(async () => {
    // A pit wall call that waited too long behind other speech is no longer worth saying.
    const now = Date.now();
    queueRef.current = queueRef.current.filter((item) => {
      if (item.resumed || item.expiresAt === undefined || item.expiresAt > now) return true;
      reportCall(item, 'stale');
      return false;
    });

    if (!isRadioEnabled || queueRef.current.length === 0) {
      currentRef.current = null;
      const stream = streamRef.current;
      if (isRadioEnabled && stream && !stream.finished && !stream.cancelled) {
        // Keep the radio open while the rest of the reply is generated.
        stream.awaiting = true;
        return;
      }
      isSpeakingRef.current = false;
      speakingUrgentRef.current = false;
      setIsSpeaking(false);
      onSpeakingChangeRef.current?.(false);
      return;
    }

    const item = queueRef.current.shift()!;
    const token = ++tokenRef.current;
    currentRef.current = item;
    item.heard.turnAt ??= now;
    if (item.resumed) {
      item.resumed = false;
      item.expiresAt = item.ttlMs ? now + item.ttlMs : undefined;
    }
    const stream = item.stream;
    // The next pit wall call waiting is synthesized while this one plays, so it starts without delay.
    const upcoming = queueRef.current[0];
    if (upcoming && !upcoming.stream) {
      prefetchRadioSpeech(upcoming.text, speechOptions(upcoming.emotion));
    }
    isSpeakingRef.current = true;
    speakingUrgentRef.current = item.urgent === true;
    setIsSpeaking(true);
    onSpeakingChangeRef.current?.(true);

    const options = speechOptions(item.emotion);
    if (stream) {
      options.beepStart = beepsEnabled && !stream.started;
      options.beepEnd = false;
      stream.started = true;
      stream.spoken = stream.spoken ? `${stream.spoken} ${item.text}` : item.text;
      setLastResponse(stream.spoken);
    } else {
      options.expiresAt = item.expiresAt;
      setLastResponse(item.text);
      onResponseReceivedRef.current?.(item.text);
    }

    const next = async () => {
      // An item cut off ends anyway: the radio already belongs to what cut it.
      if (token !== tokenRef.current) return;
      if (stream) {
        if (stream.cancelled) return;
        if (stream.finished && !hasQueuedSentences(stream)) {
          await closeReplyStream(stream);
          if (token !== tokenRef.current) return;
        }
      }
      if (item.heard.speechEndedAt) reportCall(item, 'said');
      playNext();
    };
    const failed = () => {
      if (token === tokenRef.current) reportCall(item, 'failed');
      next();
    };

    try {
      await speakRadioResponse(item.text, {
        ...options,
        onSynthesized: (synthMs, cached) => {
          item.heard.synthMs = synthMs;
          item.heard.cached = cached;
        },
        onStart: (startsInMs) => {
          item.heard.speechAt = Date.now() + startsInMs;
        },
        onSpeechEnd: () => {
          item.heard.speechEndedAt = Date.now();
        },
        onStale: () => reportCall(item, 'stale'),
        onEnd: next,
        onError: failed,
      });
    } catch {
      failed();
    }
  }, [isRadioEnabled, beepsEnabled, speechOptions, closeReplyStream]);

  /**
   * Takes the radio from the item on the air. Speech that hadn't ended is cut off; with `after`,
   * an urgent call cut off midway is said again once `after` has been, its useful life starting
   * over then (a traffic warning cutting into the lap result).
   */
  const cutCurrent = useCallback(
    (after?: SpeechQueueItem) => {
      const current = currentRef.current;
      tokenRef.current++;
      currentRef.current = null;
      if (current && !current.stream) {
        const unfinished = !current.heard.speechEndedAt;
        const queue = queueRef.current;
        const at = after ? queue.indexOf(after) : -1;
        if (unfinished && current.urgent && current.ttlMs && at >= 0) {
          current.resumed = true;
          current.heard.speechAt = undefined;
          queue.splice(at + 1, 0, current);
        } else {
          reportCall(current, unfinished ? 'cut' : 'said');
        }
      }
      cancelReplyStream();
      stopRadioSpeech();
      isSpeakingRef.current = false;
    },
    [cancelReplyStream]
  );

  const stopSpeech = useCallback(() => {
    const current = currentRef.current;
    if (current && !current.stream) reportCall(current, current.heard.speechEndedAt ? 'said' : 'cut');
    for (const queued of queueRef.current) reportCall(queued, 'cut');
    tokenRef.current++;
    currentRef.current = null;
    cancelReplyStream();
    queueRef.current = [];
    isSpeakingRef.current = false;
    speakingUrgentRef.current = false;
    stopRadioSpeech();
    setIsSpeaking(false);
    onSpeakingChangeRef.current?.(false);
  }, [cancelReplyStream]);

  const beginReplyStream = useCallback((): ReplySpeechStream => {
    // A new reply supersedes one still being spoken.
    if (streamRef.current) stopSpeech();
    let settle = () => {};
    const done = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const stream: ReplyStreamState = {
      started: false,
      finished: false,
      cancelled: false,
      awaiting: false,
      spoken: '',
      settle,
    };
    streamRef.current = stream;

    return {
      done,
      pushSentence: (sentence: string) => {
        const cleaned = cleanRadioSpeechText(sentence);
        if (stream.cancelled || stream.finished || !isRadioEnabled || !cleaned) return;

        prefetchRadioSpeech(cleaned, speechOptions());
        // The driver's answer goes ahead of queued pit wall calls, after its own earlier sentences.
        const queue = queueRef.current;
        let insertAt = 0;
        while (insertAt < queue.length && queue[insertAt].stream === stream) insertAt++;
        queue.splice(insertAt, 0, { id: newQueueItemId(), text: cleaned, stream, heard: newHeard() });

        if (!isSpeakingRef.current || stream.awaiting) {
          stream.awaiting = false;
          playNext();
        }
      },
      finish: () => {
        if (stream.cancelled || stream.finished) return;
        stream.finished = true;
        if (stream.awaiting || (!stream.started && !hasQueuedSentences(stream))) {
          const wasAwaiting = stream.awaiting;
          stream.awaiting = false;
          // A call that took the radio during the closing beep keeps it.
          const token = tokenRef.current;
          closeReplyStream(stream).then(() => {
            if (wasAwaiting && token === tokenRef.current) playNext();
          });
        }
      },
    };
  }, [isRadioEnabled, speechOptions, stopSpeech, closeReplyStream, playNext]);

  const speakMessage = useCallback(
    async (
      text: string,
      urgent = false,
      emotion?: { rateModifier?: number; pitchModifier?: number },
      ttlMs?: number,
      call?: SpokenCall
    ) => {
      const cleaned = cleanRadioSpeechText(text);
      if (!isRadioEnabled || !cleaned) return;
      const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
      const item: SpeechQueueItem = {
        id: newQueueItemId(),
        text: cleaned,
        emotion,
        expiresAt,
        ttlMs,
        call,
        heard: newHeard(),
      };

      if (urgent) {
        item.urgent = true;
        // A traffic warning goes next, after the warnings already waiting; another urgent call after
        // the urgent calls waiting.
        const cutIn = call?.cutIn === true;
        const goesAfter = (queued: SpeechQueueItem) => (cutIn ? queued.call?.cutIn === true : queued.urgent === true);
        const queue = queueRef.current;
        let insertAt = 0;
        while (insertAt < queue.length && goesAfter(queue[insertAt])) insertAt++;
        queue.splice(insertAt, 0, item);
        // A warning on the air is finished first, and so is an urgent call for an urgent call that
        // isn't a warning: this one is synthesized meanwhile. Anything else is cut off for it (an
        // urgent call a warning cut midway is said again after it). Routine calls waiting stay
        // queued, until they go stale.
        const onAir = currentRef.current;
        const waits = isSpeakingRef.current && (cutIn ? onAir?.call?.cutIn === true : speakingUrgentRef.current);
        if (waits) {
          prefetchRadioSpeech(cleaned, speechOptions(emotion));
          return;
        }
        cutCurrent(cutIn ? item : undefined);
        await playNext();
        return;
      }

      // Non-critical directive: if already speaking, queue it sequentially up to MAX_QUEUE_SIZE
      if (isSpeakingRef.current) {
        const now = Date.now();
        queueRef.current = queueRef.current.filter((queued) => {
          if (queued.expiresAt === undefined || queued.expiresAt > now) return true;
          reportCall(queued, 'stale');
          return false;
        });
        const queuedCalls = queueRef.current.filter((queued) => !queued.stream);
        if (queuedCalls.length >= MAX_QUEUE_SIZE) {
          // A full queue makes room by dropping its oldest routine call: the newest is what is true now.
          const oldest = queuedCalls.find((queued) => !queued.urgent);
          if (!oldest) {
            reportCall(item, 'stale');
            return;
          }
          reportCall(oldest, 'stale');
          queueRef.current = queueRef.current.filter((queued) => queued !== oldest);
        }
        queueRef.current.push(item);
        if (queueRef.current[0] === item) {
          prefetchRadioSpeech(cleaned, speechOptions(emotion));
        }
        return;
      }

      // Not currently speaking, play immediately
      queueRef.current.push(item);
      await playNext();
    },
    [isRadioEnabled, playNext, cutCurrent, speechOptions]
  );

  const testTriggerAlert = useCallback(
    async (triggerType: string) => {
      const isEs = effectiveLanguage === 'es';
      let sampleText = '';
      switch (triggerType) {
        case 'tyres':
        case 'tyre_wear':
          sampleText = isEs
            ? 'Desgaste en la delantera izquierda llegó al 45%. Cuidá la tracción en salida de curvas lentas.'
            : 'Tyre wear reached 45% on front left. Manage traction out of slow turns.';
          break;
        case 'damage':
        case 'damage_wing':
          sampleText = isEs
            ? 'Daño en el alerón delantero detectado. Vas a sentir subviraje en curva media y rápida.'
            : 'Front wing flap damage detected. Expect understeer in medium and high speed corners.';
          break;
        case 'ers':
        case 'ers_low':
          sampleText = isEs
            ? 'Reserva de batería baja al 12%. Cambiá a modo None en rectas para recargar.'
            : 'ERS battery reserve is low at 12%. Switch to None mode on straights to harvest.';
          break;
        case 'brakes':
        case 'brakes_overheat':
          sampleText = isEs
            ? 'Los discos de freno están a 950°C en la curva 1. Pasá el balance hacia adelante y levantá antes.'
            : 'Brake temps critically high at 950°C. Move brake bias forward and lift earlier.';
          break;
        case 'fuel':
        case 'fuel_delta':
          sampleText = isEs
            ? 'Estamos a menos 0.8 vueltas del target de combustible. Hacé Lift and Coast en frenadas fuertes.'
            : 'Fuel target deficit is -0.8 laps below target. Introduce Lift and Coast into heavy braking.';
          break;
        case 'rivals':
        case 'rival_defend':
          sampleText = isEs
            ? 'Rival detrás a menos de 0.8 segundos con DRS. Cubrí la cuerda interna en la frenada.'
            : 'Car behind is within 0.8 seconds in DRS zone. Defend the inside line into Turn 1.';
          break;
        case 'pit':
        case 'pit_window':
          sampleText = isEs
            ? 'Se abrió la ventana de parada. Juego de medios listo en boxes.'
            : 'Pit window is open. Set of mediums ready in the box.';
          break;
        case 'coaching':
        case 'sector_delta':
          sampleText = isEs
            ? 'Perdiste dos décimas en el Sector 2. Frená un poco antes en la curva 9.'
            : 'Two tenths down in Sector 2. Brake a touch earlier into Turn 9.';
          break;
        case 'teammate':
        case 'teammate_pitting':
          sampleText = isEs
            ? 'Tu compañero entra a boxes esta vuelta. Quedate afuera, vos seguís.'
            : 'Your teammate is boxing this lap. Stay out, you continue.';
          break;
        case 'qualy':
        case 'qualy_traffic':
          sampleText = isEs
            ? 'Tráfico en el Sector 3 antes de abrir vuelta. Frená el ritmo para armar 4 segundos de aire limpio.'
            : 'Traffic ahead in Sector 3 before hot lap. Slow down to build 4 seconds of clean air.';
          break;
        case 'flags':
        case 'flags_sc':
          sampleText = isEs
            ? '¡Auto de seguridad en pista! Mantené el delta positivo y estate atento a la orden de boxes.'
            : 'Safety Car deployed! Maintain delta positive and stand by for pit call.';
          break;
        default:
          sampleText = isEs
            ? 'Canal de radio verificado. Telemetría y enlace del muro de boxes operando al 100%.'
            : 'Radio check confirmed. Pit wall telemetry link active and operational.';
      }

      await speakMessage(sampleText, true);
    },
    [effectiveLanguage, speakMessage]
  );

  const testRadioTransmission = useCallback(async () => {
    let sampleMessage = '';
    if (effectiveLanguage === 'es') {
      if (persona === RADIO_PERSONAS.BONO) {
        sampleMessage = 'Radio check, te copio fuerte y claro. Modo carrera activado, gestioná la diferencia.';
      } else if (persona === RADIO_PERSONAS.COLAPINTO) {
        sampleMessage = 'Radio check, te copio fuerte y claro. Venís con muy buen ritmo, dale que va.';
      } else {
        sampleMessage = 'Radio check, te copio en boxes. Todos los sistemas en verde.';
      }
    } else {
      if (persona === RADIO_PERSONAS.BONO) {
        sampleMessage = 'Radio check, loud and clear. It is Hammer time, let us manage the delta.';
      } else if (persona === RADIO_PERSONAS.COLAPINTO) {
        sampleMessage = 'Radio check mate, loud and clear! Looking really rapid out there, keep pushing!';
      } else {
        sampleMessage = 'Radio check, pit wall copy. All telemetry systems nominal.';
      }
    }
    await speakMessage(sampleMessage, true);
  }, [effectiveLanguage, persona, speakMessage]);

  return {
    isSpeaking,
    lastResponse,
    setLastResponse,
    speakMessage,
    stopSpeech,
    testRadioTransmission,
    testTriggerAlert,
    beginReplyStream,
    prefetchMessage,
  };
}
