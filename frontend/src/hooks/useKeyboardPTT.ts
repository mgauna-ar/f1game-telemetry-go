import { useEffect, useRef } from 'react';
import { RADIO_PTT_MODES, type RadioPTTMode } from '../constants/f1';

export interface UseKeyboardPTTOptions {
  enabled?: boolean;
  mappedKey: string;
  pttMode: RadioPTTMode;
  isLearning: boolean;
  setMappedKey: (key: string) => void;
  cancelLearning: () => void;
  updatePTTState: (nextState: boolean) => void;
  isPTTActive: boolean;
  isGamepadPressed?: () => boolean;
}

export interface UseKeyboardPTTReturn {
  keyboardPressedRef: React.RefObject<boolean>;
}

export function useKeyboardPTT(options: UseKeyboardPTTOptions): UseKeyboardPTTReturn {
  const {
    enabled = true,
    mappedKey,
    pttMode,
    isLearning,
    setMappedKey,
    cancelLearning,
    updatePTTState,
    isPTTActive,
    isGamepadPressed,
  } = options;

  const keyboardPressedRef = useRef(false);

  const isLearningRef = useRef(isLearning);
  isLearningRef.current = isLearning;

  const pttModeRef = useRef(pttMode);
  pttModeRef.current = pttMode;

  const isPTTActiveRef = useRef(isPTTActive);
  isPTTActiveRef.current = isPTTActive;

  const updatePTTStateRef = useRef(updatePTTState);
  updatePTTStateRef.current = updatePTTState;

  const setMappedKeyRef = useRef(setMappedKey);
  setMappedKeyRef.current = setMappedKey;

  const cancelLearningRef = useRef(cancelLearning);
  cancelLearningRef.current = cancelLearning;

  const isGamepadPressedRef = useRef(isGamepadPressed);
  isGamepadPressedRef.current = isGamepadPressed;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (isLearningRef.current) {
        e.preventDefault();
        setMappedKeyRef.current(e.code === 'Space' ? 'Space' : e.key.toUpperCase());
        cancelLearningRef.current();
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
            updatePTTStateRef.current(true);
          } else if (pttModeRef.current === RADIO_PTT_MODES.TOGGLE) {
            updatePTTStateRef.current(!isPTTActiveRef.current);
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
          if (!isGamepadPressedRef.current?.()) {
            updatePTTStateRef.current(false);
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
  }, [enabled, mappedKey]);

  return { keyboardPressedRef };
}
