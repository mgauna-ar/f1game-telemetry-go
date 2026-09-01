import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRadioPTT } from './useRadioPTT';
import { RADIO_PTT_MODES } from '../constants/f1';

describe('useRadioPTT hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('initializes with default PTT state', () => {
    const { result } = renderHook(() => useRadioPTT());

    expect(result.current.isPTTActive).toBe(false);
    expect(result.current.isLearning).toBe(false);
    expect(result.current.pttMode).toBe(RADIO_PTT_MODES.HOLD);
  });

  it('manages PTT mode switching', () => {
    const { result } = renderHook(() => useRadioPTT());

    act(() => {
      result.current.setPTTMode(RADIO_PTT_MODES.TOGGLE);
    });

    expect(result.current.pttMode).toBe(RADIO_PTT_MODES.TOGGLE);
  });

  it('handles learning mode start and cancel', () => {
    const { result } = renderHook(() => useRadioPTT());

    act(() => {
      result.current.startLearning();
    });
    expect(result.current.isLearning).toBe(true);

    act(() => {
      result.current.cancelLearning();
    });
    expect(result.current.isLearning).toBe(false);
  });
});
