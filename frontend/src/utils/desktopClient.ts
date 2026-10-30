import { api } from './apiClient';
import type {
  DesktopState,
  DesktopUpdate,
  DesktopWindowName,
  ExternalLinkRequest,
  InstallUpdateResponse,
  WindowRequest,
} from '../types/desktop';

/**
 * The page the app window shows on macOS and Linux (`main.tsx` renders it instead of the
 * dashboard): the server opens it in a small browser window of its own at startup. On Windows the
 * app has its own window, which shows the dashboard.
 */
export const DESKTOP_WINDOW_PATH = '/desktop';

/** Whether this page is the app window rather than the dashboard. */
export const isDesktopWindowPath = (pathname: string): boolean => pathname === DESKTOP_WINDOW_PATH;

/**
 * /api/desktop: the app on the PC it runs on. The server answers only requests from that PC, so a
 * phone or tablet opening the page gets 403 and the page leaves these controls out. `installUpdate`
 * puts the newest release in place of the app and restarts it, answering with that version.
 * `showWindow` brings one of the app's own windows up (Windows), and `openLink` opens a page from
 * outside the dashboard in the default browser.
 */
export const desktopClient = {
  getState: (signal?: AbortSignal) => api.get<DesktopState>('/api/desktop', signal),
  update: (update: DesktopUpdate) => api.put<DesktopState>('/api/desktop', update),
  openDashboard: () => api.post('/api/desktop/open-dashboard'),
  showWindow: (window: DesktopWindowName, path?: string) =>
    api.post('/api/desktop/window', { window, path } satisfies WindowRequest),
  openLink: (url: string) => api.post('/api/desktop/open', { url } satisfies ExternalLinkRequest),
  installUpdate: () => api.post<InstallUpdateResponse>('/api/desktop/update'),
  quit: () => api.post('/api/desktop/quit'),
};
