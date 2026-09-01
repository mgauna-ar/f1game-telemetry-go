import { useGamepadPTT, type GamepadMapping, type GlobalPTTMapping, type UseGamepadPTTOptions, type UseGamepadPTTReturn } from './useGamepadPTT';

export type { GamepadMapping, GlobalPTTMapping };
export type UseRadioPTTOptions = UseGamepadPTTOptions;
export type UseRadioPTTReturn = UseGamepadPTTReturn;

export function useRadioPTT(options: UseRadioPTTOptions = {}): UseRadioPTTReturn {
  return useGamepadPTT(options);
}
