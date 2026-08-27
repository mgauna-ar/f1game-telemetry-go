import { useState, useRef, useCallback } from 'react';
import {
  RADIO_PERSONAS,
  RADIO_LANGUAGES,
  type RadioPersona,
  type RadioLanguage,
  type RadioTriggerPreset,
  type RadioPTTMode,
} from '../constants/f1';
import {
  playRadioBeep,
  speakRadioResponse,
  stopRadioSpeech,
  cleanRadioSpeechText,
  getSpeechRecognitionClass,
  type ISpeechRecognition,
} from '../utils/radioAudio';
import { useGamepadPTT, type GamepadMapping, type GlobalPTTMapping } from './useGamepadPTT';
import { useI18n } from '../context/I18nContext';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
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
  driverCallsign: string;
  setDriverCallsign: (callsign: string) => void;
  beepsEnabled: boolean;
  setBeepsEnabled: (enabled: boolean) => void;
  filterEnabled: boolean;
  setFilterEnabled: (enabled: boolean) => void;
  staticFxEnabled: boolean;
  setStaticFxEnabled: (enabled: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  speechPitch: number;
  setSpeechPitch: (pitch: number) => void;
  neuralVoice: string;
  setNeuralVoice: (v: string) => void;

  // Trigger & Discretion settings
  smartDiscretionEnabled: boolean;
  setSmartDiscretionEnabled: (enabled: boolean) => void;
  chatterCooldownSeconds: number;
  setChatterCooldownSeconds: (sec: number) => void;
  triggerPreset: RadioTriggerPreset;
  applyTriggerPreset: (preset: RadioTriggerPreset) => void;
  resetTriggerDefaults: () => void;

  // Subsystem master switches
  tyreAlertsEnabled: boolean;
  setTyreAlertsEnabled: (enabled: boolean) => void;
  thermalAlertsEnabled: boolean;
  setThermalAlertsEnabled: (enabled: boolean) => void;
  damageAlertsEnabled: boolean;
  setDamageAlertsEnabled: (enabled: boolean) => void;
  ersAlertsEnabled: boolean;
  setErsAlertsEnabled: (enabled: boolean) => void;
  brakesAlertsEnabled: boolean;
  setBrakesAlertsEnabled: (enabled: boolean) => void;
  fuelAlertsEnabled: boolean;
  setFuelAlertsEnabled: (enabled: boolean) => void;
  rivalAlertsEnabled: boolean;
  setRivalAlertsEnabled: (enabled: boolean) => void;
  pitWindowAlertsEnabled: boolean;
  setPitWindowAlertsEnabled: (enabled: boolean) => void;
  trackAlertsEnabled: boolean;
  setTrackAlertsEnabled: (enabled: boolean) => void;
  qualyAlertsEnabled: boolean;
  setQualyAlertsEnabled: (enabled: boolean) => void;
  flagsPensAlertsEnabled: boolean;
  setFlagsPensAlertsEnabled: (enabled: boolean) => void;

  // Sub-alert individual toggles
  subTyreWear: boolean;
  setSubTyreWear: (enabled: boolean) => void;
  subTyrePuncture: boolean;
  setSubTyrePuncture: (enabled: boolean) => void;
  subTyreThermal: boolean;
  setSubTyreThermal: (enabled: boolean) => void;
  subTyreCold: boolean;
  setSubTyreCold: (enabled: boolean) => void;
  subDamageWing: boolean;
  setSubDamageWing: (enabled: boolean) => void;
  subDamageFloor: boolean;
  setSubDamageFloor: (enabled: boolean) => void;
  subDamageEngine: boolean;
  setSubDamageEngine: (enabled: boolean) => void;
  subDamageFaults: boolean;
  setSubDamageFaults: (enabled: boolean) => void;
  subErsLow: boolean;
  setSubErsLow: (enabled: boolean) => void;
  subEngineTemp: boolean;
  setSubEngineTemp: (enabled: boolean) => void;
  subBrakeTemp: boolean;
  setSubBrakeTemp: (enabled: boolean) => void;
  subBrakeCold: boolean;
  setSubBrakeCold: (enabled: boolean) => void;
  subFuelDelta: boolean;
  setSubFuelDelta: (enabled: boolean) => void;
  subUndercut: boolean;
  setSubUndercut: (enabled: boolean) => void;
  subPitWindow: boolean;
  setSubPitWindow: (enabled: boolean) => void;
  subRivalDefend: boolean;
  setSubRivalDefend: (enabled: boolean) => void;
  subRivalAttack: boolean;
  setSubRivalAttack: (enabled: boolean) => void;
  subQualyTraffic: boolean;
  setSubQualyTraffic: (enabled: boolean) => void;
  subQualyInvalid: boolean;
  setSubQualyInvalid: (enabled: boolean) => void;
  subQualyTime: boolean;
  setSubQualyTime: (enabled: boolean) => void;
  subQualyElim: boolean;
  setSubQualyElim: (enabled: boolean) => void;
  subSafetyCar: boolean;
  setSubSafetyCar: (enabled: boolean) => void;
  subRedFlag: boolean;
  setSubRedFlag: (enabled: boolean) => void;
  subRain: boolean;
  setSubRain: (enabled: boolean) => void;
  subTrackLimits: boolean;
  setSubTrackLimits: (enabled: boolean) => void;
  subPenalties: boolean;
  setSubPenalties: (enabled: boolean) => void;

  // Granular thresholds
  tyreWearWarningPct: number;
  setTyreWearWarningPct: (pct: number) => void;
  tyreWearCriticalPct: number;
  setTyreWearCriticalPct: (pct: number) => void;
  tyreOverheatC: number;
  setTyreOverheatC: (temp: number) => void;
  tyreColdC: number;
  setTyreColdC: (temp: number) => void;
  wingDamageWarnPct: number;
  setWingDamageWarnPct: (pct: number) => void;
  floorDamageWarnPct: number;
  setFloorDamageWarnPct: (pct: number) => void;
  engineWearWarnPct: number;
  setEngineWearWarnPct: (pct: number) => void;
  ersLowPct: number;
  setErsLowPct: (pct: number) => void;
  engineOverheatC: number;
  setEngineOverheatC: (temp: number) => void;
  brakeOverheatC: number;
  setBrakeOverheatC: (temp: number) => void;
  brakeColdC: number;
  setBrakeColdC: (temp: number) => void;
  fuelDeltaLaps: number;
  setFuelDeltaLaps: (laps: number) => void;
  undercutGapSec: number;
  setUndercutGapSec: (sec: number) => void;
  rivalGapThresholdSec: number;
  setRivalGapThresholdSec: (sec: number) => void;
  rivalAheadGapSec: number;
  setRivalAheadGapSec: (sec: number) => void;
  qualyCleanAirSec: number;
  setQualyCleanAirSec: (sec: number) => void;
  cornerCutWarnThreshold: number;
  setCornerCutWarnThreshold: (count: number) => void;
  rainHorizonMin: number;
  setRainHorizonMin: (min: number) => void;
  rainProbPct: number;
  setRainProbPct: (pct: number) => void;

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
  pttMode: RadioPTTMode;
  setPTTMode: (mode: RadioPTTMode) => void;
  globalActive: boolean;
  globalMapping: GlobalPTTMapping | null;

  // Actions
  testRadioTransmission: () => Promise<void>;
  testTriggerAlert: (triggerType: string) => Promise<void>;
  stopRadio: () => void;
  speakMessage: (text: string, forceInterrupt?: boolean, emotion?: { rateModifier?: number; pitchModifier?: number }) => Promise<void>;
}

export function useRadioController(options: UseRadioControllerOptions = {}): UseRadioControllerReturn {
  const { telemetryContext, getLiveTelemetrySummary, onTranscriptReceived, onResponseReceived } = options;
  const { locale: uiLocale } = useI18n();

  const [radioState, setRadioState] = useState<RadioState>('idle');
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings from Zustand store
  const settings = useRadioSettingsStore();

  // Compute effective radio language based on setting and current UI locale
  const effectiveLanguage: 'es' | 'en' =
    settings.radioLanguage === RADIO_LANGUAGES.AUTO
      ? (uiLocale === 'es' ? 'es' : 'en')
      : (settings.radioLanguage === RADIO_LANGUAGES.ES ? 'es' : 'en');

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
      if (!settings.isRadioEnabled || !cleaned) return;

      if (forceInterrupt) {
        stopRadio();
      }

      setRadioState('speaking');
      setLastResponse(cleaned);
      if (onResponseReceived) {
        onResponseReceived(cleaned);
      }

      const effectiveRate = settings.speechRate + (emotion?.rateModifier || 0);
      const effectivePitch = settings.speechPitch + (emotion?.pitchModifier || 0);
      const rateStr = effectiveRate >= 0 ? `+${effectiveRate}%` : `${effectiveRate}%`;
      const pitchStr = effectivePitch >= 0 ? `+${effectivePitch}Hz` : `${effectivePitch}Hz`;

      await speakRadioResponse(cleaned, {
        volume: settings.volume,
        voice: settings.neuralVoice || undefined,
        persona: settings.persona,
        language: effectiveLanguage,
        rate: rateStr,
        pitch: pitchStr,
        enableBeeps: settings.beepsEnabled,
        enableCockpitFilter: settings.filterEnabled,
        enableStaticFx: settings.staticFxEnabled,
        onEnd: () => {
          setRadioState('idle');
        },
        onError: () => {
          setRadioState('idle');
        },
      });
    },
    [
      settings.isRadioEnabled,
      settings.speechRate,
      settings.speechPitch,
      settings.volume,
      settings.neuralVoice,
      settings.persona,
      settings.beepsEnabled,
      settings.filterEnabled,
      settings.staticFxEnabled,
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
      if (settings.persona === RADIO_PERSONAS.BONO) {
        sampleMessage = 'Radio check, te copio fuerte y claro. Modo carrera activado, gestioná la diferencia.';
      } else if (settings.persona === RADIO_PERSONAS.COLAPINTO) {
        sampleMessage = 'Radio check, te copio fuerte y claro. Venís con muy buen ritmo, dale que va.';
      } else {
        sampleMessage = 'Radio check, te copio en boxes. Todos los sistemas en verde.';
      }
    } else {
      if (settings.persona === RADIO_PERSONAS.BONO) {
        sampleMessage = 'Radio check, loud and clear. It is Hammer time, let us manage the delta.';
      } else if (settings.persona === RADIO_PERSONAS.COLAPINTO) {
        sampleMessage = 'Radio check mate, loud and clear! Looking really rapid out there, keep pushing!';
      } else {
        sampleMessage = 'Radio check, pit wall copy. All telemetry systems nominal.';
      }
    }
    await speakMessage(sampleMessage, true);
  }, [effectiveLanguage, settings.persona, speakMessage]);

  const getLiveTelemetrySummaryRef = useRef(getLiveTelemetrySummary);
  getLiveTelemetrySummaryRef.current = getLiveTelemetrySummary;

  const onTranscriptReceivedRef = useRef(onTranscriptReceived);
  onTranscriptReceivedRef.current = onTranscriptReceived;

  const onResponseReceivedRef = useRef(onResponseReceived);
  onResponseReceivedRef.current = onResponseReceived;

  const telemetryContextRef = useRef(telemetryContext);
  telemetryContextRef.current = telemetryContext;

  const personaRef = useRef(settings.persona);
  personaRef.current = settings.persona;

  const customPromptRef = useRef(settings.customPrompt);
  customPromptRef.current = settings.customPrompt;

  const driverCallsignRef = useRef(settings.driverCallsign);
  driverCallsignRef.current = settings.driverCallsign;

  const effectiveLanguageRef = useRef(effectiveLanguage);
  effectiveLanguageRef.current = effectiveLanguage;

  const speakMessageRef = useRef(speakMessage);
  speakMessageRef.current = speakMessage;

  const getRecognitionLangRef = useRef(getRecognitionLang);
  getRecognitionLangRef.current = getRecognitionLang;

  const isRadioEnabledRef = useRef(settings.isRadioEnabled);
  isRadioEnabledRef.current = settings.isRadioEnabled;

  const radioStateRef = useRef(radioState);
  radioStateRef.current = radioState;

  const beepsEnabledRef = useRef(settings.beepsEnabled);
  beepsEnabledRef.current = settings.beepsEnabled;

  // Handle Gamepad PTT
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

  const gamepadPTT = useGamepadPTT({
    enabled: settings.isRadioEnabled,
    onPTTDown: onPTTPress,
    onPTTUp: onPTTRelease,
  });

  return {
    radioState,
    isRadioEnabled: settings.isRadioEnabled,
    setIsRadioEnabled: settings.setIsRadioEnabled,
    persona: settings.persona,
    setPersona: settings.setPersona,
    radioLanguage: settings.radioLanguage,
    setRadioLanguage: settings.setRadioLanguage,
    effectiveLanguage,
    customPrompt: settings.customPrompt,
    setCustomPrompt: settings.setCustomPrompt,
    driverCallsign: settings.driverCallsign,
    setDriverCallsign: settings.setDriverCallsign,
    beepsEnabled: settings.beepsEnabled,
    setBeepsEnabled: settings.setBeepsEnabled,
    filterEnabled: settings.filterEnabled,
    setFilterEnabled: settings.setFilterEnabled,
    staticFxEnabled: settings.staticFxEnabled,
    setStaticFxEnabled: settings.setStaticFxEnabled,
    volume: settings.volume,
    setVolume: settings.setVolume,
    speechRate: settings.speechRate,
    setSpeechRate: settings.setSpeechRate,
    speechPitch: settings.speechPitch,
    setSpeechPitch: settings.setSpeechPitch,
    neuralVoice: settings.neuralVoice,
    setNeuralVoice: settings.setNeuralVoice,
    smartDiscretionEnabled: settings.smartDiscretionEnabled,
    setSmartDiscretionEnabled: settings.setSmartDiscretionEnabled,
    chatterCooldownSeconds: settings.chatterCooldownSeconds,
    setChatterCooldownSeconds: settings.setChatterCooldownSeconds,
    triggerPreset: settings.triggerPreset,
    applyTriggerPreset: settings.applyTriggerPreset,
    resetTriggerDefaults: settings.resetTriggerDefaults,

    // Subsystems
    tyreAlertsEnabled: settings.tyreAlertsEnabled,
    setTyreAlertsEnabled: settings.setTyreAlertsEnabled,
    thermalAlertsEnabled: settings.thermalAlertsEnabled,
    setThermalAlertsEnabled: settings.setThermalAlertsEnabled,
    damageAlertsEnabled: settings.damageAlertsEnabled,
    setDamageAlertsEnabled: settings.setDamageAlertsEnabled,
    ersAlertsEnabled: settings.ersAlertsEnabled,
    setErsAlertsEnabled: settings.setErsAlertsEnabled,
    brakesAlertsEnabled: settings.brakesAlertsEnabled,
    setBrakesAlertsEnabled: settings.setBrakesAlertsEnabled,
    fuelAlertsEnabled: settings.fuelAlertsEnabled,
    setFuelAlertsEnabled: settings.setFuelAlertsEnabled,
    rivalAlertsEnabled: settings.rivalAlertsEnabled,
    setRivalAlertsEnabled: settings.setRivalAlertsEnabled,
    pitWindowAlertsEnabled: settings.pitWindowAlertsEnabled,
    setPitWindowAlertsEnabled: settings.setPitWindowAlertsEnabled,
    trackAlertsEnabled: settings.trackAlertsEnabled,
    setTrackAlertsEnabled: settings.setTrackAlertsEnabled,
    qualyAlertsEnabled: settings.qualyAlertsEnabled,
    setQualyAlertsEnabled: settings.setQualyAlertsEnabled,
    flagsPensAlertsEnabled: settings.flagsPensAlertsEnabled,
    setFlagsPensAlertsEnabled: settings.setFlagsPensAlertsEnabled,

    // Sub-toggles
    subTyreWear: settings.subTyreWear,
    setSubTyreWear: settings.setSubTyreWear,
    subTyrePuncture: settings.subTyrePuncture,
    setSubTyrePuncture: settings.setSubTyrePuncture,
    subTyreThermal: settings.subTyreThermal,
    setSubTyreThermal: settings.setSubTyreThermal,
    subTyreCold: settings.subTyreCold,
    setSubTyreCold: settings.setSubTyreCold,
    subDamageWing: settings.subDamageWing,
    setSubDamageWing: settings.setSubDamageWing,
    subDamageFloor: settings.subDamageFloor,
    setSubDamageFloor: settings.setSubDamageFloor,
    subDamageEngine: settings.subDamageEngine,
    setSubDamageEngine: settings.setSubDamageEngine,
    subDamageFaults: settings.subDamageFaults,
    setSubDamageFaults: settings.setSubDamageFaults,
    subErsLow: settings.subErsLow,
    setSubErsLow: settings.setSubErsLow,
    subEngineTemp: settings.subEngineTemp,
    setSubEngineTemp: settings.setSubEngineTemp,
    subBrakeTemp: settings.subBrakeTemp,
    setSubBrakeTemp: settings.setSubBrakeTemp,
    subBrakeCold: settings.subBrakeCold,
    setSubBrakeCold: settings.setSubBrakeCold,
    subFuelDelta: settings.subFuelDelta,
    setSubFuelDelta: settings.setSubFuelDelta,
    subUndercut: settings.subUndercut,
    setSubUndercut: settings.setSubUndercut,
    subPitWindow: settings.subPitWindow,
    setSubPitWindow: settings.setSubPitWindow,
    subRivalDefend: settings.subRivalDefend,
    setSubRivalDefend: settings.setSubRivalDefend,
    subRivalAttack: settings.subRivalAttack,
    setSubRivalAttack: settings.setSubRivalAttack,
    subQualyTraffic: settings.subQualyTraffic,
    setSubQualyTraffic: settings.setSubQualyTraffic,
    subQualyInvalid: settings.subQualyInvalid,
    setSubQualyInvalid: settings.setSubQualyInvalid,
    subQualyTime: settings.subQualyTime,
    setSubQualyTime: settings.setSubQualyTime,
    subQualyElim: settings.subQualyElim,
    setSubQualyElim: settings.setSubQualyElim,
    subSafetyCar: settings.subSafetyCar,
    setSubSafetyCar: settings.setSubSafetyCar,
    subRedFlag: settings.subRedFlag,
    setSubRedFlag: settings.setSubRedFlag,
    subRain: settings.subRain,
    setSubRain: settings.setSubRain,
    subTrackLimits: settings.subTrackLimits,
    setSubTrackLimits: settings.setSubTrackLimits,
    subPenalties: settings.subPenalties,
    setSubPenalties: settings.setSubPenalties,

    // Granular thresholds
    tyreWearWarningPct: settings.tyreWearWarningPct,
    setTyreWearWarningPct: settings.setTyreWearWarningPct,
    tyreWearCriticalPct: settings.tyreWearCriticalPct,
    setTyreWearCriticalPct: settings.setTyreWearCriticalPct,
    tyreOverheatC: settings.tyreOverheatC,
    setTyreOverheatC: settings.setTyreOverheatC,
    tyreColdC: settings.tyreColdC,
    setTyreColdC: settings.setTyreColdC,
    wingDamageWarnPct: settings.wingDamageWarnPct,
    setWingDamageWarnPct: settings.setWingDamageWarnPct,
    floorDamageWarnPct: settings.floorDamageWarnPct,
    setFloorDamageWarnPct: settings.setFloorDamageWarnPct,
    engineWearWarnPct: settings.engineWearWarnPct,
    setEngineWearWarnPct: settings.setEngineWearWarnPct,
    ersLowPct: settings.ersLowPct,
    setErsLowPct: settings.setErsLowPct,
    engineOverheatC: settings.engineOverheatC,
    setEngineOverheatC: settings.setEngineOverheatC,
    brakeOverheatC: settings.brakeOverheatC,
    setBrakeOverheatC: settings.setBrakeOverheatC,
    brakeColdC: settings.brakeColdC,
    setBrakeColdC: settings.setBrakeColdC,
    fuelDeltaLaps: settings.fuelDeltaLaps,
    setFuelDeltaLaps: settings.setFuelDeltaLaps,
    undercutGapSec: settings.undercutGapSec,
    setUndercutGapSec: settings.setUndercutGapSec,
    rivalGapThresholdSec: settings.rivalGapThresholdSec,
    setRivalGapThresholdSec: settings.setRivalGapThresholdSec,
    rivalAheadGapSec: settings.rivalAheadGapSec,
    setRivalAheadGapSec: settings.setRivalAheadGapSec,
    qualyCleanAirSec: settings.qualyCleanAirSec,
    setQualyCleanAirSec: settings.setQualyCleanAirSec,
    cornerCutWarnThreshold: settings.cornerCutWarnThreshold,
    setCornerCutWarnThreshold: settings.setCornerCutWarnThreshold,
    rainHorizonMin: settings.rainHorizonMin,
    setRainHorizonMin: settings.setRainHorizonMin,
    rainProbPct: settings.rainProbPct,
    setRainProbPct: settings.setRainProbPct,

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
    pttMode: gamepadPTT.pttMode,
    setPTTMode: gamepadPTT.setPTTMode,
    globalActive: gamepadPTT.globalActive,
    globalMapping: gamepadPTT.globalMapping,

    // Actions
    testRadioTransmission,
    testTriggerAlert,
    stopRadio,
    speakMessage,
  };
}
