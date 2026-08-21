import { useState, useEffect, useRef, useCallback } from 'react';
import { RADIO_STORAGE_KEYS, RADIO_ALERT_CONSTANTS } from '../constants/f1';

export interface GamepadMapping {
  gamepadIndex: number;
  buttonIndex: number;
}

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
}

export function useGamepadPTT(options: UseGamepadPTTOptions = {}): UseGamepadPTTReturn {
  const { onPTTDown, onPTTUp, enabled = true } = options;

  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);

  // Load initial gamepad mapping
  const [mappedGamepadButton, setMappedGamepadButtonState] = useState<GamepadMapping | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.GAMEPAD_MAPPING);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Load initial keyboard key
  const [mappedKey, setMappedKeyState] = useState<string>(() => {
    if (typeof window === 'undefined') return RADIO_ALERT_CONSTANTS.DEFAULT_KEYBOARD_KEY;
    try {
      return localStorage.getItem(RADIO_STORAGE_KEYS.KEYBOARD_KEY) || RADIO_ALERT_CONSTANTS.DEFAULT_KEYBOARD_KEY;
    } catch {
      return RADIO_ALERT_CONSTANTS.DEFAULT_KEYBOARD_KEY;
    }
  });

  const setMappedGamepadButton = useCallback((mapping: GamepadMapping | null) => {
    setMappedGamepadButtonState(mapping);
    try {
      if (mapping) {
        localStorage.setItem(RADIO_STORAGE_KEYS.GAMEPAD_MAPPING, JSON.stringify(mapping));
      } else {
        localStorage.removeItem(RADIO_STORAGE_KEYS.GAMEPAD_MAPPING);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setMappedKey = useCallback((key: string) => {
    setMappedKeyState(key);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.KEYBOARD_KEY, key);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const startLearning = useCallback(() => {
    setIsLearning(true);
  }, []);

  const cancelLearning = useCallback(() => {
    setIsLearning(false);
  }, []);

  // Use refs for stable access in animation frame / event listeners
  const isPTTActiveRef = useRef(isPTTActive);
  isPTTActiveRef.current = isPTTActive;

  const mappedGamepadRef = useRef(mappedGamepadButton);
  mappedGamepadRef.current = mappedGamepadButton;

  const isLearningRef = useRef(isLearning);
  isLearningRef.current = isLearning;

  const onPTTDownRef = useRef(onPTTDown);
  onPTTDownRef.current = onPTTDown;

  const onPTTUpRef = useRef(onPTTUp);
  onPTTUpRef.current = onPTTUp;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const keyboardPressedRef = useRef(false);
  const gamepadPressedRef = useRef(false);

  // Trigger PTT state changes
  const updatePTTState = useCallback((newActive: boolean) => {
    if (newActive !== isPTTActiveRef.current) {
      setIsPTTActive(newActive);
      if (newActive) {
        onPTTDownRef.current?.();
      } else {
        onPTTUpRef.current?.();
      }
    }
  }, []);

  // Keyboard Event Handlers
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside input / textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isKeyMatch =
        (mappedKey === 'Space' && (e.code === 'Space' || e.key === ' ')) ||
        e.code === mappedKey ||
        e.key.toLowerCase() === mappedKey.toLowerCase();

      if (isKeyMatch && !keyboardPressedRef.current) {
        keyboardPressedRef.current = true;
        updatePTTState(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isKeyMatch =
        (mappedKey === 'Space' && (e.code === 'Space' || e.key === ' ')) ||
        e.code === mappedKey ||
        e.key.toLowerCase() === mappedKey.toLowerCase();

      if (isKeyMatch) {
        keyboardPressedRef.current = false;
        if (!gamepadPressedRef.current) {
          updatePTTState(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, mappedKey, updatePTTState]);

  // Gamepad Polling Loop via requestAnimationFrame
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
              setMappedGamepadButton({ gamepadIndex: gIdx, buttonIndex: bIdx });
              setIsLearning(false);
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

      setGamepadConnected(hasConnected);
      setGamepadName(activeGamepadName);

      if (isAnyGamepadButtonPressed !== gamepadPressedRef.current) {
        gamepadPressedRef.current = isAnyGamepadButtonPressed;
        if (isAnyGamepadButtonPressed) {
          updatePTTState(true);
        } else if (!keyboardPressedRef.current) {
          updatePTTState(false);
        }
      }

      animationFrameId = requestAnimationFrame(pollGamepads);
    };

    animationFrameId = requestAnimationFrame(pollGamepads);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [enabled, setMappedGamepadButton, updatePTTState]);

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
  };
}
