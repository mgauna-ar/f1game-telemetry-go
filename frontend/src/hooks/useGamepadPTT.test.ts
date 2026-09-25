import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGamepadPTT } from './useGamepadPTT';
import { LEGACY_RADIO_STORAGE_KEYS } from '../constants/f1';
import { api } from '../utils/apiClient';

describe('useGamepadPTT hook', () => {
  let putSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({ saved: false });
    vi.spyOn(api, 'post').mockResolvedValue({});
    putSpy = vi.spyOn(api, 'put').mockResolvedValue({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with default keyboard key None and null gamepad mapping', () => {
    const { result } = renderHook(() => useGamepadPTT());

    expect(result.current.isPTTActive).toBe(false);
    expect(result.current.isLearning).toBe(false);
    expect(result.current.mappedKey).toBe('None');
    expect(result.current.mappedGamepadButton).toBeNull();
  });

  it('does not trigger PTT on Space keydown when mappedKey is None', () => {
    const onPTTDown = vi.fn();
    const { result } = renderHook(() => useGamepadPTT({ onPTTDown }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
    });

    expect(result.current.isPTTActive).toBe(false);
    expect(onPTTDown).not.toHaveBeenCalled();
  });

  it('triggers PTT on mapped keydown (e.g. Space) and releases on keyup when explicitly configured', () => {
    const onPTTDown = vi.fn();
    const onPTTUp = vi.fn();

    const { result } = renderHook(() =>
      useGamepadPTT({ onPTTDown, onPTTUp })
    );

    act(() => {
      result.current.setMappedKey('Space');
    });

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

  it('saves the mapped keyboard key to the server with its Windows key code', () => {
    const { result } = renderHook(() => useGamepadPTT());

    act(() => {
      result.current.setMappedKey('KeyT');
    });

    expect(result.current.mappedKey).toBe('KeyT');
    expect(putSpy).toHaveBeenLastCalledWith('/api/settings/ptt', {
      mode: 'hold',
      keyboard_key: 'KeyT',
      key_code: 0x54,
      gamepad: null,
    });
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

  it('saves the mapped gamepad button to the server and clears it', () => {
    const { result } = renderHook(() => useGamepadPTT());

    act(() => {
      result.current.setMappedGamepadButton({ gamepadIndex: 0, buttonIndex: 4 });
    });

    expect(result.current.mappedGamepadButton).toEqual({ gamepadIndex: 0, buttonIndex: 4 });
    expect(putSpy).toHaveBeenLastCalledWith(
      '/api/settings/ptt',
      expect.objectContaining({ gamepad: { gamepad_index: 0, button_index: 4 } })
    );

    act(() => {
      result.current.setMappedGamepadButton(null);
    });

    expect(result.current.mappedGamepadButton).toBeNull();
    expect(putSpy).toHaveBeenLastCalledWith('/api/settings/ptt', expect.objectContaining({ gamepad: null }));
  });

  it('loads the saved push-to-talk setup from the server', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) =>
      url === '/api/settings/ptt'
        ? { saved: true, mode: 'toggle', keyboard_key: 'F12', key_code: 0x7b, gamepad: { gamepad_index: 1, button_index: 2 } }
        : { status: 'success', is_active: true, mapping: { device_type: 'joystick' } }
    );

    const { result } = renderHook(() => useGamepadPTT());

    await waitFor(() => expect(result.current.mappedKey).toBe('F12'));
    expect(result.current.pttMode).toBe('toggle');
    expect(result.current.mappedGamepadButton).toEqual({ gamepadIndex: 1, buttonIndex: 2 });
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('moves a setup an older version kept in this browser to the server once', async () => {
    localStorage.setItem(LEGACY_RADIO_STORAGE_KEYS.PTT_MODE, 'toggle');
    localStorage.setItem(LEGACY_RADIO_STORAGE_KEYS.KEYBOARD_KEY, 'Space');
    localStorage.setItem(
      LEGACY_RADIO_STORAGE_KEYS.GAMEPAD_MAPPING,
      JSON.stringify({ gamepadIndex: 0, buttonIndex: 3 })
    );

    const { result } = renderHook(() => useGamepadPTT());

    await waitFor(() => expect(localStorage.getItem(LEGACY_RADIO_STORAGE_KEYS.KEYBOARD_KEY)).toBeNull());
    expect(putSpy).toHaveBeenCalledWith('/api/settings/ptt', {
      mode: 'toggle',
      keyboard_key: 'Space',
      key_code: 0x20,
      gamepad: { gamepad_index: 0, button_index: 3 },
    });
    expect(result.current.pttMode).toBe('toggle');
    expect(localStorage.getItem(LEGACY_RADIO_STORAGE_KEYS.GAMEPAD_MAPPING)).toBeNull();
  });
});
