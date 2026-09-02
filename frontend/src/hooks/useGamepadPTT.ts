import { useState, useEffect, useRef, useCallback } from 'react';
import { RADIO_PTT_MODES, type RadioPTTMode } from '../constants/f1';
import { subscribeEngineerWebSocket } from '../utils/engineerSocket';
import {
  usePTTConfig,
  getVKCodeForName,
  type GamepadMapping,
  type GlobalPTTMapping,
} from './usePTTConfig';
import { useKeyboardPTT } from './useKeyboardPTT';
import { useGamepadPolling } from './useGamepadPolling';

export { getVKCodeForName };
export type { GamepadMapping, GlobalPTTMapping };

export interface UseGamepadPTTOptions {
  onPTTDown?: () => void;
  onPTTUp?: () => void;
  enabled?: boolean;
}

export interface UseGamepadPTTReturn {
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
}

export function useGamepadPTT(options: UseGamepadPTTOptions = {}): UseGamepadPTTReturn {
  const { onPTTDown, onPTTUp, enabled = true } = options;

  const [isPTTActive, setIsPTTActive] = useState(false);

  // 1. Config & persistence
  const {
    pttMode,
    setPTTMode,
    mappedGamepadButton,
    setMappedGamepadButton,
    mappedKey,
    setMappedKey,
    globalActive,
    globalMapping,
    setGlobalMapping,
    isLearning,
    setIsLearning,
    startLearning,
    cancelLearning,
  } = usePTTConfig();

  // Callbacks and state updates
  const onPTTDownRef = useRef(onPTTDown);
  onPTTDownRef.current = onPTTDown;

  const onPTTUpRef = useRef(onPTTUp);
  onPTTUpRef.current = onPTTUp;

  const isPTTActiveRef = useRef(isPTTActive);
  isPTTActiveRef.current = isPTTActive;

  const pttModeRef = useRef(pttMode);
  pttModeRef.current = pttMode;

  const updatePTTState = useCallback((nextState: boolean) => {
    if (isPTTActiveRef.current === nextState) return;
    setIsPTTActive(nextState);
    if (nextState) {
      onPTTDownRef.current?.();
    } else {
      onPTTUpRef.current?.();
    }
  }, []);

  // 2. Keyboard event handling
  const { keyboardPressedRef } = useKeyboardPTT({
    enabled,
    mappedKey,
    pttMode,
    isLearning,
    setMappedKey,
    cancelLearning,
    updatePTTState,
    isPTTActive,
    isGamepadPressed: () => gamepadPressedRef.current,
  });

  // 3. Gamepad polling loop
  const { gamepadConnected, gamepadName, gamepadPressedRef } = useGamepadPolling({
    enabled,
    mappedGamepadButton,
    pttMode,
    isLearning,
    setMappedGamepadButton,
    cancelLearning,
    updatePTTState,
    isPTTActive,
    isKeyboardPressed: () => keyboardPressedRef.current,
  });

  // 4. Backend global PTT events via WebSocket
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const handleGlobalPTTEvent = useCallback((state: 'down' | 'up') => {
    if (!enabledRef.current) return;
    if (keyboardPressedRef.current || gamepadPressedRef.current) return;

    if (pttModeRef.current === RADIO_PTT_MODES.HOLD) {
      updatePTTState(state === 'down');
    } else if (pttModeRef.current === RADIO_PTT_MODES.TOGGLE) {
      if (state === 'down') {
        updatePTTState(!isPTTActiveRef.current);
      }
    }
  }, [keyboardPressedRef, gamepadPressedRef, updatePTTState]);

  const handleGlobalPTTEventRef = useRef(handleGlobalPTTEvent);
  handleGlobalPTTEventRef.current = handleGlobalPTTEvent;

  const setMappedGamepadButtonRef = useRef(setMappedGamepadButton);
  setMappedGamepadButtonRef.current = setMappedGamepadButton;

  const setMappedKeyRef = useRef(setMappedKey);
  setMappedKeyRef.current = setMappedKey;

  useEffect(() => {
    if (!enabled) return;

    return subscribeEngineerWebSocket((data) => {
      if (data.type === 'ptt_event' && (data.state === 'down' || data.state === 'up')) {
        handleGlobalPTTEventRef.current?.(data.state);
      } else if (data.type === 'ptt_learned' && data.mapping) {
        setGlobalMapping(data.mapping);
        setIsLearning(false);

        if (data.mapping.device_type === 'joystick' && data.mapping.button_index !== undefined) {
          setMappedGamepadButtonRef.current({
            gamepadIndex: data.mapping.device_index ?? 0,
            buttonIndex: data.mapping.button_index,
          });
        } else if (data.mapping.device_type === 'keyboard' && data.mapping.key_name) {
          setMappedKeyRef.current(data.mapping.key_name);
        }
      }
    });
  }, [enabled, setGlobalMapping, setIsLearning]);

  return {
    isPTTActive,
    isLearning,
    startLearning,
    cancelLearning,
    mappedGamepadButton,
    setMappedGamepadButton,
    mappedKey,
    setMappedKey,
    gamepadConnected,
    gamepadName,
    pttMode,
    setPTTMode,
    globalActive,
    globalMapping,
  };
}
