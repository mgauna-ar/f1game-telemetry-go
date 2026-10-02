import { api } from './apiClient';
import type { DesktopState, DesktopUpdate } from '../types/desktop';

/**
 * The page the app window shows (`main.tsx` renders it instead of the dashboard). The server opens
 * it in a small browser window of its own at startup and from the Windows tray.
 */
export const DESKTOP_WINDOW_PATH = '/desktop';

/** Whether this page is the app window rather than the dashboard. */
export const isDesktopWindowPath = (pathname: string): boolean => pathname === DESKTOP_WINDOW_PATH;

/**
 * /api/desktop: the app on the PC it runs on. The server answers only requests from that PC, so a
 * phone or tablet opening the page gets 403 and the page leaves these controls out.
 */
export const desktopClient = {
  getState: (signal?: AbortSignal) => api.get<DesktopState>('/api/desktop', signal),
  update: (update: DesktopUpdate) => api.put<DesktopState>('/api/desktop', update),
  openDashboard: () => api.post('/api/desktop/open-dashboard'),
  quit: () => api.post('/api/desktop/quit'),
};
