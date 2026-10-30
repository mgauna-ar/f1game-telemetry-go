import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppProviders } from '../../AppProviders';
import * as storeModule from '../../store/useTelemetryStore';
import { api } from '../../utils/apiClient';
import { markNativeWindow } from '../../utils/nativeWindow';
import { EngineerPage } from './EngineerPage';

type HostWindow = Window & { chrome?: { webview?: unknown } };

const renderPage = () =>
  render(
    <AppProviders>
      <EngineerPage />
    </AppProviders>
  );

describe('EngineerPage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/engineer');
    // No live feed in tests
    vi.spyOn(storeModule, 'connectTelemetryWebSocket').mockReturnValue(() => {});
  });

  afterEach(() => {
    delete (window as HostWindow).chrome;
    window.name = '';
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('shows the voice cockpit and none of the dashboard around it', async () => {
    renderPage();
    expect(await screen.findByTestId('voice-cockpit-container')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Race engineer' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main Navigation' })).toBeNull();
    expect(screen.queryByTestId('live-view-toggle-cockpit')).toBeNull();
    // A browser has no app window to bring up
    expect(screen.queryByTestId('engineer-open-app')).toBeNull();
  });

  it('has the radio in the engineer window, and brings the main window up', async () => {
    (window as HostWindow).chrome = { webview: {} };
    markNativeWindow();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    renderPage();

    expect(await screen.findByTestId('voice-cockpit-container')).toBeInTheDocument();
    expect(screen.queryByText('On this PC the engineer speaks in its own window.')).toBeNull();

    fireEvent.click(screen.getByTestId('engineer-open-app'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/desktop/window', { window: 'main', path: undefined }));
  });
});
