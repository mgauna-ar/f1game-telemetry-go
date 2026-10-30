import { useRadioAudio, type UseRadioAudioOptions, type UseRadioAudioReturn, type RadioState } from './useRadioAudio';
import {
  useGamepadPTT,
  type UseGamepadPTTReturn,
  type GamepadMapping,
  type GlobalPTTMapping,
} from './useGamepadPTT';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { useRadioHere } from './useRadioHere';
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
  /** Whether the radio speaks and listens here: the switch is on and this page may have it. */
  isRadioEnabled: boolean;
  /** Whether this page may have the radio: not where the app's own window has it on this PC. */
  radioHere: boolean;
  setIsRadioEnabled: (enabled: boolean) => void;
  persona: RadioPersona;
  driverCallsign: string;
}

export function useRadioController(options: UseRadioControllerOptions = {}): UseRadioControllerReturn {
  const audio = useRadioAudio(options);
  const radioHere = useRadioHere();
  const isRadioEnabled = useRadioSettingsStore((s) => s.isRadioEnabled) && radioHere;
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
    radioHere,
    setIsRadioEnabled,
    persona,
    driverCallsign,
  };
}
