import { useState, useRef, useCallback } from 'react';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
} from '../constants/f1';
import {
  playRadioBeep,
  speakRadioResponse,
  stopRadioSpeech,
  cleanRadioSpeechText,
  getSpeechRecognitionClass,
  type ISpeechRecognition,
} from '../utils/radioAudio';
import { useI18n } from '../context/I18nContext';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';

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
  speakMessage: (text: string, forceInterrupt?: boolean, emotion?: { rateModifier?: number; pitchModifier?: number }) => Promise<void>;
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
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings from Zustand store with fine-grained selectors
  const isRadioEnabled = useRadioSettingsStore((s) => s.isRadioEnabled);
  const radioLanguage = useRadioSettingsStore((s) => s.radioLanguage);
  const persona = useRadioSettingsStore((s) => s.persona);
  const customPrompt = useRadioSettingsStore((s) => s.customPrompt);
  const driverCallsign = useRadioSettingsStore((s) => s.driverCallsign);
  const beepsEnabled = useRadioSettingsStore((s) => s.beepsEnabled);
  const filterEnabled = useRadioSettingsStore((s) => s.filterEnabled);
  const staticFxEnabled = useRadioSettingsStore((s) => s.staticFxEnabled);
  const volume = useRadioSettingsStore((s) => s.volume);
  const speechRate = useRadioSettingsStore((s) => s.speechRate);
  const speechPitch = useRadioSettingsStore((s) => s.speechPitch);
  const neuralVoice = useRadioSettingsStore((s) => s.neuralVoice);

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

  const speakMessage = useCallback(
    async (text: string, forceInterrupt = false, emotion?: { rateModifier?: number; pitchModifier?: number }) => {
      const cleaned = cleanRadioSpeechText(text);
      if (!isRadioEnabled || !cleaned) return;

      if (forceInterrupt) {
        stopRadio();
      }

      setRadioState('speaking');
      setLastResponse(cleaned);
      if (onResponseReceived) {
        onResponseReceived(cleaned);
      }

      const effectiveRate = speechRate + (emotion?.rateModifier || 0);
      const effectivePitch = speechPitch + (emotion?.pitchModifier || 0);
      const rateStr = effectiveRate >= 0 ? `+${effectiveRate}%` : `${effectiveRate}%`;
      const pitchStr = effectivePitch >= 0 ? `+${effectivePitch}Hz` : `${effectivePitch}Hz`;

      await speakRadioResponse(cleaned, {
        volume,
        voice: neuralVoice || undefined,
        persona,
        language: effectiveLanguage,
        rate: rateStr,
        pitch: pitchStr,
        enableBeeps: beepsEnabled,
        enableCockpitFilter: filterEnabled,
        enableStaticFx: staticFxEnabled,
        onEnd: () => {
          setRadioState('idle');
        },
        onError: () => {
          setRadioState('idle');
        },
      });
    },
    [
      isRadioEnabled,
      speechRate,
      speechPitch,
      volume,
      neuralVoice,
      persona,
      beepsEnabled,
      filterEnabled,
      staticFxEnabled,
      effectiveLanguage,
      stopRadio,
      onResponseReceived,
    ]
  );

  // Audio test for specific trigger types
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

  const getLiveTelemetrySummaryRef = useRef(getLiveTelemetrySummary);
  getLiveTelemetrySummaryRef.current = getLiveTelemetrySummary;

  const onTranscriptReceivedRef = useRef(onTranscriptReceived);
  onTranscriptReceivedRef.current = onTranscriptReceived;

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

  const speakMessageRef = useRef(speakMessage);
  speakMessageRef.current = speakMessage;

  const getRecognitionLangRef = useRef(getRecognitionLang);
  getRecognitionLangRef.current = getRecognitionLang;

  const isRadioEnabledRef = useRef(isRadioEnabled);
  isRadioEnabledRef.current = isRadioEnabled;

  const radioStateRef = useRef(radioState);
  radioStateRef.current = radioState;

  const beepsEnabledRef = useRef(beepsEnabled);
  beepsEnabledRef.current = beepsEnabled;

  // Handle Gamepad PTT press
  const onPTTPress = useCallback(() => {
    if (!isRadioEnabledRef.current || radioStateRef.current === 'transmitting') return;
    stopRadioSpeech();
    currentTranscriptRef.current = '';
    setError(null);
    setRadioState('transmitting');

    if (beepsEnabledRef.current) {
      playRadioBeep('start');
    }

    const SpeechRec = getSpeechRecognitionClass();
    if (!SpeechRec) {
      setError('Speech recognition not supported in browser');
      setRadioState('idle');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = getRecognitionLangRef.current();

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        currentTranscriptRef.current = transcript;
        setLastTranscript(transcript);
        if (onTranscriptReceivedRef.current) {
          onTranscriptReceivedRef.current(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('[Live Radio] Speech recognition error:', event.error);
          setError(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      console.warn('[Live Radio] Failed to start speech recognition:', err);
      setError(err?.message || 'Failed to start speech recognition');
      setRadioState('idle');
    }
  }, []);

  const onPTTRelease = useCallback(async () => {
    if (radioStateRef.current !== 'transmitting') return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (beepsEnabledRef.current) {
      playRadioBeep('end').catch(() => {});
    }

    if (!currentTranscriptRef.current.trim()) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    const finalTranscript = currentTranscriptRef.current.trim();
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

      try {
        const storedConfig = localStorage.getItem('f1_ai_engineer_config');
        if (storedConfig) {
          const parsed = JSON.parse(storedConfig);
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
      } catch {}

      const currentPersona = personaRef.current;
      const currentLanguage = effectiveLanguageRef.current;
      const currentCustomPrompt = customPromptRef.current;
      const currentDriverCallsign = driverCallsignRef.current;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`AI Service returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const chunkText =
                  parsed.text ??
                  parsed.content ??
                  parsed.delta?.content ??
                  parsed.candidates?.[0]?.content?.parts?.[0]?.text ??
                  '';
                fullReply += chunkText;
              } catch {
                fullReply += data;
              }
            }
          }
        }
      }

      if (fullReply.trim()) {
        if (onResponseReceivedRef.current) {
          onResponseReceivedRef.current(fullReply.trim());
        }
        await speakMessageRef.current(fullReply.trim());
      } else {
        setRadioState('idle');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[Live Radio] Error processing response:', err);
        setError(err?.message || 'Error processing radio response');
      }
      setRadioState('idle');
    } finally {
      activeAbortControllerRef.current = null;
    }
  }, []);

  return {
    radioState,
    lastTranscript,
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
