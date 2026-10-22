import { useEffect } from 'react';
import { TRAFFIC_PREFETCH, isPracticeSession, isQualifyingSession } from '../constants/f1';
import type { RadioAlertCategory } from '../types/telemetry';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { possibleProactiveLines } from '../utils/radioPhrases';
import { CRITICAL_EMOTION } from './useProactiveTelemetryRadio';
import type { ProactiveRadio } from './useProactiveRadioCalls';

/** The traffic calls synthesized ahead: the ones that say the warning time, and the ones that say it is right there. */
const PREFETCHED: readonly { category: RadioAlertCategory; side?: 'ahead' | 'behind' }[] = [
  { category: 'inlap_traffic_behind', side: 'behind' },
  { category: 'inlap_traffic_behind_now' },
  { category: 'qualy_traffic_ahead', side: 'ahead' },
  { category: 'qualy_traffic_ahead_now' },
];

/** Every line a qualifying traffic call may say when it comes at the driver's warning time. */
export function trafficCallLines(
  language: ProactiveRadio['effectiveLanguage'],
  persona: ProactiveRadio['persona'],
  warnSec: number
): string[] {
  const reach = Math.round(warnSec);
  return PREFETCHED.flatMap(({ category, side }) =>
    possibleProactiveLines(category, {
      language,
      persona,
      values: side ? { [side]: { gap_sec: 0, reach_sec: reach } } : undefined,
    })
  );
}

/**
 * Synthesizes the qualifying traffic calls' lines while a qualifying or practice session is live,
 * one at a time: the engine says the driver's warning time when it calls a car, so the call starts
 * from the cache instead of waiting a second for its voice. Again when the voice, persona, language
 * or warning time changes, and every TRAFFIC_PREFETCH.REFRESH_MS.
 */
export function useTrafficCallPrefetch(
  radio: Pick<ProactiveRadio, 'isRadioEnabled' | 'effectiveLanguage' | 'persona' | 'prefetchMessage'>
): void {
  const sessionType = useSessionStatusStore((s) => s.session?.SessionType);
  const warnSec = useRadioSettingsStore((s) => s.qualyTrafficWarnSec);
  const timed = isQualifyingSession(sessionType) || isPracticeSession(sessionType);
  const { isRadioEnabled, effectiveLanguage, persona, prefetchMessage } = radio;

  useEffect(() => {
    if (!isRadioEnabled || !timed) return;
    const lines = trafficCallLines(effectiveLanguage, persona, warnSec);
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
  }, [isRadioEnabled, timed, effectiveLanguage, persona, warnSec, prefetchMessage]);
}
