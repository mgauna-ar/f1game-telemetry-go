import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_COMPARATOR_PREFERENCES,
  isComparatorSavePending,
  resetComparatorPreferencesStore,
  useComparatorPreferencesStore,
} from './useComparatorPreferencesStore';
import { useSettingsSaveStore } from './useSettingsSaveStore';

type Handler = (url: string, init?: RequestInit) => { status?: number; body: unknown };

const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: '',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);

function mockFetch(handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const { status = 200, body } = handler(url, init);
    return jsonResponse(status, body);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const puts = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([, init]) => JSON.parse(String(init?.body)));

describe('useComparatorPreferencesStore', () => {
  beforeEach(() => {
    resetComparatorPreferencesStore();
    localStorage.clear();
    useSettingsSaveStore.getState().clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the shared preferences and drops what this browser kept', async () => {
    localStorage.setItem('f1_comparator_rival_mode', 'teammate');
    const fetchMock = mockFetch(() => ({ body: { saved: true, rival_mode: 'driver', rival_driver_name: 'Norris' } }));

    await useComparatorPreferencesStore.getState().ensureLoaded();

    expect(useComparatorPreferencesStore.getState()).toMatchObject({
      loaded: true,
      preferences: { rivalMode: 'driver', rivalDriverName: 'Norris' },
    });
    expect(localStorage.getItem('f1_comparator_rival_mode')).toBeNull();
    expect(puts(fetchMock)).toEqual([]);
  });

  it('moves the preferences an older version kept in this browser to the server', async () => {
    localStorage.setItem('f1_comparator_rival_mode', 'driver');
    localStorage.setItem('f1_comparator_rival_driver_name', '  Piastri ');
    const fetchMock = mockFetch((_url, init) =>
      init?.method === 'PUT'
        ? { body: { saved: true } }
        : { body: { saved: false, rival_mode: 'fastest', rival_driver_name: '' } }
    );

    await useComparatorPreferencesStore.getState().ensureLoaded();

    expect(useComparatorPreferencesStore.getState().preferences).toEqual({
      rivalMode: 'driver',
      rivalDriverName: '  Piastri ',
    });
    expect(puts(fetchMock)).toEqual([{ rival_mode: 'driver', rival_driver_name: 'Piastri' }]);
    expect(localStorage.getItem('f1_comparator_rival_mode')).toBeNull();
    expect(localStorage.getItem('f1_comparator_rival_driver_name')).toBeNull();
  });

  it('keeps the browser copy when moving it fails, to try again next time', async () => {
    localStorage.setItem('f1_comparator_rival_mode', 'teammate');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch((_url, init) =>
      init?.method === 'PUT' ? { status: 500, body: { error: 'disk full' } } : { body: { saved: false } }
    );

    await useComparatorPreferencesStore.getState().ensureLoaded();

    expect(useComparatorPreferencesStore.getState().preferences.rivalMode).toBe('teammate');
    expect(localStorage.getItem('f1_comparator_rival_mode')).toBe('teammate');
  });

  it('keeps the defaults when the server is out of reach', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    await useComparatorPreferencesStore.getState().ensureLoaded();
    expect(useComparatorPreferencesStore.getState()).toMatchObject({
      loaded: true,
      preferences: DEFAULT_COMPARATOR_PREFERENCES,
    });
  });

  it('saves a change once typing pauses, and reports a failed save', async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch(() => ({ status: 500, body: { error: 'nope' } }));
    const store = useComparatorPreferencesStore.getState();

    store.update({ rivalMode: 'driver', rivalDriverName: 'Lec' });
    store.update({ rivalMode: 'driver', rivalDriverName: 'Leclerc' });
    expect(useComparatorPreferencesStore.getState().preferences.rivalDriverName).toBe('Leclerc');
    expect(isComparatorSavePending()).toBe(true);

    await vi.runAllTimersAsync();

    expect(puts(fetchMock)).toEqual([{ rival_mode: 'driver', rival_driver_name: 'Leclerc' }]);
    expect(useSettingsSaveStore.getState().problem).toMatchObject({ section: 'comparator', kind: 'failed' });
    expect(isComparatorSavePending()).toBe(false);
  });
});
