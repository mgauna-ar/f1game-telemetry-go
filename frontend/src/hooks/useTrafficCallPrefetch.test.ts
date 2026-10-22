import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SESSION_TYPES, TRAFFIC_PREFETCH } from '../constants/f1';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import type { SessionData } from '../types/telemetry';
import { createRadioPhrasePicker } from '../utils/radioPhrases';
import { CRITICAL_EMOTION } from './useProactiveTelemetryRadio';
import { trafficCallLines, useTrafficCallPrefetch } from './useTrafficCallPrefetch';

const inSession = (sessionType: number) =>
  useSessionStatusStore.setState({ session: { SessionType: sessionType } as SessionData });

/** A radio whose synthesis resolves only when the test lets it. */
function fakeRadio() {
  const pending: (() => void)[] = [];
  const prefetchMessage = vi.fn(() => new Promise<void>((resolve) => pending.push(resolve)));
  const finishOne = async () => {
    await act(async () => {
      pending.shift()?.();
      await Promise.resolve();
    });
  };
  return {
    radio: { isRadioEnabled: true, effectiveLanguage: 'en' as const, persona: 'bono' as const, prefetchMessage },
    prefetchMessage,
    finishOne,
  };
}

describe('useTrafficCallPrefetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRadioSettingsStore.setState({ qualyTrafficWarnSec: 8 });
  });
  afterEach(() => {
    vi.useRealTimers();
    useSessionStatusStore.setState({ session: null });
  });

  it('has every line a traffic call at the warning time may say', () => {
    const lines = trafficCallLines('en', 'bono', 8);
    const picker = createRadioPhrasePicker();
    for (let i = 0; i < 10; i++) {
      const said = picker.proactive('inlap_traffic_behind', {
        language: 'en',
        persona: 'bono',
        urgent: true,
        values: { behind: { gap_sec: 1.6, reach_sec: 8 } },
      });
      expect(lines).toContain(said);
      expect(lines).toContain(picker.proactive('qualy_traffic_ahead_now', { language: 'en', persona: 'bono' }));
    }
    expect(lines.filter((l) => l.includes('8'))).toHaveLength(8);
  });

  it('synthesizes them one at a time in qualifying, with the urgent voice', async () => {
    inSession(SESSION_TYPES.Q1);
    const { radio, prefetchMessage, finishOne } = fakeRadio();
    renderHook(() => useTrafficCallPrefetch(radio));

    const lines = trafficCallLines('en', 'bono', 8);
    expect(prefetchMessage).toHaveBeenCalledTimes(1);
    for (let i = 1; i < lines.length; i++) await finishOne();
    expect(prefetchMessage.mock.calls.map((c: unknown[]) => c[0])).toEqual(lines);
    expect(prefetchMessage).toHaveBeenCalledWith(lines[0], CRITICAL_EMOTION);

    await finishOne();
    act(() => vi.advanceTimersByTime(TRAFFIC_PREFETCH.REFRESH_MS));
    expect(prefetchMessage).toHaveBeenCalledTimes(lines.length + 1);
  });

  it('says the new warning time when the driver changes it', async () => {
    inSession(SESSION_TYPES.P2);
    const { radio, prefetchMessage } = fakeRadio();
    renderHook(() => useTrafficCallPrefetch(radio));
    act(() => useRadioSettingsStore.setState({ qualyTrafficWarnSec: 11 }));
    expect(prefetchMessage).toHaveBeenLastCalledWith(trafficCallLines('en', 'bono', 11)[0], CRITICAL_EMOTION);
  });

  it('does nothing in a race or with the radio off', () => {
    inSession(SESSION_TYPES.RACE);
    const { radio, prefetchMessage } = fakeRadio();
    renderHook(() => useTrafficCallPrefetch(radio)).unmount();
    inSession(SESSION_TYPES.Q2);
    renderHook(() => useTrafficCallPrefetch({ ...radio, isRadioEnabled: false }));
    expect(prefetchMessage).not.toHaveBeenCalled();
  });
});
