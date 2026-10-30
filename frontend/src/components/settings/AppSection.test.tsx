import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nProvider } from '../../context/I18nProvider';
import { useAppUpdateStore } from '../../store/useAppUpdateStore';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useTelemetryEndpointStore } from '../../store/useTelemetryEndpointStore';
import { api, ApiError } from '../../utils/apiClient';
import type { DesktopState } from '../../types/desktop';
import type { SystemVersion, UpdateCheckResponse } from '../../types/system';
import { AppSection } from './AppSection';

/** The app on Windows, a release build: its own window, Start with Windows and updates. */
const windows: DesktopState = {
  show_window_at_start: true,
  start_with_os: false,
  start_with_os_available: true,
  native_window: true,
  can_update: true,
};

/** The app on macOS or Linux, with its small browser window. */
const appWindow: DesktopState = { ...windows, start_with_os_available: false, native_window: false };

const release: SystemVersion = { version: 'v2.0.0', commit: 'caa3840', build_date: '', is_dev: false, is_beta: false };

const newerRelease: UpdateCheckResponse = {
  update_available: true,
  current_version: 'v2.0.0',
  latest_version: 'v2.1.0',
  release_name: 'v2.1.0',
  release_notes: '',
  html_url: 'https://github.com/mgauna-ar/f1game-telemetry-go/releases/tag/v2.1.0',
  published_at: '2026-11-02T12:00:00Z',
  is_prerelease: false,
  assets: [],
};

/** Answers the section's GETs: the app's state (or an error), the version and the newest release. */
function mockGets(
  desktop: DesktopState | Error,
  version: SystemVersion = release,
  newest: UpdateCheckResponse = newerRelease
) {
  return vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
    switch (path) {
      case '/api/desktop':
        if (desktop instanceof Error) throw desktop;
        return desktop;
      case '/api/system/version':
        return version;
      case '/api/system/check-updates':
        return newest;
      default:
        return null;
    }
  });
}

const renderSection = () =>
  render(
    <I18nProvider>
      <AppSection />
    </I18nProvider>
  );

const section = (name: string) => screen.getByRole('region', { name });

describe('AppSection', () => {
  beforeEach(() => {
    useDesktopStore.setState({ state: null, status: 'idle' });
    useAppUpdateStore.setState({ version: null, release: null, requested: false });
    useTelemetryEndpointStore.setState({
      endpoint: { udp_addr: '0.0.0.0:20777', udp_port: 20777, local_ip: '127.0.0.1', lan_ips: ['192.168.1.20'] },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the version and installs a newer release with one click', async () => {
    mockGets(windows);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ version: 'v2.1.0' });
    renderSection();

    expect(await screen.findByText('F1 Telemetry v2.0.0')).toBeInTheDocument();
    const notice = (await screen.findByRole('heading', { name: 'Version v2.1.0 is available', level: 4 })).closest(
      'section'
    )!;
    expect(within(notice).getByRole('link', { name: /What's new/ })).toHaveAttribute('href', newerRelease.html_url);
    fireEvent.click(within(notice).getByRole('button', { name: /Update now/ }));

    expect(post).toHaveBeenCalledWith('/api/desktop/update');
    expect(await within(notice).findByText('Restarting F1 Telemetry…')).toBeInTheDocument();
  });

  it('says when it is the newest version, and that a development build does not update', async () => {
    mockGets(windows, release, { ...newerRelease, update_available: false });
    const { unmount } = renderSection();
    expect(await screen.findByText('It’s the newest version.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update now/ })).not.toBeInTheDocument();
    unmount();

    useAppUpdateStore.setState({ version: null, release: null, requested: false });
    mockGets({ ...windows, can_update: false }, { ...release, version: 'dev-caa3840', is_dev: true });
    renderSection();
    expect(await screen.findByText('A development build: it doesn’t update itself.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update now/ })).not.toBeInTheDocument();
  });

  it('saves how the app starts on Windows', async () => {
    mockGets(windows);
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValueOnce({ ...windows, show_window_at_start: false })
      .mockResolvedValueOnce({ ...windows, show_window_at_start: false, start_with_os: true });
    renderSection();

    const openWindow = await screen.findByRole('switch', { name: /Open the window when F1 Telemetry starts/ });
    expect(openWindow).toBeChecked();
    fireEvent.click(openWindow);
    expect(put).toHaveBeenCalledWith('/api/desktop', { show_window_at_start: false });
    await waitFor(() => expect(openWindow).not.toBeChecked());

    fireEvent.click(screen.getByRole('switch', { name: /Start with Windows/ }));
    expect(put).toHaveBeenCalledWith('/api/desktop', { start_with_os: true });
    await waitFor(() => expect(screen.getByRole('switch', { name: /Start with Windows/ })).toBeChecked());
    expect(screen.getByText(/keeps F1 Telemetry running in the tray/)).toBeInTheDocument();
  });

  it('names the small window on macOS and Linux, which have no Start with Windows', async () => {
    mockGets(appWindow);
    renderSection();

    expect(await screen.findByRole('switch', { name: /Open the app window when F1 Telemetry starts/ })).toBeChecked();
    expect(screen.queryByRole('switch', { name: /Start with Windows/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Closing this page keeps F1 Telemetry running in its terminal/)).toBeInTheDocument();
  });

  it('shows a failed save instead of hiding it', async () => {
    mockGets(windows);
    vi.spyOn(api, 'put').mockRejectedValue(new Error('disk full'));
    renderSection();

    const openWindow = await screen.findByRole('switch', { name: /Open the window when F1 Telemetry starts/ });
    fireEvent.click(openWindow);
    expect(await within(section('Startup')).findByRole('alert')).toHaveTextContent(
      'Could not change the setting: disk full'
    );
    expect(openWindow).toBeChecked();
  });

  it('gives a phone or tablet the address on the network', async () => {
    mockGets(windows);
    const { unmount } = renderSection();
    const address = `http://192.168.1.20${window.location.port ? `:${window.location.port}` : ''}`;
    expect(
      await within(await screen.findByRole('region', { name: 'Phone or tablet' })).findByText(address)
    ).toBeInTheDocument();
    unmount();

    useTelemetryEndpointStore.setState({
      endpoint: { udp_addr: '127.0.0.1:20777', udp_port: 20777, local_ip: '127.0.0.1', lan_ips: ['127.0.0.1'] },
    });
    renderSection();
    expect(await screen.findByText(/This PC has no address a phone or tablet can reach/)).toBeInTheDocument();
  });

  it('quits the app, or says why it could not', async () => {
    mockGets(windows);
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new ApiError('desktop app not available', 404, 'Not Found'))
      .mockResolvedValueOnce({ status: 'success' });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /Quit F1 Telemetry/ }));
    expect(await within(section('Quit')).findByRole('alert')).toHaveTextContent(
      'Could not quit: desktop app not available'
    );

    fireEvent.click(screen.getByRole('button', { name: /Quit F1 Telemetry/ }));
    expect(post).toHaveBeenLastCalledWith('/api/desktop/quit');
    expect(await screen.findByRole('status')).toHaveTextContent('F1 Telemetry stopped. You can close this page.');
    expect(screen.queryByRole('button', { name: /Quit F1 Telemetry/ })).not.toBeInTheDocument();
  });

  it('is empty on a phone or tablet, which the server refuses', async () => {
    mockGets(new ApiError('only available on the PC the app runs on', 403, 'Forbidden'));
    renderSection();

    expect(await screen.findByText('These are only on the PC that runs F1 Telemetry.')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
