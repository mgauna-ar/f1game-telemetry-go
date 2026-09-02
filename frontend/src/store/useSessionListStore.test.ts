import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSessionListStore, SESSION_LIST_TTL_MS } from './useSessionListStore';
import { api } from '../utils/apiClient';
import type { Session } from '../types/session';

describe('useSessionListStore', () => {
  const mockSessions: Session[] = [
    { id: 1, track_name: 'Silverstone', session_type: 'Race' } as Session,
    { id: 2, track_name: 'Monza', session_type: 'Qualifying' } as Session,
  ];

  beforeEach(() => {
    useSessionListStore.getState().reset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches sessions and updates store state', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(mockSessions);

    await useSessionListStore.getState().fetchSessions();

    const state = useSessionListStore.getState();
    expect(state.sessions).toEqual(mockSessions);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it('skips network call if data is fresh within TTL', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(mockSessions);

    await useSessionListStore.getState().fetchSessions();
    expect(getSpy).toHaveBeenCalledTimes(1);

    // Call again immediately
    await useSessionListStore.getState().fetchSessions();
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('refetches when forced regardless of TTL', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(mockSessions);

    await useSessionListStore.getState().fetchSessions();
    expect(getSpy).toHaveBeenCalledTimes(1);

    await useSessionListStore.getState().fetchSessions({ force: true });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('refetches when invalidated', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(mockSessions);

    await useSessionListStore.getState().fetchSessions();
    expect(getSpy).toHaveBeenCalledTimes(1);

    useSessionListStore.getState().invalidate();
    await useSessionListStore.getState().fetchSessions();
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('refetches after TTL expires', async () => {
    vi.useFakeTimers();
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(mockSessions);

    await useSessionListStore.getState().fetchSessions();
    expect(getSpy).toHaveBeenCalledTimes(1);

    // Advance time past TTL
    vi.advanceTimersByTime(SESSION_LIST_TTL_MS + 1000);

    await useSessionListStore.getState().fetchSessions();
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('handles error response and sets error state', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Network error'));

    await useSessionListStore.getState().fetchSessions();

    const state = useSessionListStore.getState();
    expect(state.error).toBe('Network error');
    expect(state.loading).toBe(false);
  });
});
