import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGamepadPTT } from './useGamepadPTT';
import { RADIO_STORAGE_KEYS } from '../constants/f1';

describe('useGamepadPTT hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with default keyboard key Space and null gamepad mapping', () => {
    const { result } = renderHook(() => useGamepadPTT());

    expect(result.current.isPTTActive).toBe(false);
    expect(result.current.isLearning).toBe(false);
    expect(result.current.mappedKey).toBe('Space');
    expect(result.current.mappedGamepadButton).toBeNull();
  });

  it('triggers PTT on Space keydown and releases on keyup', () => {
    const onPTTDown = vi.fn();
    const onPTTUp = vi.fn();

    const { result } = renderHook(() =>
      useGamepadPTT({ onPTTDown, onPTTUp })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
    });

    expect(result.current.isPTTActive).toBe(true);
    expect(onPTTDown).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
    });

    expect(result.current.isPTTActive).toBe(false);
    expect(onPTTUp).toHaveBeenCalledTimes(1);
  });

  it('ignores keyboard events when typing inside input elements', () => {
    const onPTTDown = vi.fn();
    const { result } = renderHook(() => useGamepadPTT({ onPTTDown }));

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, writable: false });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.isPTTActive).toBe(false);
    expect(onPTTDown).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('saves and updates mapped keyboard key in localStorage', () => {
    const { result } = renderHook(() => useGamepadPTT());

    act(() => {
      result.current.setMappedKey('KeyT');
    });

    expect(result.current.mappedKey).toBe('KeyT');
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.KEYBOARD_KEY)).toBe('KeyT');
  });

  it('handles learning mode activation and cancellation', () => {
    const { result } = renderHook(() => useGamepadPTT());

    act(() => {
      result.current.startLearning();
    });
    expect(result.current.isLearning).toBe(true);

    act(() => {
      result.current.cancelLearning();
    });
    expect(result.current.isLearning).toBe(false);
  });

  it('saves and updates mapped gamepad button in localStorage', () => {
    const { result } = renderHook(() => useGamepadPTT());

    act(() => {
      result.current.setMappedGamepadButton({ gamepadIndex: 0, buttonIndex: 4 });
    });

    expect(result.current.mappedGamepadButton).toEqual({ gamepadIndex: 0, buttonIndex: 4 });
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.GAMEPAD_MAPPING)).toBe(
      JSON.stringify({ gamepadIndex: 0, buttonIndex: 4 })
    );

    act(() => {
      result.current.setMappedGamepadButton(null);
    });

    expect(result.current.mappedGamepadButton).toBeNull();
    expect(localStorage.getItem(RADIO_STORAGE_KEYS.GAMEPAD_MAPPING)).toBeNull();
  });
});
