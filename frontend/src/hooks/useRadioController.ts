import { useRadioAudio, type UseRadioAudioOptions, type UseRadioAudioReturn, type RadioState } from './useRadioAudio';
import {
  useGamepadPTT,
  type UseGamepadPTTReturn,
  type GamepadMapping,
  type GlobalPTTMapping,
} from './useGamepadPTT';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import type { RadioPersona } from '../constants/f1';

export type {
  RadioState,
  GamepadMapping,
  GlobalPTTMapping,
  UseRadioAudioOptions,
  UseRadioAudioReturn,
  UseGamepadPTTReturn as UseRadioPTTReturn,
};
export type UseRadioControllerOptions = UseRadioAudioOptions;

export interface UseRadioControllerReturn extends UseRadioAudioReturn, UseGamepadPTTReturn {
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

  const ptt = useGamepadPTT({
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
