import { afterEach, describe, expect, it, vi } from 'vitest';
import { PERFORMANCE_ATTRIBUTE, isPerformanceModeOn, shouldReduceMotion } from './motion';

describe('shouldReduceMotion', () => {
  afterEach(() => {
    document.documentElement.removeAttribute(PERFORMANCE_ATTRIBUTE);
    vi.unstubAllGlobals();
  });

  it('is false with neither the OS setting nor performance mode', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(isPerformanceModeOn()).toBe(false);
    expect(shouldReduceMotion()).toBe(false);
  });

  it('is true while performance mode is on', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    document.documentElement.setAttribute(PERFORMANCE_ATTRIBUTE, 'on');
    expect(isPerformanceModeOn()).toBe(true);
    expect(shouldReduceMotion()).toBe(true);
  });

  it('is true when the OS asks for less motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    expect(shouldReduceMotion()).toBe(true);
  });
});
