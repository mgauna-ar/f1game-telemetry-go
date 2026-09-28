import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSessionListStore, SESSION_LIST_TTL_MS } from './useSessionListStore';
import { api } from '../utils/apiClient';
import type { SessionListItem } from '../types/session';
import { makeSession, makeSessionListItem } from '../test/wireFactories';

describe('useSessionListStore', () => {
  const mockSessions: SessionListItem[] = [
    makeSessionListItem({ id: 1, track_name: 'Silverstone', session_type: 'Race' }),
    makeSessionListItem({ id: 2, track_name: 'Monza', session_type: 'Qualifying' }),
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

  it('saves a player car, patches the session and refetches the summaries', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(mockSessions);
    await useSessionListStore.getState().fetchSessions();
    const saved = makeSession({ id: 2, player_car_index: 4, player_car_source: 'user' });
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue(saved);
    getSpy.mockResolvedValueOnce([
      mockSessions[0],
      { ...mockSessions[1], player_car_index: 4, player_car_source: 'user' },
    ]);

    await expect(useSessionListStore.getState().setPlayerCar(2, 4)).resolves.toEqual(saved);

    expect(putSpy).toHaveBeenCalledWith('/api/sessions/2/player', { car_index: 4 });
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(getSpy).toHaveBeenLastCalledWith('/api/sessions');
    const state = useSessionListStore.getState();
    expect(state.playerRevision).toBe(1);
    expect(state.sessions[1]).toMatchObject({ id: 2, player_car_index: 4, player_car_source: 'user' });
  });

  it('runs a forced fetch again once the fetch in flight finishes', async () => {
    let finishFirst: (value: SessionListItem[]) => void = () => {};
    const getSpy = vi
      .spyOn(api, 'get')
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce([mockSessions[1]]);

    const first = useSessionListStore.getState().fetchSessions();
    const forced = useSessionListStore.getState().fetchSessions({ force: true });
    expect(getSpy).toHaveBeenCalledTimes(1);
    finishFirst(mockSessions);
    await first;
    await forced;

    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(useSessionListStore.getState().sessions).toEqual([mockSessions[1]]);
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
