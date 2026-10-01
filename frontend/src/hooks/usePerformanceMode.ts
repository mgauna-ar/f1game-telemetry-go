import { useCallback, useEffect } from 'react';
import { LIVE_VIEW_MODES } from '../constants/f1';
import { useRoute } from '../router/router';
import { usePerformanceModeStore, type PerformanceContext } from '../store/usePerformanceModeStore';
import { PERFORMANCE_ATTRIBUTE } from '../utils/motion';

export interface PerformanceMode {
  /** Whether performance mode is on for the page on screen. */
  on: boolean;
  /** Which saved choice the page on screen uses. */
  context: PerformanceContext;
  toggle: () => void;
}

/**
 * Performance mode for the page on screen: the Driver view has its own choice (on by default),
 * every other page shares one (off by default).
 */
export function usePerformanceMode(): PerformanceMode {
  const route = useRoute();
  const context: PerformanceContext =
    route.page === 'live' && route.mode === LIVE_VIEW_MODES.DRIVER ? 'driver' : 'general';
  const on = usePerformanceModeStore((s) => s.enabled[context]);
  const setEnabled = usePerformanceModeStore((s) => s.setEnabled);
  const toggle = useCallback(() => setEnabled(context, !on), [setEnabled, context, on]);
  return { on, context, toggle };
}

/** Puts performance mode on <html> for the page on screen. Mounted once, in App. */
export function usePerformanceModeAttribute(): void {
  const { on } = usePerformanceMode();
  useEffect(() => {
    const root = document.documentElement;
    if (on) root.setAttribute(PERFORMANCE_ATTRIBUTE, 'on');
    else root.removeAttribute(PERFORMANCE_ATTRIBUTE);
  }, [on]);
  useEffect(() => () => document.documentElement.removeAttribute(PERFORMANCE_ATTRIBUTE), []);
}
