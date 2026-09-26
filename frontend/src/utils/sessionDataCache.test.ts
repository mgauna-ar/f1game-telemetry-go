import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSessionLapData, invalidateSessionLapData, primeSessionLapData } from './sessionDataCache';
import { SESSION_DATA_CACHE_LIMIT } from '../constants/f1';
import { makeLap, makeParticipant } from '../test/wireFactories';

const participants = [makeParticipant({ car_index: 0, name: 'Max Verstappen' })];
const laps = [makeLap({ id: 10, car_index: 0 })];

function mockFetch(fail = false) {
  const fetchMock = vi.fn((url: string) => {
    if (fail) return Promise.resolve({ ok: false, status: 500, statusText: 'Server Error', json: () => Promise.resolve({ error: 'boom', code: 'INTERNAL' }) });
    const body = url.endsWith('/participants') ? participants : laps;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const urls = (fetchMock: ReturnType<typeof mockFetch>) => fetchMock.mock.calls.map(([url]) => url);

describe('sessionDataCache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads a session once for callers asking at the same time', async () => {
    const fetchMock = mockFetch();
    const [a, b] = await Promise.all([getSessionLapData(1), getSessionLapData(1)]);
    expect(a).toEqual({ participants, laps });
    expect(b).toBe(a);
    expect(urls(fetchMock)).toEqual(['/api/sessions/1/participants', '/api/sessions/1/laps']);
  });

  it('serves a loaded session without another request', async () => {
    const fetchMock = mockFetch();
    await getSessionLapData(1);
    fetchMock.mockClear();
    await getSessionLapData(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves primed data without any request', async () => {
    const fetchMock = mockFetch();
    primeSessionLapData(7, { participants, laps });
    expect(await getSessionLapData(7)).toEqual({ participants, laps });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not keep a failed load', async () => {
    mockFetch(true);
    await expect(getSessionLapData(2)).rejects.toThrow('boom');
    const fetchMock = mockFetch();
    expect(await getSessionLapData(2)).toEqual({ participants, laps });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops invalidated sessions', async () => {
    const fetchMock = mockFetch();
    primeSessionLapData(1, { participants, laps });
    primeSessionLapData(2, { participants, laps });
    invalidateSessionLapData([1]);
    await getSessionLapData(2);
    expect(fetchMock).not.toHaveBeenCalled();
    await getSessionLapData(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    invalidateSessionLapData();
    await getSessionLapData(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used session past the limit', async () => {
    const fetchMock = mockFetch();
    for (let id = 1; id <= SESSION_DATA_CACHE_LIMIT; id++) {
      primeSessionLapData(id, { participants, laps });
    }
    await getSessionLapData(1); // session 1 is now the most recently used
    primeSessionLapData(SESSION_DATA_CACHE_LIMIT + 1, { participants, laps });

    await getSessionLapData(1);
    expect(fetchMock).not.toHaveBeenCalled();
    await getSessionLapData(2);
    expect(urls(fetchMock)).toEqual(['/api/sessions/2/participants', '/api/sessions/2/laps']);
  });
});
