import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DesktopWindow } from './DesktopWindow';
import { api, ApiError } from '../utils/apiClient';
import { useTelemetryEndpointStore, DEFAULT_TELEMETRY_ENDPOINT } from '../store/useTelemetryEndpointStore';
import type { DesktopState } from '../types/desktop';
import type { UpdateCheckResponse } from '../types/system';

/** The app on macOS or Linux, which opens this small window. */
const appWindow: DesktopState = {
  show_window_at_start: true,
  start_with_os: false,
  start_with_os_available: false,
  native_window: false,
  can_update: false,
};

/** The app on Windows, which has a window of its own. */
const windows: DesktopState = { ...appWindow, start_with_os_available: true, native_window: true, can_update: true };

const endpoint = { udp_addr: '0.0.0.0:20777', udp_port: 20777, local_ip: '127.0.0.1', lan_ips: ['192.168.1.20'] };

const newerRelease: UpdateCheckResponse = {
  update_available: true,
  current_version: 'v1.4.0',
  latest_version: 'v1.7.0',
  release_name: 'v1.7.0',
  release_notes: '',
  html_url: 'https://github.com/mgauna-ar/f1game-telemetry-go/releases/tag/v1.7.0',
  published_at: '2026-10-11T12:00:00Z',
  is_prerelease: false,
  assets: [],
};

const waiting = { udp_addr: endpoint.udp_addr, udp_port: endpoint.udp_port, packet_age_ms: null, session: null };

/** Answers the page's GETs: its desktop state (or an error), the version, the endpoint, the feed and the newest release. */
function mockGets(desktop: DesktopState | Error, feed: unknown = waiting, release: UpdateCheckResponse = newerRelease) {
  return vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
    switch (path) {
      case '/api/desktop':
        if (desktop instanceof Error) throw desktop;
        return desktop;
      case '/api/system/version':
        return { version: 'v1.4.0' };
      case '/api/system/network':
        return endpoint;
      case '/api/system/status':
        return feed;
      case '/api/system/check-updates':
        return release;
      default:
        return null;
    }
  });
}

describe('DesktopWindow', () => {
  beforeEach(() => {
    useTelemetryEndpointStore.setState({ endpoint: DEFAULT_TELEMETRY_ENDPOINT });
    // The page sizes its window when it opens; jsdom has no window to resize
    vi.spyOn(window, 'resizeTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows where to open the dashboard and what to set in the game', async () => {
    mockGets(appWindow);
    render(<DesktopWindow />);

    expect(await screen.findByText('Version v1.4.0')).toBeInTheDocument();
    expect(await screen.findByText(`http://192.168.1.20:${window.location.port}`.replace(/:$/, ''))).toBeInTheDocument();
    expect(screen.getByText(window.location.origin)).toBeInTheDocument();
    expect(screen.getByText('20777')).toBeInTheDocument();
    expect(await screen.findByText('Waiting for the game on UDP port 20777')).toBeInTheDocument();
  });

  it('names the session while the game sends telemetry', async () => {
    const session = { session_uid: '0x1', session_type: 15, track_id: 11, packet_format: 2026, player_car_index: 0 };
    mockGets(appWindow, { ...waiting, packet_age_ms: 200, session });
    render(<DesktopWindow />);

    expect(await screen.findByRole('status')).toHaveTextContent('Live: Race · Monza');
  });

  it('saves the startup switches and shows what the server saved', async () => {
    mockGets(appWindow);
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ...appWindow, show_window_at_start: false });
    render(<DesktopWindow />);

    const showAtStart = await screen.findByRole('switch', { name: /Show this window at startup/ });
    expect(showAtStart).toBeChecked();
    fireEvent.click(showAtStart);

    expect(put).toHaveBeenCalledWith('/api/desktop', { show_window_at_start: false });
    await waitFor(() => expect(showAtStart).not.toBeChecked());
  });

  it('says the app keeps running in its terminal when the window closes', async () => {
    mockGets(appWindow);
    render(<DesktopWindow />);

    expect(await screen.findByRole('switch', { name: /Show this window at startup/ })).toBeInTheDocument();
    expect(screen.getByText(/keeps F1 Telemetry running in its terminal/)).toBeInTheDocument();
  });

  it('shows a failed save instead of hiding it', async () => {
    mockGets(appWindow);
    vi.spyOn(api, 'put').mockRejectedValue(new Error('disk full'));
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('switch', { name: /Show this window at startup/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the setting: disk full');
  });

  it('quits the app and says the window can be closed', async () => {
    mockGets(appWindow);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('button', { name: /Quit F1 Telemetry/ }));
    expect(post).toHaveBeenCalledWith('/api/desktop/quit');
    expect(await screen.findByRole('heading', { name: 'F1 Telemetry stopped' })).toBeInTheDocument();
    expect(close).toHaveBeenCalled();
  });

  it('says the app stopped when it already had and Quit finds nothing answering', async () => {
    mockGets(appWindow);
    vi.spyOn(api, 'post').mockRejectedValue(new TypeError('Failed to fetch'));
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('button', { name: /Quit F1 Telemetry/ }));
    expect(await screen.findByRole('heading', { name: 'F1 Telemetry stopped' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(close).toHaveBeenCalled();
  });

  it('shows a refused Quit and keeps the window', async () => {
    mockGets(appWindow);
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError('desktop app not available', 404, 'Not Found'));
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('button', { name: /Quit F1 Telemetry/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not quit: desktop app not available');
    expect(close).not.toHaveBeenCalled();
  });

  it('opens the dashboard in the browser through the server', async () => {
    mockGets(appWindow);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('button', { name: /Open dashboard/ }));
    expect(post).toHaveBeenCalledWith('/api/desktop/open-dashboard');
  });

  it('leaves out the startup options and Quit on another device', async () => {
    mockGets(new ApiError('only available on the PC the app runs on', 403, 'Forbidden'));
    render(<DesktopWindow />);

    expect(await screen.findByText(/only available on the PC running F1 Telemetry/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update now/ })).not.toBeInTheDocument();
    const dashboard = screen.getByRole('heading', { name: 'Dashboard' }).parentElement!;
    expect(within(dashboard).queryByRole('button', { name: /Open dashboard/ })).not.toBeInTheDocument();
  });

  it('offers a newer release and installs it with one click', async () => {
    mockGets({ ...appWindow, can_update: true });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ version: 'v1.7.0' });
    render(<DesktopWindow />);

    const notice = (await screen.findByRole('heading', { name: 'Version v1.7.0 is available' })).closest('section')!;
    expect(within(notice).getByRole('link', { name: /What's new/ })).toHaveAttribute('href', newerRelease.html_url);
    fireEvent.click(within(notice).getByRole('button', { name: /Update now/ }));

    expect(post).toHaveBeenCalledWith('/api/desktop/update');
    expect(await within(notice).findByText('Restarting F1 Telemetry…')).toBeInTheDocument();
    expect(within(notice).getByRole('button', { name: /Update now/ })).toBeDisabled();
  });

  it('shows a failed update with a link to the release page', async () => {
    mockGets({ ...appWindow, can_update: true });
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError("can't write to /usr/local/bin: permission denied", 500, 'Internal Server Error')
    );
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('button', { name: /Update now/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Could not update: can't write to /usr/local/bin: permission denied");
    expect(within(alert).getByRole('link', { name: 'Download it from the release page' })).toHaveAttribute(
      'href',
      newerRelease.html_url
    );
    expect(screen.getByRole('button', { name: /Update now/ })).toBeEnabled();
  });

  it('on Windows, says the app has a window of its own now and brings it up', async () => {
    const get = mockGets(windows);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DesktopWindow />);

    expect(await screen.findByRole('heading', { name: 'F1 Telemetry has its own window now' })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quit/ })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith('/api/system/check-updates', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Open F1 Telemetry' }));
    expect(post).toHaveBeenCalledWith('/api/desktop/open-dashboard');
    await waitFor(() => expect(close).toHaveBeenCalled());
  });

  it("stays open when the app's window doesn't come up", async () => {
    mockGets(windows);
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError('the app has no window of its own here', 409, 'Conflict'));
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open F1 Telemetry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Could not open F1 Telemetry's window: the app has no window of its own here"
    );
    expect(close).not.toHaveBeenCalled();
  });

  it("doesn't offer updates on a build that can't update itself, or when it's the latest", async () => {
    const get = mockGets(appWindow);
    const { unmount } = render(<DesktopWindow />);
    expect(await screen.findByRole('button', { name: /Quit F1 Telemetry/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update now/ })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith('/api/system/check-updates', expect.anything());
    unmount();

    mockGets({ ...appWindow, can_update: true }, waiting, { ...newerRelease, update_available: false });
    render(<DesktopWindow />);
    expect(await screen.findByRole('button', { name: /Quit F1 Telemetry/ })).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/system/check-updates', expect.anything()));
    expect(screen.queryByRole('button', { name: /Update now/ })).not.toBeInTheDocument();
  });
});
