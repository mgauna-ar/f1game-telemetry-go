import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../context/I18nProvider';
import { LIVE_VIEW_MODES } from '../constants/f1';
import { useToastStore } from '../store/useToastStore';
import { api } from '../utils/apiClient';
import { LiveViewModeSwitch } from './LiveViewModeSwitch';

type HostWindow = Window & { chrome?: { webview?: unknown } };

const renderSwitch = () =>
  render(
    <I18nProvider>
      <LiveViewModeSwitch value={LIVE_VIEW_MODES.DASHBOARD} onChange={vi.fn()} />
    </I18nProvider>
  );

describe('LiveViewModeSwitch', () => {
  afterEach(() => {
    delete (window as HostWindow).chrome;
    window.name = '';
    vi.restoreAllMocks();
  });

  it('has no Race Control window in a browser', () => {
    renderSwitch();
    expect(screen.queryByTestId('live-race-control-window')).toBeNull();
  });

  it('opens Race Control in a window of its own from the app window', async () => {
    (window as HostWindow).chrome = { webview: {} };
    const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
    renderSwitch();

    fireEvent.click(screen.getByRole('button', { name: 'Race Control in a new window' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/desktop/window', { window: 'race-control', path: undefined })
    );
  });

  it('says when the window did not open', async () => {
    (window as HostWindow).chrome = { webview: {} };
    vi.spyOn(api, 'post').mockRejectedValue(new Error('the app has no window of its own here'));
    renderSwitch();

    fireEvent.click(screen.getByTestId('live-race-control-window'));
    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
        'The Race Control window didn’t open: the app has no window of its own here'
      )
    );
  });

  it('has no button for itself in the Race Control window', () => {
    (window as HostWindow).chrome = { webview: {} };
    window.name = 'race-control';
    renderSwitch();
    expect(screen.queryByTestId('live-race-control-window')).toBeNull();
  });
});
