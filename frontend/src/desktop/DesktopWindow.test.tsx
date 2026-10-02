import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DesktopWindow } from './DesktopWindow';
import { api, ApiError } from '../utils/apiClient';
import { useTelemetryEndpointStore, DEFAULT_TELEMETRY_ENDPOINT } from '../store/useTelemetryEndpointStore';
import type { DesktopState } from '../types/desktop';

const windowsTray: DesktopState = {
  show_window_at_start: true,
  start_with_os: false,
  start_with_os_available: true,
  tray: true,
};

const endpoint = { udp_addr: '0.0.0.0:20777', udp_port: 20777, local_ip: '127.0.0.1', lan_ips: ['192.168.1.20'] };

const waiting = { udp_addr: endpoint.udp_addr, udp_port: endpoint.udp_port, packet_age_ms: null, session: null };

/** Answers the page's GETs: its desktop state (or an error), the version, the endpoint and the feed. */
function mockGets(desktop: DesktopState | Error, feed: unknown = waiting) {
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
      default:
        return null;
    }
  });
}

describe('DesktopWindow', () => {
  beforeEach(() => {
    useTelemetryEndpointStore.setState({ endpoint: DEFAULT_TELEMETRY_ENDPOINT });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows where to open the dashboard and what to set in the game', async () => {
    mockGets(windowsTray);
    render(<DesktopWindow />);

    expect(await screen.findByText('Version v1.4.0')).toBeInTheDocument();
    expect(await screen.findByText(`http://192.168.1.20:${window.location.port}`.replace(/:$/, ''))).toBeInTheDocument();
    expect(screen.getByText(window.location.origin)).toBeInTheDocument();
    expect(screen.getByText('20777')).toBeInTheDocument();
    expect(await screen.findByText('Waiting for the game on UDP port 20777')).toBeInTheDocument();
  });

  it('names the session while the game sends telemetry', async () => {
    const session = { session_uid: '0x1', session_type: 15, track_id: 11, packet_format: 2026, player_car_index: 0 };
    mockGets(windowsTray, { ...waiting, packet_age_ms: 200, session });
    render(<DesktopWindow />);

    expect(await screen.findByRole('status')).toHaveTextContent('Live: Race · Monza');
  });

  it('saves the startup switches and shows what the server saved', async () => {
    mockGets(windowsTray);
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ...windowsTray, show_window_at_start: false });
    render(<DesktopWindow />);

    const showAtStart = await screen.findByRole('switch', { name: /Show this window at startup/ });
    expect(showAtStart).toBeChecked();
    fireEvent.click(showAtStart);

    expect(put).toHaveBeenCalledWith('/api/desktop', { show_window_at_start: false });
    await waitFor(() => expect(showAtStart).not.toBeChecked());
  });

  it('turns on Start with Windows', async () => {
    mockGets(windowsTray);
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ...windowsTray, start_with_os: true });
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('switch', { name: /Start with Windows/ }));
    expect(put).toHaveBeenCalledWith('/api/desktop', { start_with_os: true });
    expect(await screen.findByRole('switch', { name: /Start with Windows/ })).toBeChecked();
  });

  it('leaves out Start with Windows off Windows and says the app stays in its terminal', async () => {
    mockGets({ ...windowsTray, start_with_os_available: false, tray: false });
    render(<DesktopWindow />);

    expect(await screen.findByRole('switch', { name: /Show this window at startup/ })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Start with Windows/ })).not.toBeInTheDocument();
    expect(screen.getByText(/keeps F1 Telemetry running in its terminal/)).toBeInTheDocument();
  });

  it('shows a failed save instead of hiding it', async () => {
    mockGets(windowsTray);
    vi.spyOn(api, 'put').mockRejectedValue(new Error('disk full'));
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('switch', { name: /Show this window at startup/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the setting: disk full');
  });

  it('quits the app and says the window can be closed', async () => {
    mockGets(windowsTray);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('button', { name: /Quit F1 Telemetry/ }));
    expect(post).toHaveBeenCalledWith('/api/desktop/quit');
    expect(await screen.findByRole('heading', { name: 'F1 Telemetry stopped' })).toBeInTheDocument();
    expect(close).toHaveBeenCalled();
  });

  it('says the app stopped when it already had and Quit finds nothing answering', async () => {
    mockGets(windowsTray);
    vi.spyOn(api, 'post').mockRejectedValue(new TypeError('Failed to fetch'));
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('button', { name: /Quit F1 Telemetry/ }));
    expect(await screen.findByRole('heading', { name: 'F1 Telemetry stopped' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(close).toHaveBeenCalled();
  });

  it('shows a refused Quit and keeps the window', async () => {
    mockGets(windowsTray);
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError('desktop app not available', 404, 'Not Found'));
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DesktopWindow />);

    fireEvent.click(await screen.findByRole('button', { name: /Quit F1 Telemetry/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not quit: desktop app not available');
    expect(close).not.toHaveBeenCalled();
  });

  it('opens the dashboard in the browser through the server', async () => {
    mockGets(windowsTray);
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
    const dashboard = screen.getByRole('heading', { name: 'Dashboard' }).parentElement!;
    expect(within(dashboard).queryByRole('button', { name: /Open dashboard/ })).not.toBeInTheDocument();
  });
});
