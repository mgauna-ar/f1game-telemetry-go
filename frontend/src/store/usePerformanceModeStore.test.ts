import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('usePerformanceModeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  const loadStore = async () => (await import('./usePerformanceModeStore')).usePerformanceModeStore;

  it('is on in the Driver view and off elsewhere by default', async () => {
    const store = await loadStore();
    expect(store.getState().enabled).toEqual({ driver: true, general: false });
  });

  it('reads and saves each choice under its own key', async () => {
    localStorage.setItem('f1_performance_mode_driver', 'false');
    const store = await loadStore();
    expect(store.getState().enabled).toEqual({ driver: false, general: false });

    store.getState().setEnabled('general', true);
    expect(store.getState().enabled).toEqual({ driver: false, general: true });
    expect(localStorage.getItem('f1_performance_mode')).toBe('true');
    expect(localStorage.getItem('f1_performance_mode_driver')).toBe('false');
  });
});
