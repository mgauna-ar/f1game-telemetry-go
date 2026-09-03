import { useState, useCallback, useRef } from 'react';
import { RADIO_PERSONAS } from '../constants/f1';
import {
  speakRadioResponse,
  stopRadioSpeech,
  cleanRadioSpeechText,
} from '../utils/radioAudio';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';

export interface UseTTSPlaybackOptions {
  effectiveLanguage: 'es' | 'en';
  onResponseReceived?: (response: string) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

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
  const queueRef = useRef<Array<{
    id: string;
    text: string;
    emotion?: { rateModifier?: number; pitchModifier?: number };
  }>>([]);
  const MAX_QUEUE_SIZE = 3;

  const playNext = useCallback(async () => {
    if (!isRadioEnabled || queueRef.current.length === 0) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      onSpeakingChangeRef.current?.(false);
      return;
    }

    const item = queueRef.current.shift()!;
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    onSpeakingChangeRef.current?.(true);
    setLastResponse(item.text);
    onResponseReceivedRef.current?.(item.text);

    const effectiveRate = speechRate + (item.emotion?.rateModifier || 0);
    const effectivePitch = speechPitch + (item.emotion?.pitchModifier || 0);
    const rateStr = effectiveRate >= 0 ? `+${effectiveRate}%` : `${effectiveRate}%`;
    const pitchStr = effectivePitch >= 0 ? `+${effectivePitch}Hz` : `${effectivePitch}Hz`;

    try {
      await speakRadioResponse(item.text, {
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
          playNext();
        },
        onError: () => {
          playNext();
        },
      });
    } catch {
      playNext();
    }
  }, [
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
  ]);

  const stopSpeech = useCallback(() => {
    queueRef.current = [];
    isSpeakingRef.current = false;
    stopRadioSpeech();
    setIsSpeaking(false);
    onSpeakingChangeRef.current?.(false);
  }, []);

  const speakMessage = useCallback(
    async (
      text: string,
      forceInterrupt = false,
      emotion?: { rateModifier?: number; pitchModifier?: number }
    ) => {
      const cleaned = cleanRadioSpeechText(text);
      if (!isRadioEnabled || !cleaned) return;

      if (forceInterrupt) {
        // Critical emergency or forced interrupt: halt current audio and purge non-critical backlog
        queueRef.current = [];
        stopRadioSpeech();
        isSpeakingRef.current = false;
        queueRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          text: cleaned,
          emotion,
        });
        await playNext();
        return;
      }

      // Non-critical directive: if already speaking, queue it sequentially up to MAX_QUEUE_SIZE
      if (isSpeakingRef.current) {
        if (queueRef.current.length < MAX_QUEUE_SIZE) {
          queueRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            text: cleaned,
            emotion,
          });
        }
        return;
      }

      // Not currently speaking, play immediately
      queueRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        text: cleaned,
        emotion,
      });
      await playNext();
    },
    [isRadioEnabled, playNext]
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
  };
}
