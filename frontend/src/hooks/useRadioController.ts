import { useState, useRef, useCallback } from 'react';
import {
  RADIO_STORAGE_KEYS,
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  RADIO_AUDIO_CONSTANTS,
  type RadioPersona,
  type RadioLanguage,
} from '../constants/f1';
import {
  playRadioBeep,
  speakRadioResponse,
  stopRadioSpeech,
  getSpeechRecognitionClass,
  isSpeechRecognitionSupported,
  type ISpeechRecognition,
} from '../utils/radioAudio';
import { useGamepadPTT, type GamepadMapping } from './useGamepadPTT';
import { useI18n } from '../context/I18nContext';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';

export type RadioState = 'idle' | 'transmitting' | 'processing' | 'speaking';

export interface UseRadioControllerOptions {
  telemetryContext?: TelemetryContextPayload | null;
  getLiveTelemetrySummary?: () => string;
  onTranscriptReceived?: (transcript: string) => void;
  onResponseReceived?: (response: string) => void;
}

export interface UseRadioControllerReturn {
  radioState: RadioState;
  isRadioEnabled: boolean;
  setIsRadioEnabled: (enabled: boolean) => void;
  persona: RadioPersona;
  setPersona: (p: RadioPersona) => void;
  radioLanguage: RadioLanguage;
  setRadioLanguage: (lang: RadioLanguage) => void;
  effectiveLanguage: 'es' | 'en';
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  beepsEnabled: boolean;
  setBeepsEnabled: (enabled: boolean) => void;
  filterEnabled: boolean;
  setFilterEnabled: (enabled: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  neuralVoice: string;
  setNeuralVoice: (v: string) => void;
  lastTranscript: string | null;
  lastResponse: string | null;
  error: string | null;
  // PTT props passed through from useGamepadPTT
  isPTTActive: boolean;
  isLearning: boolean;
  startLearning: () => void;
  cancelLearning: () => void;
  mappedGamepadButton: GamepadMapping | null;
  setMappedGamepadButton: (mapping: GamepadMapping | null) => void;
  mappedKey: string;
  setMappedKey: (key: string) => void;
  gamepadConnected: boolean;
  gamepadName: string | null;
  // Actions
  testRadioTransmission: () => Promise<void>;
  stopRadio: () => void;
  speakMessage: (text: string, forceInterrupt?: boolean) => Promise<void>;
}

export function useRadioController(options: UseRadioControllerOptions = {}): UseRadioControllerReturn {
  const { telemetryContext, getLiveTelemetrySummary, onTranscriptReceived, onResponseReceived } = options;
  const { locale: uiLocale } = useI18n();

  const [radioState, setRadioState] = useState<RadioState>('idle');
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings from localStorage
  const [isRadioEnabled, setIsRadioEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_ENABLED);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [persona, setPersonaState] = useState<RadioPersona>(() => {
    if (typeof window === 'undefined') return RADIO_PERSONAS.COLAPINTO;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.PERSONA) as RadioPersona;
      if (saved && Object.values(RADIO_PERSONAS).includes(saved)) return saved;
      return RADIO_PERSONAS.COLAPINTO;
    } catch {
      return RADIO_PERSONAS.COLAPINTO;
    }
  });

  const [radioLanguage, setRadioLanguageState] = useState<RadioLanguage>(() => {
    if (typeof window === 'undefined') return RADIO_LANGUAGES.AUTO;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.LANGUAGE) as RadioLanguage;
      if (saved && Object.values(RADIO_LANGUAGES).includes(saved)) return saved;
      return RADIO_LANGUAGES.AUTO;
    } catch {
      return RADIO_LANGUAGES.AUTO;
    }
  });

  const [customPrompt, setCustomPromptState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(RADIO_STORAGE_KEYS.CUSTOM_PROMPT) || '';
    } catch {
      return '';
    }
  });

  const [beepsEnabled, setBeepsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.BEEPS_ENABLED);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [filterEnabled, setFilterEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.FILTER_ENABLED);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window === 'undefined') return RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.VOLUME);
      return saved !== null ? parseFloat(saved) : RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME;
    } catch {
      return RADIO_AUDIO_CONSTANTS.DEFAULT_VOLUME;
    }
  });

  const [neuralVoice, setNeuralVoiceState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(RADIO_STORAGE_KEYS.NEURAL_VOICE) || '';
    } catch {
      return '';
    }
  });

  const setIsRadioEnabled = useCallback((enabled: boolean) => {
    setIsRadioEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.ALERTS_ENABLED, String(enabled));
    } catch {}
  }, []);

  const setPersona = useCallback((p: RadioPersona) => {
    setPersonaState(p);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.PERSONA, p);
    } catch {}
  }, []);

  const setRadioLanguage = useCallback((lang: RadioLanguage) => {
    setRadioLanguageState(lang);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.LANGUAGE, lang);
    } catch {}

    // Reset neural voice if it belongs to a mismatched language family
    const nextEffectiveLang: 'es' | 'en' =
      lang === RADIO_LANGUAGES.AUTO
        ? (uiLocale === 'es' ? 'es' : 'en')
        : (lang === RADIO_LANGUAGES.ES ? 'es' : 'en');

    setNeuralVoiceState((currentVoice) => {
      if (
        (nextEffectiveLang === 'es' && currentVoice.startsWith('en-')) ||
        (nextEffectiveLang === 'en' && currentVoice.startsWith('es-'))
      ) {
        try {
          localStorage.removeItem(RADIO_STORAGE_KEYS.NEURAL_VOICE);
        } catch {}
        return '';
      }
      return currentVoice;
    });
  }, [uiLocale]);

  const setCustomPrompt = useCallback((prompt: string) => {
    setCustomPromptState(prompt);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.CUSTOM_PROMPT, prompt);
    } catch {}
  }, []);

  const setBeepsEnabled = useCallback((enabled: boolean) => {
    setBeepsEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.BEEPS_ENABLED, String(enabled));
    } catch {}
  }, []);

  const setFilterEnabled = useCallback((enabled: boolean) => {
    setFilterEnabledState(enabled);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.FILTER_ENABLED, String(enabled));
    } catch {}
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.VOLUME, String(clamped));
    } catch {}
  }, []);

  const setNeuralVoice = useCallback((v: string) => {
    setNeuralVoiceState(v);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.NEURAL_VOICE, v);
    } catch {}
  }, []);

  // Compute effective radio language based on setting and current UI locale
  const effectiveLanguage: 'es' | 'en' =
    radioLanguage === RADIO_LANGUAGES.AUTO
      ? (uiLocale === 'es' ? 'es' : 'en')
      : (radioLanguage === RADIO_LANGUAGES.ES ? 'es' : 'en');

  // Recognition instance & refs
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const currentTranscriptRef = useRef<string>('');
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const getRecognitionLang = useCallback(() => {
    return effectiveLanguage === 'es' ? 'es-AR' : 'en-GB';
  }, [effectiveLanguage]);

  const stopRadio = useCallback(() => {
    stopRadioSpeech();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setRadioState('idle');
  }, []);

  // Play spoken response through radio audio pipeline
  const speakMessage = useCallback(
    async (text: string, forceInterrupt = false) => {
      if (!isRadioEnabled || !text.trim()) return;

      if (forceInterrupt) {
        stopRadio();
      }

      setRadioState('speaking');
      setLastResponse(text);
      onResponseReceived?.(text);

      await speakRadioResponse(text, {
        volume,
        voice: neuralVoice || undefined,
        persona,
        language: effectiveLanguage,
        enableBeeps: beepsEnabled,
        enableCockpitFilter: filterEnabled,
        onEnd: () => {
          setRadioState('idle');
        },
        onError: () => {
          setRadioState('idle');
        },
      });
    },
    [isRadioEnabled, beepsEnabled, filterEnabled, volume, neuralVoice, persona, effectiveLanguage, onResponseReceived, stopRadio]
  );

  // Send driver transcript to LLM backend
  const processTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) {
        setRadioState('idle');
        return;
      }

      setRadioState('processing');
      setError(null);

      // Load AI config from localStorage if available
      let aiProvider = 'gemini';
      let aiApiKey = '';
      let aiModel = 'gemini-flash-lite-latest';
      let aiBaseUrl = '';

      try {
        const savedConfig = localStorage.getItem('f1_ai_engineer_config');
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig);
          if (parsed.provider) aiProvider = parsed.provider;
          if (parsed.providerKeys?.[aiProvider]) {
            aiApiKey = parsed.providerKeys[aiProvider];
          } else if (parsed.apiKey) {
            aiApiKey = parsed.apiKey;
          }
          if (parsed.providerModels?.[aiProvider]) {
            aiModel = parsed.providerModels[aiProvider];
          } else if (parsed.model) {
            aiModel = parsed.model;
          }
          if (parsed.baseUrl) aiBaseUrl = parsed.baseUrl;
        }
      } catch {}

      // Build live telemetry context snapshot
      const liveSummary = getLiveTelemetrySummary ? getLiveTelemetrySummary() : '';
      const ctxPayload = {
        context_mode: 'live',
        live_summary: liveSummary,
        custom_persona_prompt: persona === RADIO_PERSONAS.CUSTOM ? customPrompt : undefined,
        ...(telemetryContext || {}),
      };

      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            persona,
            language: effectiveLanguage,
            provider: aiProvider,
            api_key: aiApiKey,
            model: aiModel,
            base_url: aiBaseUrl,
            messages: [{ role: 'user', content: transcript }],
            context: ctxPayload,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          let errDetail = `AI Service returned ${response.status}`;
          try {
            const errJson = await response.json();
            if (errJson.error) errDetail = errJson.error;
          } catch {}

          // If missing API key, provide helpful radio response
          if (response.status === 401 || errDetail.toLowerCase().includes('api key')) {
            const keyMsg = effectiveLanguage === 'es'
              ? 'Atento, necesitas configurar tu API Key en los ajustes del Ingeniero IA para recibir telemetría por radio.'
              : 'Copy that. Please configure your API Key in AI Engineer settings to enable radio debriefs.';
            setError('API Key not configured in AI Engineer settings');
            await speakMessage(keyMsg);
            return;
          }

          throw new Error(errDetail);
        }

        let fullText = '';
        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let done = false;

          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const parsed = JSON.parse(line.substring(6));
                    if (parsed.text) fullText += parsed.text;
                    else if (parsed.content) fullText += parsed.content;
                    else if (parsed.error) {
                      throw new Error(parsed.error);
                    }
                  } catch (e: any) {
                    if (e.message && !e.message.includes('JSON')) {
                      throw e;
                    }
                  }
                }
              }
            }
          }
        } else {
          const json = await response.json();
          fullText = json.content || json.text || '';
        }

        const cleanedResponse = fullText.trim();
        if (cleanedResponse) {
          await speakMessage(cleanedResponse);
        } else {
          setRadioState('idle');
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('[Live Radio] AI Error:', err);
          setError(err.message || 'Error processing radio message');
          setRadioState('idle');
        }
      } finally {
        activeAbortControllerRef.current = null;
      }
    },
    [persona, effectiveLanguage, customPrompt, telemetryContext, getLiveTelemetrySummary, speakMessage]
  );

  // Push-to-Talk handlers
  const handlePTTDown = useCallback(async () => {
    if (!isRadioEnabled) return;

    stopRadio();
    setRadioState('transmitting');
    currentTranscriptRef.current = '';

    if (beepsEnabled) {
      playRadioBeep('start', volume);
    }

    if (isSpeechRecognitionSupported()) {
      const SpeechRecClass = getSpeechRecognitionClass();
      if (SpeechRecClass) {
        const recognition = new SpeechRecClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = getRecognitionLang();

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullTranscript += event.results[i][0]?.transcript || '';
          }
          currentTranscriptRef.current = fullTranscript;
          if (fullTranscript) {
            setLastTranscript(fullTranscript);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('[Live Radio] SpeechRecognition error:', e);
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // Ignore start error if already active
        }
      }
    }
  }, [isRadioEnabled, beepsEnabled, volume, getRecognitionLang, stopRadio]);

  const handlePTTUp = useCallback(async () => {
    if (!isRadioEnabled) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (beepsEnabled) {
      playRadioBeep('end', volume);
    }

    // Give a short 200ms grace period for recognition engine to flush final results
    setTimeout(() => {
      const finalTranscript = currentTranscriptRef.current.trim();
      setLastTranscript(finalTranscript || null);
      if (finalTranscript) {
        onTranscriptReceived?.(finalTranscript);
        processTranscript(finalTranscript);
      } else {
        setRadioState('idle');
      }
    }, 200);
  }, [isRadioEnabled, beepsEnabled, volume, onTranscriptReceived, processTranscript]);

  const gamepadPTT = useGamepadPTT({
    onPTTDown: handlePTTDown,
    onPTTUp: handlePTTUp,
    enabled: isRadioEnabled,
  });

  const testRadioTransmission = useCallback(async () => {
    let sampleMessage = '';
    if (effectiveLanguage === 'es') {
      if (persona === RADIO_PERSONAS.BONO) {
        sampleMessage = 'Radio check, entendido fuerte y claro. Modo carrera activado, mantené el ritmo.';
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
    radioState,
    isRadioEnabled,
    setIsRadioEnabled,
    persona,
    setPersona,
    radioLanguage,
    setRadioLanguage,
    effectiveLanguage,
    customPrompt,
    setCustomPrompt,
    beepsEnabled,
    setBeepsEnabled,
    filterEnabled,
    setFilterEnabled,
    volume,
    setVolume,
    neuralVoice,
    setNeuralVoice,
    lastTranscript,
    lastResponse,
    error,
    // PTT props
    isPTTActive: gamepadPTT.isPTTActive,
    isLearning: gamepadPTT.isLearning,
    startLearning: gamepadPTT.startLearning,
    cancelLearning: gamepadPTT.cancelLearning,
    mappedGamepadButton: gamepadPTT.mappedGamepadButton,
    setMappedGamepadButton: gamepadPTT.setMappedGamepadButton,
    mappedKey: gamepadPTT.mappedKey,
    setMappedKey: gamepadPTT.setMappedKey,
    gamepadConnected: gamepadPTT.gamepadConnected,
    gamepadName: gamepadPTT.gamepadName,
    // Actions
    testRadioTransmission,
    stopRadio,
    speakMessage,
  };
}
