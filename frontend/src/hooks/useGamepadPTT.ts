import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RADIO_STORAGE_KEYS,
  RADIO_ALERT_CONSTANTS,
  RADIO_PTT_MODES,
  type RadioPTTMode,
} from '../constants/f1';
import { subscribeEngineerWebSocket } from '../utils/engineerSocket';

export interface GamepadMapping {
  gamepadIndex: number;
  buttonIndex: number;
}

export interface GlobalPTTMapping {
  device_type: 'joystick' | 'keyboard' | 'none';
  device_index?: number;
  button_index?: number;
  key_code?: number;
  key_name?: string;
  device_name?: string;
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
  pttMode: RadioPTTMode;
  setPTTMode: (mode: RadioPTTMode) => void;
  globalActive: boolean;
  globalMapping: GlobalPTTMapping | null;
}

export function getVKCodeForName(keyName: string): number {
  if (!keyName || keyName === 'None') return 0;
  switch (keyName) {
    case 'Space':
    case ' ':
    case 'Spacebar':
      return 0x20;
    case 'CapsLock':
      return 0x14;
    case 'KeyT':
    case 'T':
      return 0x54;
    case 'KeyR':
    case 'R':
      return 0x52;
    case 'KeyV':
    case 'V':
      return 0x56;
    case 'KeyB':
    case 'B':
      return 0x42;
    case 'KeyC':
    case 'C':
      return 0x43;
    case 'F1':
      return 0x70;
    case 'F2':
      return 0x71;
    case 'F3':
      return 0x72;
    case 'F4':
      return 0x73;
    case 'F5':
      return 0x74;
    case 'F6':
      return 0x75;
    case 'F7':
      return 0x76;
    case 'F8':
      return 0x77;
    case 'F9':
      return 0x78;
    case 'F10':
      return 0x79;
    case 'F11':
      return 0x7A;
    case 'F12':
      return 0x7B;
    default:
      if (keyName.length === 1) {
        const code = keyName.toUpperCase().charCodeAt(0);
        if (code >= 0x41 && code <= 0x5A) return code;
      }
      return 0;
  }
}

export function useGamepadPTT(options: UseGamepadPTTOptions = {}): UseGamepadPTTReturn {
  const { onPTTDown, onPTTUp, enabled = true } = options;

  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [globalActive, setGlobalActive] = useState<boolean>(false);
  const [globalMapping, setGlobalMapping] = useState<GlobalPTTMapping | null>(null);

  // Load PTT Mode (hold vs toggle)
  const [pttMode, setPTTModeState] = useState<RadioPTTMode>(() => {
    if (typeof window === 'undefined') return RADIO_PTT_MODES.HOLD;
    try {
      const saved = localStorage.getItem(RADIO_STORAGE_KEYS.PTT_MODE) as RadioPTTMode;
      if (saved && Object.values(RADIO_PTT_MODES).includes(saved)) return saved;
      return RADIO_PTT_MODES.HOLD;
    } catch {
      return RADIO_PTT_MODES.HOLD;
    }
  });

  const setPTTMode = useCallback((mode: RadioPTTMode) => {
    setPTTModeState(mode);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.PTT_MODE, mode);
    } catch {}
  }, []);

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
        fetch('/api/ai/ptt/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mapping: {
              device_type: 'joystick',
              device_index: mapping.gamepadIndex,
              button_index: mapping.buttonIndex,
              key_name: `Button ${mapping.buttonIndex + 1}`,
              device_name: 'Controller / Wheel',
            },
          }),
        }).catch(() => {});
      } else {
        localStorage.removeItem(RADIO_STORAGE_KEYS.GAMEPAD_MAPPING);
        fetch('/api/ai/ptt/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mapping: {
              device_type: 'none',
            },
          }),
        }).catch(() => {});
      }
    } catch {}
  }, []);

  const setMappedKey = useCallback((key: string) => {
    setMappedKeyState(key);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.KEYBOARD_KEY, key);
      const isNone = !key || key === 'None';
      fetch('/api/ai/ptt/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapping: {
            device_type: isNone ? 'none' : 'keyboard',
            key_code: getVKCodeForName(key),
            key_name: key,
            device_name: 'Keyboard',
          },
        }),
      }).catch(() => {});
    } catch {}
  }, []);

  // Sync initial global config to/from backend:
  // Reads current backend mapping; if backend is empty (e.g. server restart) but client has saved mapping, re-hydrates backend.
  useEffect(() => {
    fetch('/api/ai/ptt/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || data.status !== 'ok') return;
        setGlobalActive(!!data.is_active);

        if (data.mapping && data.mapping.device_type !== 'none') {
          // Backend already has an active mapping
          setGlobalMapping(data.mapping);
          return;
        }

        // Server has no active mapping (fresh start / restart). Re-hydrate from localStorage if available.
        const savedJoy = localStorage.getItem(RADIO_STORAGE_KEYS.GAMEPAD_MAPPING);
        if (savedJoy) {
          try {
            const parsedJoy: GamepadMapping = JSON.parse(savedJoy);
            if (parsedJoy && parsedJoy.buttonIndex >= 0) {
              fetch('/api/ai/ptt/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  mapping: {
                    device_type: 'joystick',
                    device_index: parsedJoy.gamepadIndex,
                    button_index: parsedJoy.buttonIndex,
                    key_name: `Button ${parsedJoy.buttonIndex + 1}`,
                    device_name: 'Controller / Wheel',
                  },
                }),
              })
                .then((res) => (res.ok ? res.json() : null))
                .then((resData) => {
                  if (resData?.mapping) setGlobalMapping(resData.mapping);
                })
                .catch(() => {});
              return;
            }
          } catch {}
        }

        const savedKey = localStorage.getItem(RADIO_STORAGE_KEYS.KEYBOARD_KEY);
        if (savedKey && savedKey !== 'None') {
          fetch('/api/ai/ptt/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mapping: {
                device_type: 'keyboard',
                key_code: getVKCodeForName(savedKey),
                key_name: savedKey,
                device_name: 'Keyboard',
              },
            }),
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((resData) => {
              if (resData?.mapping) setGlobalMapping(resData.mapping);
            })
            .catch(() => {});
        } else if (data.mapping) {
          setGlobalMapping(data.mapping);
        }
      })
      .catch(() => {});
  }, []);

  // Use refs for stable access in animation frame / event listeners
  const onPTTDownRef = useRef(onPTTDown);
  onPTTDownRef.current = onPTTDown;

  const onPTTUpRef = useRef(onPTTUp);
  onPTTUpRef.current = onPTTUp;

  const isPTTActiveRef = useRef(isPTTActive);
  isPTTActiveRef.current = isPTTActive;

  const pttModeRef = useRef(pttMode);
  pttModeRef.current = pttMode;

  const mappedGamepadRef = useRef(mappedGamepadButton);
  mappedGamepadRef.current = mappedGamepadButton;

  const isLearningRef = useRef(isLearning);
  isLearningRef.current = isLearning;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const keyboardPressedRef = useRef(false);
  const gamepadPressedRef = useRef(false);

  const updatePTTState = useCallback((nextState: boolean) => {
    if (isPTTActiveRef.current === nextState) return;
    setIsPTTActive(nextState);
    if (nextState) {
      onPTTDownRef.current?.();
    } else {
      onPTTUpRef.current?.();
    }
  }, []);

  const handleGlobalPTTEvent = useCallback((state: 'down' | 'up') => {
    if (!enabledRef.current) return;

    // If the browser currently has active DOM keyboard/gamepad focus, ignore background WebSocket events to prevent jitter/race conditions
    if (keyboardPressedRef.current || gamepadPressedRef.current) {
      return;
    }

    if (pttModeRef.current === RADIO_PTT_MODES.HOLD) {
      updatePTTState(state === 'down');
    } else if (pttModeRef.current === RADIO_PTT_MODES.TOGGLE) {
      if (state === 'down') {
        updatePTTState(!isPTTActiveRef.current);
      }
    }
  }, [updatePTTState]);

  const startLearning = useCallback(() => {
    setIsLearning(true);
    // Notify backend to start native OS scanning
    fetch('/api/ai/ptt/learn', { method: 'POST' }).catch(() => {});
  }, []);

  const cancelLearning = useCallback(() => {
    setIsLearning(false);
    // Notify backend to cancel native OS scanning
    fetch('/api/ai/ptt/learn/cancel', { method: 'POST' }).catch(() => {});
  }, []);

  const handleGlobalPTTEventRef = useRef(handleGlobalPTTEvent);
  handleGlobalPTTEventRef.current = handleGlobalPTTEvent;

  const setMappedGamepadButtonRef = useRef(setMappedGamepadButton);
  setMappedGamepadButtonRef.current = setMappedGamepadButton;

  const setMappedKeyRef = useRef(setMappedKey);
  setMappedKeyRef.current = setMappedKey;

  // Listen to /ws/engineer WebSocket for backend global PTT events via singleton connection
  useEffect(() => {
    if (!enabled) return;

    return subscribeEngineerWebSocket((data) => {
      if (data.type === 'ptt_event' && (data.state === 'down' || data.state === 'up')) {
        handleGlobalPTTEventRef.current?.(data.state);
      } else if (data.type === 'ptt_learned' && data.mapping) {
        setGlobalMapping(data.mapping);
        setIsLearning(false);

        if (data.mapping.device_type === 'joystick' && data.mapping.button_index !== undefined) {
          setMappedGamepadButtonRef.current?.({
            gamepadIndex: data.mapping.device_index ?? 0,
            buttonIndex: data.mapping.button_index,
          });
        } else if (data.mapping.device_type === 'keyboard' && data.mapping.key_name) {
          setMappedKeyRef.current?.(data.mapping.key_name);
        }
      }
    });
  }, [enabled]);

  // Keyboard Event Handlers (Browser Fallback)
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (isLearningRef.current) {
        e.preventDefault();
        setMappedKey(e.code === 'Space' ? 'Space' : e.key.toUpperCase());
        cancelLearning();
        return;
      }

      if (!mappedKey || mappedKey === 'None') return;

      const isKeyMatch =
        (mappedKey === 'Space' && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar')) ||
        (mappedKey !== 'Space' && (e.code === mappedKey || e.key.toLowerCase() === mappedKey.toLowerCase()));

      if (isKeyMatch) {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
        }
        if (!keyboardPressedRef.current) {
          keyboardPressedRef.current = true;
          if (pttModeRef.current === RADIO_PTT_MODES.HOLD) {
            updatePTTState(true);
          } else if (pttModeRef.current === RADIO_PTT_MODES.TOGGLE) {
            updatePTTState(!isPTTActiveRef.current);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (!mappedKey || mappedKey === 'None') return;

      const isKeyMatch =
        (mappedKey === 'Space' && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar')) ||
        (mappedKey !== 'Space' && (e.code === mappedKey || e.key.toLowerCase() === mappedKey.toLowerCase()));

      if (isKeyMatch) {
        keyboardPressedRef.current = false;
        if (pttModeRef.current === RADIO_PTT_MODES.HOLD) {
          if (!gamepadPressedRef.current) {
            updatePTTState(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, mappedKey, updatePTTState, cancelLearning, setMappedKey]);

  // Gamepad Polling Loop via requestAnimationFrame (Browser Fallback)
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
              cancelLearning();
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
        if (pttModeRef.current === RADIO_PTT_MODES.HOLD) {
          if (isAnyGamepadButtonPressed) {
            updatePTTState(true);
          } else if (!keyboardPressedRef.current) {
            updatePTTState(false);
          }
        } else if (pttModeRef.current === RADIO_PTT_MODES.TOGGLE) {
          if (isAnyGamepadButtonPressed) {
            updatePTTState(!isPTTActiveRef.current);
          }
        }
      }

      animationFrameId = requestAnimationFrame(pollGamepads);
    };

    animationFrameId = requestAnimationFrame(pollGamepads);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [enabled, setMappedGamepadButton, updatePTTState, cancelLearning]);

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
