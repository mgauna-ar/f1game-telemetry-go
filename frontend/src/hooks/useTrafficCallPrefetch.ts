import { useEffect } from 'react';
import { TRAFFIC_PREFETCH, isPracticeSession, isQualifyingSession, isRaceSession } from '../constants/f1';
import type { RadioAlertCategory } from '../types/telemetry';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { possibleProactiveLines } from '../utils/radioPhrases';
import { CRITICAL_EMOTION } from './useProactiveTelemetryRadio';
import type { ProactiveRadio } from './useProactiveRadioCalls';

/** A call synthesized ahead, and the side of the driver its number is about (none: no number). */
type PrefetchedCall = { category: RadioAlertCategory; side?: 'ahead' | 'behind' };

/**
 * The traffic calls synthesized ahead in qualifying and practice: the ones that say the warning
 * time, and the ones with no number (right there, on you now, clear, the pit exit).
 */
const PREFETCHED: readonly PrefetchedCall[] = [
  { category: 'inlap_traffic_behind', side: 'behind' },
  { category: 'inlap_traffic_behind_two', side: 'behind' },
  { category: 'inlap_traffic_behind_now' },
  { category: 'inlap_traffic_close' },
  { category: 'inlap_traffic_clear' },
  { category: 'qualy_traffic_ahead', side: 'ahead' },
  { category: 'qualy_traffic_ahead_now' },
  { category: 'qualy_pit_exit_traffic' },
];

/**
 * The calls synthesized ahead in a race: the blue flag, with one car or two, and "clear" after it;
 * a slow or stopped car ahead at the warning time, and right there.
 */
const RACE_PREFETCHED: readonly PrefetchedCall[] = [
  { category: 'flags_blue' },
  { category: 'flags_blue_two' },
  { category: 'flags_blue_clear' },
  { category: 'race_slow_car_ahead', side: 'ahead' },
  { category: 'race_stopped_car_ahead', side: 'ahead' },
  { category: 'race_slow_car_ahead_now' },
];

/** Every line the calls may say when they come at the driver's warning time. */
function callLines(
  calls: readonly PrefetchedCall[],
  language: ProactiveRadio['effectiveLanguage'],
  persona: ProactiveRadio['persona'],
  warnSec: number
): string[] {
  const reach = Math.round(warnSec);
  return calls.flatMap(({ category, side }) =>
    possibleProactiveLines(category, {
      language,
      persona,
      values: side ? { [side]: { gap_sec: 0, reach_sec: reach } } : undefined,
    })
  );
}

/** Every line a qualifying traffic call may say when it comes at the driver's warning time. */
export function trafficCallLines(
  language: ProactiveRadio['effectiveLanguage'],
  persona: ProactiveRadio['persona'],
  warnSec: number
): string[] {
  return callLines(PREFETCHED, language, persona, warnSec);
}

/** Every line a race's traffic call may say when it comes at the driver's warning time. */
export function raceCallLines(
  language: ProactiveRadio['effectiveLanguage'],
  persona: ProactiveRadio['persona'],
  warnSec: number
): string[] {
  return callLines(RACE_PREFETCHED, language, persona, warnSec);
}

/** Which calls a session synthesizes ahead: the timed sessions' traffic calls, a race's, or none. */
function prefetchKind(sessionType?: number): 'timed' | 'race' | null {
  if (isQualifyingSession(sessionType) || isPracticeSession(sessionType)) return 'timed';
  return isRaceSession(sessionType) ? 'race' : null;
}

/**
 * Synthesizes the traffic calls' lines while a session is live, one at a time: the push-lap
 * traffic calls in qualifying and practice, the blue flag calls in a race. The engine says the
 * driver's warning time when it calls a car, so the call starts from the cache instead of waiting
 * a second for its voice. Again when the voice, persona, language or warning time changes, and
 * every TRAFFIC_PREFETCH.REFRESH_MS.
 */
export function useTrafficCallPrefetch(
  radio: Pick<ProactiveRadio, 'isRadioEnabled' | 'effectiveLanguage' | 'persona' | 'prefetchMessage'>
): void {
  const sessionType = useSessionStatusStore((s) => s.session?.SessionType);
  const warnSec = useRadioSettingsStore((s) => s.qualyTrafficWarnSec);
  const kind = prefetchKind(sessionType);
  const { isRadioEnabled, effectiveLanguage, persona, prefetchMessage } = radio;

  useEffect(() => {
    if (!isRadioEnabled || !kind) return;
    const lines = (kind === 'race' ? raceCallLines : trafficCallLines)(effectiveLanguage, persona, warnSec);
    let stopped = false;
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      for (const line of lines) {
        if (stopped) break;
        await prefetchMessage(line, CRITICAL_EMOTION);
      }
      running = false;
    };
    void run();
    const timer = setInterval(() => void run(), TRAFFIC_PREFETCH.REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [isRadioEnabled, kind, effectiveLanguage, persona, warnSec, prefetchMessage]);
}
