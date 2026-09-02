import { useState, useEffect, useCallback } from 'react';
import {
  RADIO_STORAGE_KEYS,
  RADIO_ALERT_CONSTANTS,
  RADIO_PTT_MODES,
  type RadioPTTMode,
} from '../constants/f1';
import { api } from '../utils/apiClient';

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

export interface UsePTTConfigReturn {
  pttMode: RadioPTTMode;
  setPTTMode: (mode: RadioPTTMode) => void;
  mappedGamepadButton: GamepadMapping | null;
  setMappedGamepadButton: (mapping: GamepadMapping | null) => void;
  mappedKey: string;
  setMappedKey: (key: string) => void;
  globalActive: boolean;
  setGlobalActive: React.Dispatch<React.SetStateAction<boolean>>;
  globalMapping: GlobalPTTMapping | null;
  setGlobalMapping: React.Dispatch<React.SetStateAction<GlobalPTTMapping | null>>;
  isLearning: boolean;
  setIsLearning: React.Dispatch<React.SetStateAction<boolean>>;
  startLearning: () => void;
  cancelLearning: () => void;
}

export function usePTTConfig(): UsePTTConfigReturn {
  const [isLearning, setIsLearning] = useState(false);
  const [globalActive, setGlobalActive] = useState(false);
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
        api.post('/api/ai/ptt/config', {
          mapping: {
            device_type: 'joystick',
            device_index: mapping.gamepadIndex,
            button_index: mapping.buttonIndex,
            key_name: `Button ${mapping.buttonIndex + 1}`,
            device_name: 'Controller / Wheel',
          },
        }).catch(() => {});
      } else {
        localStorage.removeItem(RADIO_STORAGE_KEYS.GAMEPAD_MAPPING);
        api.post('/api/ai/ptt/config', {
          mapping: {
            device_type: 'none',
          },
        }).catch(() => {});
      }
    } catch {}
  }, []);

  const setMappedKey = useCallback((key: string) => {
    setMappedKeyState(key);
    try {
      localStorage.setItem(RADIO_STORAGE_KEYS.KEYBOARD_KEY, key);
      const isNone = !key || key === 'None';
      api.post('/api/ai/ptt/config', {
        mapping: {
          device_type: isNone ? 'none' : 'keyboard',
          key_code: getVKCodeForName(key),
          key_name: key,
          device_name: 'Keyboard',
        },
      }).catch(() => {});
    } catch {}
  }, []);

  const startLearning = useCallback(() => {
    setIsLearning(true);
    api.post('/api/ai/ptt/learn').catch(() => {});
  }, []);

  const cancelLearning = useCallback(() => {
    setIsLearning(false);
    api.post('/api/ai/ptt/learn/cancel').catch(() => {});
  }, []);

  // Sync initial global config to/from backend
  useEffect(() => {
    api.get<{ status?: string; is_active?: boolean; mapping?: GlobalPTTMapping }>('/api/ai/ptt/config')
      .then((data) => {
        if (!data || data.status !== 'ok') return;
        setGlobalActive(!!data.is_active);

        if (data.mapping && data.mapping.device_type !== 'none') {
          setGlobalMapping(data.mapping);
          return;
        }

        const savedJoy = localStorage.getItem(RADIO_STORAGE_KEYS.GAMEPAD_MAPPING);
        if (savedJoy) {
          try {
            const parsedJoy: GamepadMapping = JSON.parse(savedJoy);
            if (parsedJoy && parsedJoy.buttonIndex >= 0) {
              api.post<{ status?: string; mapping?: GlobalPTTMapping }>('/api/ai/ptt/config', {
                mapping: {
                  device_type: 'joystick',
                  device_index: parsedJoy.gamepadIndex,
                  button_index: parsedJoy.buttonIndex,
                  key_name: `Button ${parsedJoy.buttonIndex + 1}`,
                  device_name: 'Controller / Wheel',
                },
              })
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
          api.post<{ status?: string; mapping?: GlobalPTTMapping }>('/api/ai/ptt/config', {
            mapping: {
              device_type: 'keyboard',
              key_code: getVKCodeForName(savedKey),
              key_name: savedKey,
              device_name: 'Keyboard',
            },
          })
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

  return {
    pttMode,
    setPTTMode,
    mappedGamepadButton,
    setMappedGamepadButton,
    mappedKey,
    setMappedKey,
    globalActive,
    setGlobalActive,
    globalMapping,
    setGlobalMapping,
    isLearning,
    setIsLearning,
    startLearning,
    cancelLearning,
  };
}
