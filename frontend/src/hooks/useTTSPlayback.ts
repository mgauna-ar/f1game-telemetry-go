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
}

type SpeechEmotion = { rateModifier?: number; pitchModifier?: number };

interface SpeechQueueItem {
  id: string;
  text: string;
  emotion?: SpeechEmotion;
  /** Set on sentences of a streamed reply. */
  stream?: ReplyStreamState;
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
}

const newQueueItemId = () => Math.random().toString(36).substring(2, 9);

export interface UseTTSPlaybackReturn {
  isSpeaking: boolean;
  lastResponse: string | null;
  setLastResponse: React.Dispatch<React.SetStateAction<string | null>>;
  speakMessage: (
    text: string,
    forceInterrupt?: boolean,
    emotion?: { rateModifier?: number; pitchModifier?: number }
  ) => Promise<void>;
  stopSpeech: () => void;
  testRadioTransmission: () => Promise<void>;
  testTriggerAlert: (triggerType: string) => Promise<void>;
  beginReplyStream: () => ReplySpeechStream;
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
  const queueRef = useRef<SpeechQueueItem[]>([]);
  const streamRef = useRef<ReplyStreamState | null>(null);
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

  const cancelReplyStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.cancelled = true;
    streamRef.current = null;
    queueRef.current = queueRef.current.filter((item) => item.stream !== stream);
  }, []);

  const hasQueuedSentences = (stream: ReplyStreamState) => queueRef.current.some((item) => item.stream === stream);

  // Closes a finished reply: the end beep once after its last sentence, then the radio is free.
  const closeReplyStream = useCallback(
    async (stream: ReplyStreamState) => {
      if (streamRef.current === stream) streamRef.current = null;
      if (stream.started && beepsEnabled && !stream.cancelled) {
        await playRadioBeep('end', volume);
      }
    },
    [beepsEnabled, volume]
  );

  const playNext = useCallback(async () => {
    if (!isRadioEnabled || queueRef.current.length === 0) {
      const stream = streamRef.current;
      if (isRadioEnabled && stream && !stream.finished && !stream.cancelled) {
        // Keep the radio open while the rest of the reply is generated.
        stream.awaiting = true;
        return;
      }
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      onSpeakingChangeRef.current?.(false);
      return;
    }

    const item = queueRef.current.shift()!;
    const stream = item.stream;
    isSpeakingRef.current = true;
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
      setLastResponse(item.text);
      onResponseReceivedRef.current?.(item.text);
    }

    const next = async () => {
      if (stream) {
        if (stream.cancelled) return;
        if (stream.finished && !hasQueuedSentences(stream)) {
          await closeReplyStream(stream);
        }
      }
      playNext();
    };

    try {
      await speakRadioResponse(item.text, { ...options, onEnd: next, onError: next });
    } catch {
      next();
    }
  }, [isRadioEnabled, beepsEnabled, speechOptions, closeReplyStream]);

  const stopSpeech = useCallback(() => {
    cancelReplyStream();
    queueRef.current = [];
    isSpeakingRef.current = false;
    stopRadioSpeech();
    setIsSpeaking(false);
    onSpeakingChangeRef.current?.(false);
  }, [cancelReplyStream]);

  const beginReplyStream = useCallback((): ReplySpeechStream => {
    // A new reply supersedes one still being spoken.
    if (streamRef.current) stopSpeech();
    const stream: ReplyStreamState = { started: false, finished: false, cancelled: false, awaiting: false, spoken: '' };
    streamRef.current = stream;

    return {
      pushSentence: (sentence: string) => {
        const cleaned = cleanRadioSpeechText(sentence);
        if (stream.cancelled || stream.finished || !isRadioEnabled || !cleaned) return;

        prefetchRadioSpeech(cleaned, speechOptions());
        // The driver's answer goes ahead of queued pit wall calls, after its own earlier sentences.
        const queue = queueRef.current;
        let insertAt = 0;
        while (insertAt < queue.length && queue[insertAt].stream === stream) insertAt++;
        queue.splice(insertAt, 0, { id: newQueueItemId(), text: cleaned, stream });

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
          closeReplyStream(stream).then(() => {
            if (wasAwaiting) playNext();
          });
        }
      },
    };
  }, [isRadioEnabled, speechOptions, stopSpeech, closeReplyStream, playNext]);

  const speakMessage = useCallback(
    async (
      text: string,
      forceInterrupt = false,
      emotion?: { rateModifier?: number; pitchModifier?: number }
    ) => {
      const cleaned = cleanRadioSpeechText(text);
      if (!isRadioEnabled || !cleaned) return;

      if (forceInterrupt) {
        // Critical emergency or forced interrupt: halt current audio, any reply being spoken,
        // and the non-critical backlog
        cancelReplyStream();
        queueRef.current = [];
        stopRadioSpeech();
        isSpeakingRef.current = false;
        queueRef.current.push({ id: newQueueItemId(), text: cleaned, emotion });
        await playNext();
        return;
      }

      // Non-critical directive: if already speaking, queue it sequentially up to MAX_QUEUE_SIZE
      if (isSpeakingRef.current) {
        const queuedCalls = queueRef.current.filter((item) => !item.stream).length;
        if (queuedCalls < MAX_QUEUE_SIZE) {
          queueRef.current.push({ id: newQueueItemId(), text: cleaned, emotion });
        }
        return;
      }

      // Not currently speaking, play immediately
      queueRef.current.push({ id: newQueueItemId(), text: cleaned, emotion });
      await playNext();
    },
    [isRadioEnabled, playNext, cancelReplyStream]
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
  };
}
