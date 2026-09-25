import { useState, useRef, useCallback } from 'react';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_CONVERSATION_LIMITS,
  getSessionTypeName,
  getTrackInfo,
} from '../constants/f1';
import { playRadioBeep, stopRadioSpeech } from '../utils/radioAudio';
import { useI18n } from '../context/I18nContext';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';
import { api } from '../utils/apiClient';
import { readSSEStream } from '../utils/sseUtils';
import { createSentenceChunker } from '../utils/sentenceChunker';
import { useSpeechRecognition } from './useSpeechRecognition';
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
  telemetryContext?: TelemetryContextPayload | null;
  getLiveTelemetrySummary?: () => string;
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
    emotion?: { rateModifier?: number; pitchModifier?: number }
  ) => Promise<void>;
  stopRadio: () => void;
  testRadioTransmission: () => Promise<void>;
  testTriggerAlert: (triggerType: string) => Promise<void>;
  onPTTPress: () => void;
  onPTTRelease: () => Promise<void>;
}

export function useRadioAudio(options: UseRadioAudioOptions = {}): UseRadioAudioReturn {
  const { getLiveTelemetrySummary, onTranscriptReceived, onResponseReceived } = options;
  const { locale: uiLocale } = useI18n();

  const [radioState, setRadioState] = useState<RadioState>('idle');
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Settings from Zustand store
  const isRadioEnabled = useRadioSettingsStore((s) => s.isRadioEnabled);
  const radioLanguage = useRadioSettingsStore((s) => s.radioLanguage);
  const persona = useRadioSettingsStore((s) => s.persona);
  const customPrompt = useRadioSettingsStore((s) => s.customPrompt);
  const driverCallsign = useRadioSettingsStore((s) => s.driverCallsign);
  const beepsEnabled = useRadioSettingsStore((s) => s.beepsEnabled);

  // Compute effective radio language
  const effectiveLanguage: 'es' | 'en' =
    radioLanguage === RADIO_LANGUAGES.AUTO
      ? (uiLocale === 'es' ? 'es' : 'en')
      : (radioLanguage === RADIO_LANGUAGES.ES ? 'es' : 'en');

  // 1. Speech Recognition Sub-hook
  const {
    transcript,
    error: speechError,
    setError: setSpeechError,
    startListening,
    stopListening,
    abortListening,
    getFinalTranscript,
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
      emotion?: { rateModifier?: number; pitchModifier?: number }
    ) => {
      await ttsSpeakMessage(text, forceInterrupt, emotion);
    },
    [ttsSpeakMessage]
  );

  const getLiveTelemetrySummaryRef = useRef(getLiveTelemetrySummary);
  getLiveTelemetrySummaryRef.current = getLiveTelemetrySummary;

  const onResponseReceivedRef = useRef(onResponseReceived);
  onResponseReceivedRef.current = onResponseReceived;

  const personaRef = useRef(persona);
  personaRef.current = persona;

  const customPromptRef = useRef(customPrompt);
  customPromptRef.current = customPrompt;

  const driverCallsignRef = useRef(driverCallsign);
  driverCallsignRef.current = driverCallsign;

  const effectiveLanguageRef = useRef(effectiveLanguage);
  effectiveLanguageRef.current = effectiveLanguage;

  const isRadioEnabledRef = useRef(isRadioEnabled);
  isRadioEnabledRef.current = isRadioEnabled;

  const radioStateRef = useRef(radioState);
  radioStateRef.current = radioState;

  const beepsEnabledRef = useRef(beepsEnabled);
  beepsEnabledRef.current = beepsEnabled;

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
    setRadioState('transmitting');

    if (beepsEnabledRef.current) {
      playRadioBeep('start');
    }

    const started = startListening();
    if (!started) {
      setRadioState('idle');
    }
  }, [startListening, stopSpeech]);

  // Handle Gamepad/PTT Release
  const onPTTRelease = useCallback(async () => {
    if (radioStateRef.current !== 'transmitting') return;

    stopListening();

    if (beepsEnabledRef.current) {
      playRadioBeep('end').catch(() => {});
    }

    if (!getFinalTranscript().trim()) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    const finalTranscript = getFinalTranscript().trim();
    if (!finalTranscript) {
      setRadioState('idle');
      return;
    }

    setRadioState('processing');

    let replySpeech: ReplySpeechStream | null = null;
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;
    try {

      const liveContext = getLiveTelemetrySummaryRef.current ? getLiveTelemetrySummaryRef.current() : '';

      const currentPersona = personaRef.current;
      const currentLanguage = effectiveLanguageRef.current;
      const currentCustomPrompt = customPromptRef.current;
      const currentDriverCallsign = driverCallsignRef.current;

      const sessionState = useSessionStatusStore.getState();
      const packetFormat = sessionState.packetFormat || 2026;
      const currentSession = sessionState.session;
      const sessionType = currentSession ? getSessionTypeName(currentSession.SessionType) : undefined;
      const trackName =
        currentSession?.TrackId !== undefined ? getTrackInfo(currentSession.TrackId)?.name : undefined;

      const sessionKey = currentSession?.SessionUID !== undefined ? String(currentSession.SessionUID) : '';
      if (conversationRef.current.sessionKey !== sessionKey) {
        conversationRef.current = { sessionKey, turns: [] };
      }
      const driverTurn: RadioConversationTurn = {
        role: 'user',
        content: `[DRIVER RADIO TRANSMISSION]: "${finalTranscript}"`,
      };
      let drivingPhase = 'RACING';
      if (liveContext.includes('POST-RACE')) drivingPhase = 'POST_RACE';
      else if (liveContext.includes('STARTING GRID')) drivingPhase = 'GRID';
      else if (liveContext.includes('RACE START')) drivingPhase = 'RACE_START';
      else if (liveContext.includes('IN-LAP')) drivingPhase = 'IN_LAP';

      const response = await api.stream(
        '/api/ai/chat',
        {
          // Provider, model and API key come from the server's saved AI settings.
          persona: currentPersona,
          language: currentLanguage,
          messages: [...conversationRef.current.turns, driverTurn],
          context: {
            context_mode: 'live',
            live_summary: liveContext,
            session_type: sessionType,
            track_name: trackName,
            custom_persona_prompt: currentPersona === RADIO_PERSONAS.CUSTOM ? currentCustomPrompt : undefined,
            driver_callsign: currentDriverCallsign || undefined,
            urgency_level: 'normal',
            packet_format: packetFormat,
            driving_phase: drivingPhase,
          },
        },
        abortController.signal
      );

      if (!response.ok) {
        throw new Error(`AI Service returned status ${response.status}`);
      }

      // Speak each sentence as soon as it arrives instead of waiting for the whole reply.
      const speech = beginReplyStream();
      replySpeech = speech;
      const sentences = createSentenceChunker((sentence) => speech.pushSentence(sentence));
      const fullReply = (await readSSEStream(response, (chunk) => sentences.push(chunk))).trim();
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
        setSpeechError(msg);
        // Close the radio on whatever part of the answer was already spoken.
        replySpeech?.finish();
      }
      setRadioState((prev) => (prev === 'processing' ? 'idle' : prev));
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null;
      }
    }
  }, [beginReplyStream, getFinalTranscript, setSpeechError, stopListening]);

  return {
    radioState,
    lastTranscript: transcript || null,
    lastResponse,
    error: speechError,
    effectiveLanguage,
    speakMessage,
    stopRadio,
    testRadioTransmission,
    testTriggerAlert,
    onPTTPress,
    onPTTRelease,
  };
}
