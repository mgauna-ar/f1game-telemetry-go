import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nProvider } from '../../context/I18nProvider';
import { navigate } from '../../router/router';
import {
  resetComparatorPreferencesStore,
  useComparatorPreferencesStore,
} from '../../store/useComparatorPreferencesStore';
import { resetDevicePreferences, useDevicePreferencesStore } from '../../store/useDevicePreferencesStore';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import { usePerformanceModeStore } from '../../store/usePerformanceModeStore';
import { SettingsPage } from './SettingsPage';

const renderAt = (path: string) => {
  window.history.replaceState(null, '', path);
  return render(
    <I18nProvider>
      <SettingsPage />
    </I18nProvider>
  );
};

describe('SettingsPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    resetComparatorPreferencesStore();
    resetDevicePreferences();
    useRadioSettingsStore.getState().resetStoreToDefaults();
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/settings/comparator') {
        const body =
          init?.method === 'PUT'
            ? JSON.parse(String(init.body))
            : { saved: true, rival_mode: 'teammate', rival_driver_name: '' };
        return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists every section and marks the open one, which the URL names', async () => {
    renderAt('/settings/ptt');
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Engineer & voice',
      'Radio calls',
      'Push-to-talk',
      'AI chat',
      'Comparator',
      'This device',
    ]);
    expect(within(nav).getByRole('link', { name: 'Push-to-talk' })).toHaveAttribute('aria-current', 'page');
    const section = screen.getByRole('region', { name: 'Push-to-talk' });
    expect(within(section).getByText('Every device')).toBeInTheDocument();
    expect(document.title).toMatch(/^Settings: Push-to-talk/);

    act(() => navigate('/settings/device', { replace: true }));
    expect(await screen.findByRole('region', { name: 'This device' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'This device' })).getByText('This device', { selector: 'span' })
    ).toBeInTheDocument();
  });

  it('saves the comparator rival for every device', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/settings/comparator');

    await waitFor(() => expect(screen.getByTestId('rival-mode-teammate-radio')).toBeChecked());
    fireEvent.click(screen.getByTestId('rival-mode-driver-radio'));
    fireEvent.change(screen.getByTestId('rival-driver-name-input'), { target: { value: 'Norris ' } });
    await act(() => vi.runAllTimersAsync());

    const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(puts.map(([url, init]) => [url, JSON.parse(String(init?.body))])).toEqual([
      ['/api/settings/comparator', { rival_mode: 'driver', rival_driver_name: 'Norris' }],
    ]);
    expect(useComparatorPreferencesStore.getState().preferences.rivalMode).toBe('driver');
  });

  it("changes this device's own choices", () => {
    renderAt('/settings/device');

    fireEvent.click(screen.getByRole('switch', { name: /Live Voice Race Engineer/ }));
    expect(useRadioSettingsStore.getState().isRadioEnabled).toBe(false);

    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'AI chat size' })).getByRole('radio', { name: 'Large' })
    );
    expect(useDevicePreferencesStore.getState().chatExpanded).toBe(true);
    expect(localStorage.getItem('f1_ai_engineer_expanded')).toBe('true');

    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Panel layout' })).getByRole('radio', { name: 'Race' })
    );
    expect(useDevicePreferencesStore.getState().raceControlLayout).toBe('race');

    const phone = screen.getByRole('radiogroup', { name: 'Live opens on a phone' });
    expect(within(phone).getByRole('radio', { name: 'Driver' })).toBeChecked();
    fireEvent.click(within(phone).getByRole('radio', { name: 'Voice Cockpit' }));
    expect(localStorage.getItem('f1_live_view_mode_phone')).toBe('cockpit');

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Speed' })).getByRole('radio', { name: 'mph' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Temperature' })).getByRole('radio', { name: '°F' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Clock' })).getByRole('radio', { name: '12-hour' }));
    expect(useDevicePreferencesStore.getState().units).toEqual({ speed: 'mph', temperature: 'f', clock: '12h' });
    expect(JSON.parse(localStorage.getItem('f1_units') ?? '{}')).toEqual({
      speed: 'mph',
      temperature: 'f',
      clock: '12h',
    });

    fireEvent.click(screen.getByRole('switch', { name: 'Every page but the Driver view' }));
    expect(usePerformanceModeStore.getState().enabled.general).toBe(true);
  });
});
