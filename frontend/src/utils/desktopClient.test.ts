import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from './apiClient';
import { DESKTOP_WINDOW_PATH, desktopClient, isDesktopWindowPath } from './desktopClient';

describe('desktopClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('recognises only the app window page', () => {
    expect(isDesktopWindowPath(DESKTOP_WINDOW_PATH)).toBe(true);
    expect(isDesktopWindowPath('/desktop/x')).toBe(false);
    expect(isDesktopWindowPath('/history')).toBe(false);
  });

  it('calls /api/desktop', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({});
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    const post = vi.spyOn(api, 'post').mockResolvedValue({});

    await desktopClient.getState();
    await desktopClient.update({ start_with_os: true });
    await desktopClient.openDashboard();
    await desktopClient.quit();

    expect(get).toHaveBeenCalledWith('/api/desktop', undefined);
    expect(put).toHaveBeenCalledWith('/api/desktop', { start_with_os: true });
    expect(post.mock.calls.map((c) => c[0])).toEqual(['/api/desktop/open-dashboard', '/api/desktop/quit']);
  });
});
