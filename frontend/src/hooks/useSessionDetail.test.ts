import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionDetail } from './useSessionDetail';
import { getSessionLapData } from '../utils/sessionDataCache';
import type { SessionDetailResponse } from '../types/session';
import { makeDriverStanding, makeLap, makeParticipant, makeSession } from '../test/wireFactories';

const session = makeSession({ id: 42, session_type: 'Race', track_name: 'Monaco' });
const participants = [makeParticipant({ id: 1, session_id: 42, car_index: 0, name: 'Charles Leclerc', race_number: 16, position: 0 })];
const laps = [
  makeLap({ id: 100, session_id: 42, car_index: 0, lap_number: 1, lap_time_ms: 74000 }),
  makeLap({ id: 101, session_id: 42, car_index: 0, lap_number: 2, lap_time_ms: 72400 }),
  makeLap({ id: 200, session_id: 42, car_index: 3, lap_number: 1, lap_time_ms: 75000 }),
];
const detail: SessionDetailResponse = {
  participants,
  laps,
  classification: {
    standings: [
      makeDriverStanding({ position: 1, car_index: 0, driver_name: 'Charles Leclerc', best_lap_id: 101, best_lap_time_ms: 72400 }),
      // No participant row for car 3: the standing's own fields fill a placeholder.
      makeDriverStanding({ position: 2, car_index: 3, driver_name: 'Driver 4', race_number: 4, best_lap_id: 200, best_lap_time_ms: 75000 }),
    ],
    session_best_s1_ms: 0,
    session_best_s2_ms: 0,
    session_best_s3_ms: 0,
    ultimate_theoretical_ms: 0,
    actual_best_lap_ms: 72400,
    actual_best_lap_driver: 'Charles Leclerc',
    speed_rankings: [],
  },
  progression: { lap_pace: [], positions: [], gap_to_leader: [], drivers: [], total_session_laps: 2 },
  stints: {
    drivers: [],
    kpis: { most_popular_strategy: 'N/A', most_popular_count: 0, best_laps_by_compound: {}, total_field_pit_stops: 0 },
    degradation_data: [],
    max_tyre_age: 0,
    degradation_rates: {},
    session_compounds: [],
    effective_max_laps: 2,
  },
};

describe('useSessionDetail', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/sessions/42/detail'
          ? Promise.resolve({ ok: true, json: () => Promise.resolve(detail) })
          : Promise.reject(new Error(`Unhandled URL: ${url}`))
      )
    );
  });

  it('loads a session with one request and joins participants and laps by car', async () => {
    const { result } = renderHook(() => useSessionDetail());

    await act(async () => {
      await result.current.loadSession(session);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.detailError).toBeNull();
    expect(result.current.laps).toEqual(laps);
    expect(result.current.totalSessionLaps).toBe(2);

    const [leader, second] = result.current.driverStandings;
    expect(leader.participant.name).toBe('Charles Leclerc');
    expect(leader.participant.position).toBe(1);
    expect(leader.laps.map((l) => l.id)).toEqual([100, 101]);
    expect(leader.bestLap?.id).toBe(101);

    expect(second.participant).toMatchObject({ car_index: 3, name: 'Driver 4', race_number: 4, session_id: 42 });
    expect(second.laps.map((l) => l.id)).toEqual([200]);
    expect(second.bestLap?.id).toBe(200);
  });

  it('hands the loaded participants and laps to the comparator cache', async () => {
    const { result } = renderHook(() => useSessionDetail());
    await act(async () => {
      await result.current.loadSession(session);
    });

    expect(await getSessionLapData(42)).toEqual({ participants, laps });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('shows the server error when the detail request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 404, statusText: 'Not Found', json: () => Promise.resolve({ error: 'session not found', code: 'NOT_FOUND' }) })
      )
    );
    const { result } = renderHook(() => useSessionDetail());
    await act(async () => {
      await result.current.loadSession(session);
    });

    await waitFor(() => expect(result.current.detailError).toBe('session not found'));
    expect(result.current.driverStandings).toEqual([]);
  });
});
