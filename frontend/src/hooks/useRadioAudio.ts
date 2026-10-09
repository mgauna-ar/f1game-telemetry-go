import { useState, useRef, useCallback } from 'react';
import { RADIO_CONVERSATION_LIMITS } from '../constants/f1';
import { playRadioBeep, stopRadioSpeech } from '../utils/radioAudio';
import { useI18n, type I18nContextType } from '../context/I18nContext';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import type { AIChatRequest } from '../types/ai';
import type { ExchangeLine, PTTSource, PTTTraceOutcome, PTTTraceRequest, RadioEmotion } from '../types/telemetry';
import { resolveRadioLanguage } from '../utils/chatContext';
import { api } from '../utils/apiClient';
import { chatStreamErrorFromResponse, readChatStream } from '../utils/sseUtils';
import { createSentenceChunker } from '../utils/sentenceChunker';
import { getExchangeSpeech } from '../utils/radioPhrases';
import { SPEECH_NOT_SUPPORTED, useSpeechRecognition } from './useSpeechRecognition';
import { useTTSPlayback, type ReplySpeechStream } from './useTTSPlayback';

export type RadioState = 'idle' | 'transmitting' | 'processing' | 'speaking';

interface RadioConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface RadioConversation {
  sessionKey: string;
  turns: RadioConversationTurn[];
}

export interface UseRadioAudioOptions {
  onTranscriptReceived?: (transcript: string) => void;
  onResponseReceived?: (response: string) => void;
}

export interface UseRadioAudioReturn {
  radioState: RadioState;
  lastTranscript: string | null;
  lastResponse: string | null;
  error: string | null;
  effectiveLanguage: 'es' | 'en';
  speakMessage: (
    text: string,
    forceInterrupt?: boolean,
    emotion?: { rateModifier?: number; pitchModifier?: number },
    ttlMs?: number
  ) => Promise<void>;
  stopRadio: () => void;
  testRadioTransmission: () => Promise<void>;
  testTriggerAlert: (triggerType: string) => Promise<void>;
  /** The push-to-talk button went down; `source` says where it was heard, for the trace. */
  onPTTPress: (source?: PTTSource) => void;
  /** The push-to-talk button was let go. */
  onPTTRelease: (source?: PTTSource) => Promise<void>;
}

/**
 * One push-to-talk exchange, from the button going down to the end of what the engineer says back.
 * Pit wall calls wait while it lasts: all of them while the driver talks, routine ones until the
 * answer is over.
 */
interface RadioExchange {
  /** The button is still down. */
  transmitting: boolean;
  pressedAt: number;
  releasedAt: number;
  /** When the answer's first sentence arrived; 0 until then. */
  firstSentenceAt: number;
  standByTimer?: ReturnType<typeof setTimeout>;
  ended: boolean;
  /** What happened, for the app log. */
  trace: PTTTraceRequest;
}

/** A pit wall call that came in during an exchange. */
interface HeldCall {
  text: string;
  urgent: boolean;
  emotion?: RadioEmotion;
  /** Epoch ms after which the call is stale and is dropped instead of spoken. */
  expiresAt?: number;
}

/** Why a transmission came through without words. */
interface SpeechProblem {
  /** What the page shows. */
  message: string;
  /** The radio itself isn't working, rather than nothing being said or understood. */
  radioFault: boolean;
}

/** Why the radio didn't understand a transmission, from the recognizer's error code (null when it reported none). */
function speechProblem(code: string | null, t: I18nContextType['t']): SpeechProblem {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return { message: t('ai_engineer.radio.micBlocked'), radioFault: true };
    case 'audio-capture':
      return { message: t('ai_engineer.radio.noMicrophone'), radioFault: true };
    case SPEECH_NOT_SUPPORTED:
      return { message: t('ai_engineer.radio.notSupported'), radioFault: true };
  }
  if (code === null || code === 'no-speech') return { message: t('ai_engineer.radio.notHeard'), radioFault: false };
  if (code === 'network') return { message: t('ai_engineer.radio.speechNetwork'), radioFault: true };
  return { message: t('ai_engineer.radio.speechError', { code }), radioFault: true };
}

/** Whether the page is in front, rather than hidden behind the game or another window. */
const isPageVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

const newTrace = (): PTTTraceRequest => ({
  outcome: 'replaced',
  held_ms: 0,
  visible_at_press: isPageVisible(),
  visible_at_release: false,
  recognizer_started: false,
  audio_started: false,
  speech_detected: false,
  results: 0,
  total_ms: 0,
  stand_by: false,
  calls_held: 0,
});

/** The longest text a trace carries to the log. */
const TRACE_MAX_TEXT = 200;

export function useRadioAudio(options: UseRadioAudioOptions = {}): UseRadioAudioReturn {
  const { onTranscriptReceived, onResponseReceived } = options;
  const { locale: uiLocale, t } = useI18n();

  const [radioState, setRadioState] = useState<RadioState>('idle');
  const [error, setError] = useState<string | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Settings from Zustand store
  const isRadioEnabled = useRadioSettingsStore((s) => s.isRadioEnabled);
  const radioLanguage = useRadioSettingsStore((s) => s.radioLanguage);
  const persona = useRadioSettingsStore((s) => s.persona);
  const beepsEnabled = useRadioSettingsStore((s) => s.beepsEnabled);
  const driverCallsign = useRadioSettingsStore((s) => s.driverCallsign);

  // Compute effective radio language
  const effectiveLanguage = resolveRadioLanguage(radioLanguage, uiLocale);

  // Whether radio speech is playing right now
  const speakingRef = useRef(false);

  // 1. Speech Recognition Sub-hook
  const {
    transcript,
    startListening,
    stopListening,
    abortListening,
    getFinalTranscript,
    getErrorCode,
    getReport,
  } = useSpeechRecognition({
    getLang: () => (effectiveLanguage === 'es' ? 'es-AR' : 'en-GB'),
    onTranscriptReceived,
  });

  // 2. TTS Playback Sub-hook
  const {
    lastResponse,
    speakMessage: ttsSpeakMessage,
    stopSpeech,
    testRadioTransmission,
    testTriggerAlert,
    beginReplyStream,
  } = useTTSPlayback({
    effectiveLanguage,
    onResponseReceived,
    onSpeakingChange: (isSpeaking) => {
      speakingRef.current = isSpeaking;
      if (isSpeaking) {
        setRadioState('speaking');
      } else {
        setRadioState((prev) => (prev === 'speaking' ? 'idle' : prev));
      }
    },
  });

  const onResponseReceivedRef = useRef(onResponseReceived);
  onResponseReceivedRef.current = onResponseReceived;

  const personaRef = useRef(persona);
  personaRef.current = persona;

  const effectiveLanguageRef = useRef(effectiveLanguage);
  effectiveLanguageRef.current = effectiveLanguage;

  const isRadioEnabledRef = useRef(isRadioEnabled);
  isRadioEnabledRef.current = isRadioEnabled;

  const beepsEnabledRef = useRef(beepsEnabled);
  beepsEnabledRef.current = beepsEnabled;

  const driverCallsignRef = useRef(driverCallsign);
  driverCallsignRef.current = driverCallsign;

  const tRef = useRef(t);
  tRef.current = t;

  // The push-to-talk exchange under way, if any, and the pit wall calls waiting for it to end.
  const exchangeRef = useRef<RadioExchange | null>(null);
  const heldCallsRef = useRef<HeldCall[]>([]);

  // Driver/engineer exchanges from this session, sent with each transmission so follow-ups make sense.
  const conversationRef = useRef<RadioConversation>({ sessionKey: '', turns: [] });

  /** The engineer's own line in the exchange, in the radio's language and persona. */
  const exchangeLine = useCallback(
    (line: ExchangeLine) =>
      getExchangeSpeech(line, effectiveLanguageRef.current, personaRef.current, driverCallsignRef.current),
    []
  );

  // Says the pit wall calls that waited for the driver, dropping the stale ones. With urgentOnly
  // the routine calls keep waiting.
  const playHeldCalls = useCallback(
    (urgentOnly: boolean) => {
      const now = Date.now();
      const waiting: HeldCall[] = [];
      for (const call of heldCallsRef.current) {
        if (call.expiresAt !== undefined && call.expiresAt <= now) continue;
        if (urgentOnly && !call.urgent) {
          waiting.push(call);
          continue;
        }
        const ttlMs = call.expiresAt === undefined ? undefined : call.expiresAt - now;
        void ttsSpeakMessage(call.text, call.urgent, call.emotion, ttlMs);
      }
      heldCallsRef.current = waiting;
    },
    [ttsSpeakMessage]
  );

  // Ends an exchange: logs what happened and lets the pit wall talk again. The calls of an exchange
  // a newer press replaced keep waiting for the new one.
  const endExchange = useCallback(
    (exchange: RadioExchange, outcome: PTTTraceOutcome) => {
      if (exchange.ended) return;
      exchange.ended = true;
      clearTimeout(exchange.standByTimer);
      const current = exchangeRef.current === exchange;
      const { trace } = exchange;
      trace.outcome = current ? outcome : 'replaced';
      trace.total_ms = Date.now() - (exchange.releasedAt || exchange.pressedAt);
      api.post('/api/ai/ptt/trace', trace).catch(() => {});
      if (current) {
        exchangeRef.current = null;
        playHeldCalls(false);
      }
    },
    [playHeldCalls]
  );

  const stopRadio = useCallback(() => {
    const exchange = exchangeRef.current;
    exchangeRef.current = null;
    heldCallsRef.current = [];
    stopSpeech();
    stopRadioSpeech();
    abortListening();
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setRadioState('idle');
    if (exchange) endExchange(exchange, 'replaced');
  }, [abortListening, endExchange, stopSpeech]);

  // Proactive pit wall calls. The pit wall doesn't talk over the driver, and routine calls also wait
  // for the answer to the driver's question.
  const speakMessage = useCallback(
    async (
      text: string,
      forceInterrupt = false,
      emotion?: { rateModifier?: number; pitchModifier?: number },
      ttlMs?: number
    ) => {
      const exchange = exchangeRef.current;
      if (exchange && (exchange.transmitting || !forceInterrupt)) {
        const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
        heldCallsRef.current.push({ text, urgent: forceInterrupt, emotion, expiresAt });
        exchange.trace.calls_held += 1;
        return;
      }
      await ttsSpeakMessage(text, forceInterrupt, emotion, ttlMs);
    },
    [ttsSpeakMessage]
  );

  // Handle Gamepad/PTT Press
  const onPTTPress = useCallback((source?: PTTSource) => {
    if (!isRadioEnabledRef.current || exchangeRef.current?.transmitting) return;
    // A new transmission replaces an answer still being generated or spoken.
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    stopSpeech();
    stopRadioSpeech();
    setError(null);
    setRadioState('transmitting');
    exchangeRef.current = {
      transmitting: true,
      pressedAt: Date.now(),
      releasedAt: 0,
      firstSentenceAt: 0,
      ended: false,
      trace: { ...newTrace(), press_source: source },
    };

    if (beepsEnabledRef.current) {
      playRadioBeep('start');
    }

    // A recognizer that can't start is reported on release, like one that heard nothing.
    startListening();
  }, [startListening, stopSpeech]);

  // Handle Gamepad/PTT Release
  const onPTTRelease = useCallback(async (source?: PTTSource) => {
    const exchange = exchangeRef.current;
    if (!exchange || !exchange.transmitting) return;
    const { trace } = exchange;
    trace.release_source = source;
    exchange.transmitting = false;
    exchange.releasedAt = Date.now();
    trace.held_ms = exchange.releasedAt - exchange.pressedAt;
    trace.visible_at_release = isPageVisible();
    setRadioState('processing');

    const stopped = stopListening();

    if (beepsEnabledRef.current) {
      playRadioBeep('end').catch(() => {});
    }
    // Urgent calls that waited for the driver to finish go out now.
    playHeldCalls(true);

    // The words said just before the release can still be on their way.
    await stopped;
    if (exchangeRef.current !== exchange) {
      endExchange(exchange, 'replaced');
      return;
    }

    const report = getReport();
    const errorCode = getErrorCode();
    trace.recognizer_started = report.started;
    trace.audio_started = report.audio;
    trace.speech_detected = report.speech;
    trace.results = report.results;
    if (errorCode) trace.recognizer_error = errorCode;

    const finalTranscript = getFinalTranscript().trim();
    if (!finalTranscript) {
      // The engineer asks to say again, or says the radio isn't working, and the page shows why.
      const problem = speechProblem(errorCode, tRef.current);
      setRadioState((prev) => (prev === 'processing' ? 'idle' : prev));
      // A short tap that heard nothing was an accident, not a question.
      if (!problem.radioFault && trace.held_ms < RADIO_CONVERSATION_LIMITS.MIN_PRESS_FOR_SAY_AGAIN_MS) {
        endExchange(exchange, 'tap');
        return;
      }
      setError(problem.message);
      await ttsSpeakMessage(exchangeLine(problem.radioFault ? 'radio_fault' : 'say_again'));
      endExchange(exchange, problem.radioFault ? 'radio_fault' : 'not_heard');
      return;
    }
    trace.heard = finalTranscript.slice(0, TRACE_MAX_TEXT);

    // Without the answer soon, the engineer tells the driver the question came through.
    exchange.standByTimer = setTimeout(() => {
      if (exchangeRef.current !== exchange || exchange.firstSentenceAt || speakingRef.current) return;
      trace.stand_by = true;
      void ttsSpeakMessage(exchangeLine('stand_by'));
    }, RADIO_CONVERSATION_LIMITS.STAND_BY_AFTER_MS);

    let replySpeech: ReplySpeechStream | null = null;
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;
    try {
      // The session UID only resets the conversation; the server builds the race briefing,
      // driving phase, call-sign and custom persona itself.
      const currentSession = useSessionStatusStore.getState().session;
      const sessionKey = currentSession?.SessionUID !== undefined ? String(currentSession.SessionUID) : '';
      if (conversationRef.current.sessionKey !== sessionKey) {
        conversationRef.current = { sessionKey, turns: [] };
      }
      const driverTurn: RadioConversationTurn = {
        role: 'user',
        content: `[DRIVER RADIO TRANSMISSION]: "${finalTranscript}"`,
      };

      const body: AIChatRequest = {
        // Provider, model and API key come from the server's saved AI settings.
        persona: personaRef.current,
        language: effectiveLanguageRef.current,
        messages: [...conversationRef.current.turns, driverTurn],
        context: { context_mode: 'live' },
      };
      const response = await api.stream('/api/ai/chat', body, abortController.signal);

      if (!response.ok) {
        throw await chatStreamErrorFromResponse(response);
      }

      // Speak each sentence as soon as it arrives instead of waiting for the whole reply.
      const speech = beginReplyStream();
      replySpeech = speech;
      const sentences = createSentenceChunker((sentence) => {
        if (!exchange.firstSentenceAt) {
          exchange.firstSentenceAt = Date.now();
          trace.first_sentence_ms = exchange.firstSentenceAt - exchange.releasedAt;
        }
        speech.pushSentence(sentence);
      });
      const fullReply = (await readChatStream(response, (chunk) => sentences.push(chunk))).trim();
      sentences.flush();
      speech.finish();

      if (!fullReply) {
        throw new Error(tRef.current('ai_engineer.errors.emptyResponseDesc'));
      }
      const turns = [...conversationRef.current.turns, driverTurn, { role: 'assistant' as const, content: fullReply }];
      conversationRef.current.turns = turns.slice(-RADIO_CONVERSATION_LIMITS.MAX_EXCHANGES * 2);
      onResponseReceivedRef.current?.(fullReply);

      await speech.done;
      endExchange(exchange, 'answered');
    } catch (err: unknown) {
      clearTimeout(exchange.standByTimer);
      // An aborted request was replaced by a newer transmission or stopped on purpose.
      if (abortController.signal.aborted) {
        endExchange(exchange, 'replaced');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Error processing radio response';
      setError(msg);
      trace.ai_error = msg.slice(0, TRACE_MAX_TEXT);
      // Close the radio on whatever part of the answer was already spoken.
      replySpeech?.finish();
      if (exchange.firstSentenceAt && replySpeech) {
        await replySpeech.done;
      } else {
        setRadioState((prev) => (prev === 'processing' ? 'idle' : prev));
        await ttsSpeakMessage(exchangeLine('answer_failed'));
      }
      endExchange(exchange, 'answer_failed');
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null;
      }
    }
  }, [
    beginReplyStream,
    endExchange,
    exchangeLine,
    getErrorCode,
    getFinalTranscript,
    getReport,
    playHeldCalls,
    stopListening,
    ttsSpeakMessage,
  ]);

  return {
    radioState,
    lastTranscript: transcript || null,
    lastResponse,
    error,
    effectiveLanguage,
    speakMessage,
    stopRadio,
    testRadioTransmission,
    testTriggerAlert,
    onPTTPress,
    onPTTRelease,
  };
}
