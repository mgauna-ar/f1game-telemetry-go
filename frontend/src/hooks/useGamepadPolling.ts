import { useState, useEffect, useRef } from 'react';
import { RADIO_PTT_MODES, type RadioPTTMode } from '../constants/f1';
import type { GamepadMapping } from './usePTTConfig';

export interface UseGamepadPollingOptions {
  enabled?: boolean;
  mappedGamepadButton: GamepadMapping | null;
  pttMode: RadioPTTMode;
  isLearning: boolean;
  setMappedGamepadButton: (mapping: GamepadMapping | null) => void;
  cancelLearning: () => void;
  updatePTTState: (nextState: boolean) => void;
  isPTTActive: boolean;
  isKeyboardPressed?: () => boolean;
}

export interface UseGamepadPollingReturn {
  gamepadConnected: boolean;
  gamepadName: string | null;
  gamepadPressedRef: React.RefObject<boolean>;
}

export function useGamepadPolling(options: UseGamepadPollingOptions): UseGamepadPollingReturn {
  const {
    enabled = true,
    mappedGamepadButton,
    pttMode,
    isLearning,
    setMappedGamepadButton,
    cancelLearning,
    updatePTTState,
    isPTTActive,
    isKeyboardPressed,
  } = options;

  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);

  const gamepadPressedRef = useRef(false);
  const lastGamepadConnectedRef = useRef(false);
  const lastGamepadNameRef = useRef<string | null>(null);

  const isLearningRef = useRef(isLearning);
  isLearningRef.current = isLearning;

  const mappedGamepadRef = useRef(mappedGamepadButton);
  mappedGamepadRef.current = mappedGamepadButton;

  const pttModeRef = useRef(pttMode);
  pttModeRef.current = pttMode;

  const isPTTActiveRef = useRef(isPTTActive);
  isPTTActiveRef.current = isPTTActive;

  const updatePTTStateRef = useRef(updatePTTState);
  updatePTTStateRef.current = updatePTTState;

  const setMappedGamepadButtonRef = useRef(setMappedGamepadButton);
  setMappedGamepadButtonRef.current = setMappedGamepadButton;

  const cancelLearningRef = useRef(cancelLearning);
  cancelLearningRef.current = cancelLearning;

  const isKeyboardPressedRef = useRef(isKeyboardPressed);
  isKeyboardPressedRef.current = isKeyboardPressed;

  useEffect(() => {
    if (!enabled) return;

    let animationFrameId: number;

    const pollGamepads = () => {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) {
        return;
      }

      const gamepads = navigator.getGamepads();
      let hasConnected = false;
      let activeGamepadName: string | null = null;
      let isAnyGamepadButtonPressed = false;

      for (let gIdx = 0; gIdx < gamepads.length; gIdx++) {
        const gp = gamepads[gIdx];
        if (!gp) continue;

        hasConnected = true;
        activeGamepadName = gp.id;

        // Mode: Learn Button
        if (isLearningRef.current) {
          for (let bIdx = 0; bIdx < gp.buttons.length; bIdx++) {
            if (gp.buttons[bIdx].pressed) {
              setMappedGamepadButtonRef.current({ gamepadIndex: gIdx, buttonIndex: bIdx });
              cancelLearningRef.current();
              break;
            }
          }
        }

        // Mode: Normal PTT Detection
        if (
          mappedGamepadRef.current &&
          (mappedGamepadRef.current.gamepadIndex === gIdx || mappedGamepadRef.current.gamepadIndex === -1)
        ) {
          const btn = gp.buttons[mappedGamepadRef.current.buttonIndex];
          if (btn && btn.pressed) {
            isAnyGamepadButtonPressed = true;
          }
        }
      }

      if (lastGamepadConnectedRef.current !== hasConnected) {
        lastGamepadConnectedRef.current = hasConnected;
        setGamepadConnected(hasConnected);
      }
      if (lastGamepadNameRef.current !== activeGamepadName) {
        lastGamepadNameRef.current = activeGamepadName;
        setGamepadName(activeGamepadName);
      }

      if (isAnyGamepadButtonPressed !== gamepadPressedRef.current) {
        gamepadPressedRef.current = isAnyGamepadButtonPressed;
        if (pttModeRef.current === RADIO_PTT_MODES.HOLD) {
          if (isAnyGamepadButtonPressed) {
            updatePTTStateRef.current(true);
          } else if (!isKeyboardPressedRef.current?.()) {
            updatePTTStateRef.current(false);
          }
        } else if (pttModeRef.current === RADIO_PTT_MODES.TOGGLE) {
          if (isAnyGamepadButtonPressed) {
            updatePTTStateRef.current(!isPTTActiveRef.current);
          }
        }
      }

      animationFrameId = requestAnimationFrame(pollGamepads);
    };

    animationFrameId = requestAnimationFrame(pollGamepads);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [enabled]);

  return {
    gamepadConnected,
    gamepadName,
    gamepadPressedRef,
  };
}
