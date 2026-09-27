import { LIVE_VIEW_MODES, STORAGE_KEY_LIVE_VIEW_MODE, type LiveViewMode } from '../constants/f1';
import { storage } from '../utils/storage';

/**
 * The dashboard's pages and what their URLs hold. The Go server answers every unknown path with
 * index.html, so each of these can be opened, bookmarked and shared directly.
 *
 * - `/history`: the session list
 * - `/history/:sessionId[/:tab]`: one session; the tab is left out for the classification
 * - `/compare?sa=&a=&sb=&b=&zoom=`: sessions and laps of slots A and B, and the zoomed stretch
 *   in meters (`120-560`). `sb` is left out when both slots use the same session.
 * - `/live/:mode`: the live dashboard or the voice cockpit
 */

export const SESSION_DETAIL_TABS = ['classification', 'charts', 'stints', 'sectors'] as const;
export type SessionDetailTab = (typeof SESSION_DETAIL_TABS)[number];

export interface CompareParams {
  sessionA?: number;
  lapA?: number;
  sessionB?: number;
  lapB?: number;
  /** Lap distance in meters: [start, end]. */
  zoom?: [number, number];
}

export type Route =
  | { page: 'history'; sessionId?: number; tab: SessionDetailTab }
  | ({ page: 'compare' } & CompareParams)
  | { page: 'live'; mode: LiveViewMode };

export type Page = Route['page'];

/** The last page, reopened when the dashboard is opened at `/`. The old tab names are kept. */
export const STORAGE_KEY_LAST_PAGE = 'f1_active_tab';
const PAGE_TO_STORED: Record<Page, string> = { history: 'history', compare: 'comparator', live: 'live' };

const positiveInt = (value: string | null | undefined): number | undefined => {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 && Number.isSafeInteger(n) ? n : undefined;
};

const parseZoom = (value: string | null): [number, number] | undefined => {
  const match = value?.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end > start ? [start, end] : undefined;
};

const isDetailTab = (value: string | undefined): value is SessionDetailTab =>
  (SESSION_DETAIL_TABS as readonly string[]).includes(value ?? '');

const isLiveMode = (value: string | undefined): value is LiveViewMode =>
  value === LIVE_VIEW_MODES.DASHBOARD || value === LIVE_VIEW_MODES.COCKPIT;

/** The live mode last used on this browser. */
export const storedLiveMode = (): LiveViewMode => {
  const saved = storage.get<string>(STORAGE_KEY_LIVE_VIEW_MODE, LIVE_VIEW_MODES.DASHBOARD);
  return isLiveMode(saved) ? saved : LIVE_VIEW_MODES.DASHBOARD;
};

const storedPage = (): Page => {
  const saved = storage.get<string>(STORAGE_KEY_LAST_PAGE, 'history');
  if (saved === 'comparator') return 'compare';
  return saved === 'live' ? 'live' : 'history';
};

/**
 * The page a URL shows. Missing or invalid parts fall back to their defaults: `/` reopens the
 * last page, `/live` the last live mode, and an unknown path the session list.
 */
export function parseRoute(pathname: string, search = ''): Route {
  const parts = pathname.split('/').filter(Boolean);
  const [first, second, third] = parts;
  const page = first ?? storedPage();

  if (page === 'compare') {
    const query = new URLSearchParams(search);
    const sessionA = positiveInt(query.get('sa'));
    const params: CompareParams = {
      sessionA,
      lapA: positiveInt(query.get('a')),
      sessionB: positiveInt(query.get('sb')) ?? sessionA,
      lapB: positiveInt(query.get('b')),
      zoom: parseZoom(query.get('zoom')),
    };
    return { page: 'compare', ...params };
  }
  if (page === 'live') {
    return { page: 'live', mode: isLiveMode(second) ? second : storedLiveMode() };
  }
  const sessionId = page === 'history' ? positiveInt(second) : undefined;
  return { page: 'history', sessionId, tab: sessionId && isDetailTab(third) ? third : 'classification' };
}

const roundMeters = (value: number) => String(Math.round(value));

/** The URL of a page; parsing it gives the same route back. */
export function buildPath(route: Route): string {
  switch (route.page) {
    case 'history':
      if (!route.sessionId) return '/history';
      return route.tab === 'classification'
        ? `/history/${route.sessionId}`
        : `/history/${route.sessionId}/${route.tab}`;
    case 'live':
      return `/live/${route.mode}`;
    case 'compare': {
      const query = new URLSearchParams();
      if (route.sessionA) query.set('sa', String(route.sessionA));
      if (route.lapA) query.set('a', String(route.lapA));
      if (route.sessionB && route.sessionB !== route.sessionA) query.set('sb', String(route.sessionB));
      if (route.lapB) query.set('b', String(route.lapB));
      if (route.zoom) query.set('zoom', `${roundMeters(route.zoom[0])}-${roundMeters(route.zoom[1])}`);
      const text = query.toString();
      return text ? `/compare?${text}` : '/compare';
    }
  }
}

/** Remembers the page for the next time the dashboard is opened at `/`. */
export const storeLastPage = (page: Page) => storage.set(STORAGE_KEY_LAST_PAGE, PAGE_TO_STORED[page]);
