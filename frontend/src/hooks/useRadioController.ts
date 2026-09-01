import { useRadioAudio, type UseRadioAudioOptions, type UseRadioAudioReturn, type RadioState } from './useRadioAudio';
import { useRadioPTT, type UseRadioPTTReturn, type GamepadMapping, type GlobalPTTMapping } from './useRadioPTT';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import type { RadioPersona } from '../constants/f1';

export type { RadioState, GamepadMapping, GlobalPTTMapping, UseRadioAudioOptions, UseRadioAudioReturn, UseRadioPTTReturn };
export type UseRadioControllerOptions = UseRadioAudioOptions;

export interface UseRadioControllerReturn extends UseRadioAudioReturn, UseRadioPTTReturn {
  isRadioEnabled: boolean;
  setIsRadioEnabled: (enabled: boolean) => void;
  persona: RadioPersona;
  driverCallsign: string;
}

export function useRadioController(options: UseRadioControllerOptions = {}): UseRadioControllerReturn {
  const audio = useRadioAudio(options);
  const isRadioEnabled = useRadioSettingsStore((s) => s.isRadioEnabled);
  const setIsRadioEnabled = useRadioSettingsStore((s) => s.setIsRadioEnabled);
  const persona = useRadioSettingsStore((s) => s.persona);
  const driverCallsign = useRadioSettingsStore((s) => s.driverCallsign);

  const ptt = useRadioPTT({
    enabled: isRadioEnabled,
    onPTTDown: audio.onPTTPress,
    onPTTUp: audio.onPTTRelease,
  });

  return {
    ...audio,
    ...ptt,
    isRadioEnabled,
    setIsRadioEnabled,
    persona,
    driverCallsign,
  };
}
