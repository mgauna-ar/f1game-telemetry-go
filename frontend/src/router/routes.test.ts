import { describe, it, expect, beforeEach } from 'vitest';
import { buildPath, parseRoute, storeLastPage, type Route } from './routes';

describe('routes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads the session list, a session and its tab', () => {
    expect(parseRoute('/history')).toEqual({ page: 'history', sessionId: undefined, tab: 'story' });
    expect(parseRoute('/history/12')).toEqual({ page: 'history', sessionId: 12, tab: 'story' });
    expect(parseRoute('/history/12/stints')).toEqual({ page: 'history', sessionId: 12, tab: 'stints' });
    expect(parseRoute('/history/12/gap')).toEqual({ page: 'history', sessionId: 12, tab: 'gap' });
  });

  it('opens the pace chart for the old lap charts tab', () => {
    expect(parseRoute('/history/12/charts')).toEqual({ page: 'history', sessionId: 12, tab: 'pace' });
  });

  it('drops an invalid session or tab', () => {
    expect(parseRoute('/history/abc/charts')).toEqual({ page: 'history', sessionId: undefined, tab: 'story' });
    expect(parseRoute('/history/0')).toMatchObject({ sessionId: undefined });
    expect(parseRoute('/history/12/nope')).toEqual({ page: 'history', sessionId: 12, tab: 'story' });
  });

  it('reads the comparator slots and zoom', () => {
    expect(parseRoute('/compare', '?sa=3&a=41&b=42&zoom=120-560')).toEqual({
      page: 'compare',
      sessionA: 3,
      lapA: 41,
      sessionB: 3,
      lapB: 42,
      zoom: [120, 560],
    });
    expect(parseRoute('/compare', '?sa=3&a=41&sb=4&b=42')).toMatchObject({ sessionA: 3, sessionB: 4 });
    expect(parseRoute('/compare', '?sb=4&b=42')).toMatchObject({ sessionA: undefined, sessionB: 4, lapB: 42 });
    expect(parseRoute('/compare', '?zoom=560-120')).toMatchObject({ zoom: undefined });
  });

  it('reads the live mode, and falls back to the last one used', () => {
    expect(parseRoute('/live/cockpit')).toEqual({ page: 'live', mode: 'cockpit' });
    expect(parseRoute('/live')).toEqual({ page: 'live', mode: 'dashboard' });
    localStorage.setItem('f1_live_view_mode', JSON.stringify('cockpit'));
    expect(parseRoute('/live/other')).toEqual({ page: 'live', mode: 'cockpit' });
  });

  it('reads the progress track', () => {
    expect(parseRoute('/progress')).toEqual({ page: 'progress', track: undefined });
    expect(parseRoute('/progress/Abu%20Dhabi')).toEqual({ page: 'progress', track: 'Abu Dhabi' });
    expect(parseRoute('/progress/%E0%A4%A')).toEqual({ page: 'progress', track: undefined });
  });

  it('opens the last page at the root, and the list at an unknown path', () => {
    expect(parseRoute('/')).toMatchObject({ page: 'history' });
    storeLastPage('compare');
    expect(parseRoute('/')).toMatchObject({ page: 'compare' });
    storeLastPage('live');
    expect(parseRoute('/')).toMatchObject({ page: 'live' });
    storeLastPage('progress');
    expect(parseRoute('/')).toMatchObject({ page: 'progress' });
    expect(parseRoute('/settings/ai')).toEqual({ page: 'history', sessionId: undefined, tab: 'story' });
  });

  it('builds URLs that parse back to the same route', () => {
    const routes: Route[] = [
      { page: 'history', tab: 'story' },
      { page: 'history', tab: 'story', listFilter: { quick: 'noDriver', track: 'Abu Dhabi' } },
      { page: 'history', tab: 'story', listFilter: { quick: 'podium' } },
      { page: 'history', sessionId: 7, tab: 'story' },
      { page: 'history', sessionId: 7, tab: 'classification' },
      { page: 'history', sessionId: 7, tab: 'pace' },
      { page: 'history', sessionId: 7, tab: 'sectors' },
      { page: 'live', mode: 'cockpit' },
      { page: 'progress' },
      { page: 'progress', track: 'Abu Dhabi' },
      { page: 'compare', sessionA: 1, lapA: 10, sessionB: 2, lapB: 20, zoom: [100, 900] },
      { page: 'compare', sessionA: 1, lapA: 10, sessionB: 1, lapB: 11 },
    ];
    for (const route of routes) {
      const url = new URL(buildPath(route), 'http://localhost');
      expect(parseRoute(url.pathname, url.search)).toMatchObject(route);
    }
  });

  it('reads the filters a link opens the session list with, and drops unknown ones', () => {
    expect(parseRoute('/history', '?quick=noDriver&track=Spa')).toEqual({
      page: 'history',
      tab: 'story',
      listFilter: { quick: 'noDriver', track: 'Spa' },
    });
    expect(parseRoute('/history', '?quick=bogus')).toEqual({ page: 'history', sessionId: undefined, tab: 'story' });
    // A session page ignores them
    expect(parseRoute('/history/3', '?quick=noDriver')).toEqual({ page: 'history', sessionId: 3, tab: 'story' });
    expect(buildPath({ page: 'history', tab: 'story', listFilter: { track: 'São Paulo' } })).toBe(
      '/history?track=S%C3%A3o+Paulo'
    );
  });

  it('writes short comparator URLs', () => {
    expect(buildPath({ page: 'compare' })).toBe('/compare');
    expect(buildPath({ page: 'compare', sessionA: 1, lapA: 10, sessionB: 1, lapB: 11, zoom: [100.4, 899.6] })).toBe(
      '/compare?sa=1&a=10&b=11&zoom=100-900'
    );
    expect(buildPath({ page: 'history', sessionId: 7, tab: 'story' })).toBe('/history/7');
    expect(buildPath({ page: 'history', sessionId: 7, tab: 'classification' })).toBe('/history/7/classification');
  });
});
