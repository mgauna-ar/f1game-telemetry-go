import { useState, useRef, useCallback } from 'react';
import { RADIO_CONVERSATION_LIMITS } from '../constants/f1';
import { isEdgeBrowser, playRadioBeep, stopRadioSpeech } from '../utils/radioAudio';
import { useI18n, type I18nContextType } from '../context/I18nContext';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import type { AIChatRequest } from '../types/ai';
import { resolveRadioLanguage } from '../utils/chatContext';
import { api } from '../utils/apiClient';
import { chatStreamErrorFromResponse, readChatStream } from '../utils/sseUtils';
import { createSentenceChunker } from '../utils/sentenceChunker';
import { getNotHeardSpeech } from '../utils/radioPhrases';
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
  onPTTPress: () => void;
  onPTTRelease: () => Promise<void>;
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
  // Edge stops hearing a page hidden behind the game, whatever it reports.
  if (isEdgeBrowser() && document.visibilityState === 'hidden') {
    return { message: t('ai_engineer.radio.edgeBehindGame'), radioFault: true };
  }
  if (code === null || code === 'no-speech') return { message: t('ai_engineer.radio.notHeard'), radioFault: false };
  if (code === 'network') return { message: t('ai_engineer.radio.speechNetwork'), radioFault: true };
  return { message: t('ai_engineer.radio.speechError', { code }), radioFault: true };
}

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

  // 1. Speech Recognition Sub-hook
  const {
    transcript,
    startListening,
    stopListening,
    abortListening,
    getFinalTranscript,
    getErrorCode,
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
      if (isSpeaking) {
        setRadioState('speaking');
      } else {
        setRadioState((prev) => (prev === 'speaking' ? 'idle' : prev));
      }
    },
  });

  const stopRadio = useCallback(() => {
    stopSpeech();
    stopRadioSpeech();
    abortListening();
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setRadioState('idle');
  }, [abortListening, stopSpeech]);

  const speakMessage = useCallback(
    async (
      text: string,
      forceInterrupt = false,
      emotion?: { rateModifier?: number; pitchModifier?: number },
      ttlMs?: number
    ) => {
      await ttsSpeakMessage(text, forceInterrupt, emotion, ttlMs);
    },
    [ttsSpeakMessage]
  );

  const onResponseReceivedRef = useRef(onResponseReceived);
  onResponseReceivedRef.current = onResponseReceived;

  const personaRef = useRef(persona);
  personaRef.current = persona;

  const effectiveLanguageRef = useRef(effectiveLanguage);
  effectiveLanguageRef.current = effectiveLanguage;

  const isRadioEnabledRef = useRef(isRadioEnabled);
  isRadioEnabledRef.current = isRadioEnabled;

  const radioStateRef = useRef(radioState);
  radioStateRef.current = radioState;

  const beepsEnabledRef = useRef(beepsEnabled);
  beepsEnabledRef.current = beepsEnabled;

  const driverCallsignRef = useRef(driverCallsign);
  driverCallsignRef.current = driverCallsign;

  const tRef = useRef(t);
  tRef.current = t;

  // The transmission on the air and when its button went down. A newer press replaces it while its
  // release still waits for the last words.
  const transmissionRef = useRef({ startedAt: 0 });

  // Driver/engineer exchanges from this session, sent with each transmission so follow-ups make sense.
  const conversationRef = useRef<RadioConversation>({ sessionKey: '', turns: [] });

  // Handle Gamepad/PTT Press
  const onPTTPress = useCallback(() => {
    if (!isRadioEnabledRef.current || radioStateRef.current === 'transmitting') return;
    // A new transmission replaces an answer still being generated or spoken.
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    stopSpeech();
    stopRadioSpeech();
    setError(null);
    setRadioState('transmitting');
    transmissionRef.current = { startedAt: Date.now() };

    if (beepsEnabledRef.current) {
      playRadioBeep('start');
    }

    // A recognizer that can't start is reported on release, like one that heard nothing.
    startListening();
  }, [startListening, stopSpeech]);

  // Tells the driver a transmission came through without words: the engineer asks to say again, or
  // says the radio isn't working, and the page shows why.
  const reportNotHeard = useCallback(
    (pressMs: number) => {
      const problem = speechProblem(getErrorCode(), tRef.current);
      setRadioState((prev) => (prev === 'transmitting' || prev === 'processing' ? 'idle' : prev));
      // A short tap that heard nothing was an accident, not a question.
      if (!problem.radioFault && pressMs < RADIO_CONVERSATION_LIMITS.MIN_PRESS_FOR_SAY_AGAIN_MS) return;
      setError(problem.message);
      void ttsSpeakMessage(
        getNotHeardSpeech(
          effectiveLanguageRef.current,
          personaRef.current,
          problem.radioFault,
          driverCallsignRef.current
        )
      );
    },
    [getErrorCode, ttsSpeakMessage]
  );

  // Handle Gamepad/PTT Release
  const onPTTRelease = useCallback(async () => {
    if (radioStateRef.current !== 'transmitting') return;
    const transmission = transmissionRef.current;
    const pressMs = Date.now() - transmission.startedAt;

    const stopped = stopListening();

    if (beepsEnabledRef.current) {
      playRadioBeep('end').catch(() => {});
    }

    if (!getFinalTranscript().trim()) {
      // The words said just before the release can still be on their way.
      setRadioState('processing');
      await stopped;
      if (transmissionRef.current !== transmission) return;
    }

    const finalTranscript = getFinalTranscript().trim();
    if (!finalTranscript) {
      reportNotHeard(pressMs);
      return;
    }

    setRadioState('processing');

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
      const sentences = createSentenceChunker((sentence) => speech.pushSentence(sentence));
      const fullReply = (await readChatStream(response, (chunk) => sentences.push(chunk))).trim();
      sentences.flush();
      speech.finish();

      if (fullReply) {
        const turns = [...conversationRef.current.turns, driverTurn, { role: 'assistant' as const, content: fullReply }];
        conversationRef.current.turns = turns.slice(-RADIO_CONVERSATION_LIMITS.MAX_EXCHANGES * 2);
        onResponseReceivedRef.current?.(fullReply);
      } else {
        setRadioState((prev) => (prev === 'processing' ? 'idle' : prev));
      }
    } catch (err: unknown) {
      // An aborted request was replaced by a newer transmission or stopped on purpose.
      if (!abortController.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Error processing radio response';
        setError(msg);
        // Close the radio on whatever part of the answer was already spoken.
        replySpeech?.finish();
      }
      setRadioState((prev) => (prev === 'processing' ? 'idle' : prev));
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null;
      }
    }
  }, [beginReplyStream, getFinalTranscript, reportNotHeard, stopListening]);

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
