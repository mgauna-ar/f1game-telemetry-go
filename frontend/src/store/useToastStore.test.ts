import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToastStore } from './useToastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearToasts();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds and auto-dismisses toast after duration', () => {
    const store = useToastStore.getState();
    const id = store.showToast({ type: 'success', message: 'Test message', duration: 2000 });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('Test message');
    expect(useToastStore.getState().toasts[0].id).toBe(id);

    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1100);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('manually dismisses a toast', () => {
    const store = useToastStore.getState();
    const id = store.showToast({ type: 'error', message: 'Error toast' });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    store.dismissToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
