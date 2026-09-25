import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LEGACY_RADIO_STORAGE_KEYS,
  RADIO_ALERT_CONSTANTS,
  RADIO_PTT_MODES,
  type RadioPTTMode,
} from '../constants/f1';
import { api } from '../utils/apiClient';
import { storage } from '../utils/storage';

export interface GamepadMapping {
  gamepadIndex: number;
  buttonIndex: number;
}

/** The push-to-talk setup shared by every device through GET/PUT /api/settings/ptt. */
export interface PTTSettingsPayload {
  mode: RadioPTTMode;
  keyboard_key: string;
  /** Windows virtual-key code, so the server can watch the key while the game has focus. */
  key_code?: number;
  gamepad?: { gamepad_index: number; button_index: number } | null;
}

interface PTTValues {
  mode: RadioPTTMode;
  gamepad: GamepadMapping | null;
  key: string;
}

const isPTTMode = (value: unknown): value is RadioPTTMode =>
  typeof value === 'string' && (Object.values(RADIO_PTT_MODES) as string[]).includes(value);

export function pttToPayload(v: PTTValues): PTTSettingsPayload {
  return {
    mode: v.mode,
    keyboard_key: v.key,
    key_code: getVKCodeForName(v.key),
    gamepad: v.gamepad ? { gamepad_index: v.gamepad.gamepadIndex, button_index: v.gamepad.buttonIndex } : null,
  };
}

export function pttFromPayload(p: Partial<PTTSettingsPayload>): PTTValues {
  return {
    mode: isPTTMode(p.mode) ? p.mode : RADIO_PTT_MODES.HOLD,
    gamepad: p.gamepad ? { gamepadIndex: p.gamepad.gamepad_index, buttonIndex: p.gamepad.button_index } : null,
    key: p.keyboard_key || RADIO_ALERT_CONSTANTS.DEFAULT_KEYBOARD_KEY,
  };
}

const LEGACY_PTT_KEYS = [
  LEGACY_RADIO_STORAGE_KEYS.PTT_MODE,
  LEGACY_RADIO_STORAGE_KEYS.GAMEPAD_MAPPING,
  LEGACY_RADIO_STORAGE_KEYS.KEYBOARD_KEY,
] as const;

/** The push-to-talk setup an older version kept in this browser, or null when it kept none. */
export function getLegacyPTTSettings(): PTTValues | null {
  // Older versions wrote the mode and key as raw strings; a string fallback reads those back as-is.
  const mode = storage.get<unknown>(LEGACY_RADIO_STORAGE_KEYS.PTT_MODE, '');
  const storedKey = storage.get<unknown>(LEGACY_RADIO_STORAGE_KEYS.KEYBOARD_KEY, '');
  const gamepad = storage.get<unknown>(LEGACY_RADIO_STORAGE_KEYS.GAMEPAD_MAPPING, null);
  if (mode === '' && storedKey === '' && gamepad === null) return null;
  // A digit key like "1" was stored raw and parses back as a number.
  const key = typeof storedKey === 'number' ? String(storedKey) : storedKey;
  const validGamepad =
    gamepad !== null &&
    typeof gamepad === 'object' &&
    Number.isInteger((gamepad as GamepadMapping).gamepadIndex) &&
    Number.isInteger((gamepad as GamepadMapping).buttonIndex) &&
    (gamepad as GamepadMapping).buttonIndex >= 0;
  return {
    mode: isPTTMode(mode) ? mode : RADIO_PTT_MODES.HOLD,
    gamepad: validGamepad ? (gamepad as GamepadMapping) : null,
    key: typeof key === 'string' && key ? key : RADIO_ALERT_CONSTANTS.DEFAULT_KEYBOARD_KEY,
  };
}

export function clearLegacyPTTSettings(): void {
  LEGACY_PTT_KEYS.forEach((key) => storage.remove(key));
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

/**
 * The push-to-talk setup. It is saved on the server, which also watches the key or wheel button
 * while the game has focus, so every device shares one setup and it works right after a restart.
 */
export function usePTTConfig(): UsePTTConfigReturn {
  const [isLearning, setIsLearning] = useState(false);
  const [globalActive, setGlobalActive] = useState(false);
  const [globalMapping, setGlobalMapping] = useState<GlobalPTTMapping | null>(null);
  const [pttMode, setPTTModeState] = useState<RadioPTTMode>(RADIO_PTT_MODES.HOLD);
  const [mappedGamepadButton, setMappedGamepadButtonState] = useState<GamepadMapping | null>(null);
  const [mappedKey, setMappedKeyState] = useState<string>(RADIO_ALERT_CONSTANTS.DEFAULT_KEYBOARD_KEY);

  // Each save sends the whole setup, so keep the latest values at hand for the setters.
  const valuesRef = useRef<PTTValues>({
    mode: RADIO_PTT_MODES.HOLD,
    gamepad: null,
    key: RADIO_ALERT_CONSTANTS.DEFAULT_KEYBOARD_KEY,
  });

  const applyValues = useCallback((values: PTTValues) => {
    valuesRef.current = values;
    setPTTModeState(values.mode);
    setMappedGamepadButtonState(values.gamepad);
    setMappedKeyState(values.key);
  }, []);

  const refreshGlobalStatus = useCallback(async () => {
    const data = await api
      .get<{ status?: string; is_active?: boolean; mapping?: GlobalPTTMapping }>('/api/ai/ptt/config')
      .catch(() => null);
    if (!data || (data.status !== 'ok' && data.status !== 'success')) return;
    setGlobalActive(!!data.is_active);
    if (data.mapping) setGlobalMapping(data.mapping);
  }, []);

  const saveValues = useCallback(
    (changes: Partial<PTTValues>) => {
      const next = { ...valuesRef.current, ...changes };
      applyValues(next);
      api
        .put('/api/settings/ptt', pttToPayload(next))
        .then(() => refreshGlobalStatus())
        .catch((err) => console.warn('[usePTTConfig] Sync failed:', err));
    },
    [applyValues, refreshGlobalStatus]
  );

  const setPTTMode = useCallback((mode: RadioPTTMode) => saveValues({ mode }), [saveValues]);

  const setMappedGamepadButton = useCallback(
    (mapping: GamepadMapping | null) => saveValues({ gamepad: mapping }),
    [saveValues]
  );

  const setMappedKey = useCallback((key: string) => saveValues({ key }), [saveValues]);

  const startLearning = useCallback(() => {
    setIsLearning(true);
    api.post('/api/ai/ptt/learn').catch((err) => console.warn('[usePTTConfig] Sync failed:', err));
  }, []);

  const cancelLearning = useCallback(() => {
    setIsLearning(false);
    api.post('/api/ai/ptt/learn/cancel').catch((err) => console.warn('[usePTTConfig] Sync failed:', err));
  }, []);

  // Load the saved setup, moving one an older version kept in this browser on first run
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await api
        .get<Partial<PTTSettingsPayload> & { saved?: boolean }>('/api/settings/ptt')
        .catch(() => null);
      if (cancelled || !res) return;

      if (res.saved) {
        applyValues(pttFromPayload(res));
        clearLegacyPTTSettings();
      } else {
        const legacy = getLegacyPTTSettings();
        if (legacy) {
          applyValues(legacy);
          try {
            await api.put('/api/settings/ptt', pttToPayload(legacy));
            clearLegacyPTTSettings();
          } catch (err) {
            console.warn('[usePTTConfig] Moving push-to-talk settings to the server failed:', err);
          }
        }
      }
      if (!cancelled) await refreshGlobalStatus();
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [applyValues, refreshGlobalStatus]);

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
