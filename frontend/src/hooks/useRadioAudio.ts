import { useState, useRef, useCallback } from 'react';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
} from '../constants/f1';
import { playRadioBeep, stopRadioSpeech } from '../utils/radioAudio';
import { useI18n } from '../context/I18nContext';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';
import { api } from '../utils/apiClient';
import { storage } from '../utils/storage';
import { readSSEStream } from '../utils/sseUtils';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useTTSPlayback } from './useTTSPlayback';

export type RadioState = 'idle' | 'transmitting' | 'processing' | 'speaking';

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

  // Handle Gamepad/PTT Press
  const onPTTPress = useCallback(() => {
    if (!isRadioEnabledRef.current || radioStateRef.current === 'transmitting') return;
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

    try {
      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;

      const liveContext = getLiveTelemetrySummaryRef.current ? getLiveTelemetrySummaryRef.current() : '';

      let aiProvider = 'gemini';
      let aiApiKey = '';
      let aiModel = 'gemini-flash-lite-latest';
      let aiBaseUrl = '';

      interface StoredAIConfig {
        provider?: string;
        apiKey?: string;
        model?: string;
        baseUrl?: string;
        providerKeys?: Record<string, string>;
        providerModels?: Record<string, string>;
      }
      const parsed = storage.get<StoredAIConfig | null>('f1_ai_engineer_config', null);
      if (parsed) {
        if (parsed.provider) aiProvider = parsed.provider;
        if (parsed.apiKey) aiApiKey = parsed.apiKey;
        if (parsed.model) aiModel = parsed.model;
        if (parsed.baseUrl) aiBaseUrl = parsed.baseUrl;
        if (parsed.providerKeys && parsed.provider && parsed.providerKeys[parsed.provider]) {
          aiApiKey = parsed.providerKeys[parsed.provider];
        }
        if (parsed.providerModels && parsed.provider && parsed.providerModels[parsed.provider]) {
          aiModel = parsed.providerModels[parsed.provider];
        }
      }

      const currentPersona = personaRef.current;
      const currentLanguage = effectiveLanguageRef.current;
      const currentCustomPrompt = customPromptRef.current;
      const currentDriverCallsign = driverCallsignRef.current;

      const response = await api.stream(
        '/api/ai/chat',
        {
          provider: aiProvider,
          api_key: aiApiKey,
          model: aiModel,
          base_url: aiBaseUrl,
          persona: currentPersona,
          language: currentLanguage,
          messages: [
            {
              role: 'user',
              content: `[DRIVER RADIO TRANSMISSION]: "${finalTranscript}"`,
            },
          ],
          context: {
            context_mode: 'live',
            live_summary: liveContext,
            custom_persona_prompt: currentPersona === RADIO_PERSONAS.CUSTOM ? currentCustomPrompt : undefined,
            driver_callsign: currentDriverCallsign || undefined,
            urgency_level: 'normal',
          },
        },
        abortController.signal
      );

      if (!response.ok) {
        throw new Error(`AI Service returned status ${response.status}`);
      }

      const fullReply = await readSSEStream(response);

      if (fullReply.trim()) {
        if (onResponseReceivedRef.current) {
          onResponseReceivedRef.current(fullReply.trim());
        }
        await ttsSpeakMessage(fullReply.trim());
      } else {
        setRadioState('idle');
      }
    } catch (err: unknown) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        const msg = err instanceof Error ? err.message : 'Error processing radio response';
        setSpeechError(msg);
      }
      setRadioState('idle');
    } finally {
      activeAbortControllerRef.current = null;
    }
  }, [getFinalTranscript, setSpeechError, stopListening, ttsSpeakMessage]);

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
