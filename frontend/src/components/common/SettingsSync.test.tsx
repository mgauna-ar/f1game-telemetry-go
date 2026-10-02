import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { SettingsSync } from './SettingsSync';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import { ALERT_TOGGLE_KEYS } from '../../store/slices/triggerPresets';
import { useSettingsSaveStore } from '../../store/useSettingsSaveStore';
import { useToastStore } from '../../store/useToastStore';
import {
  resetComparatorPreferencesStore,
  useComparatorPreferencesStore,
} from '../../store/useComparatorPreferencesStore';
import { api } from '../../utils/apiClient';
import { DASHBOARD_CLIENT_ID } from '../../utils/settingsClient';
import { dispatchEngineerMessage, type EngineerMessageHandlers } from '../../utils/engineerSocket';

const engineerSocket = vi.hoisted(() => ({ handlers: new Set<EngineerMessageHandlers>() }));
vi.mock('../../utils/engineerSocket', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/engineerSocket')>();
  return {
    ...actual,
    subscribeEngineerMessages: (handlers: EngineerMessageHandlers) => {
      engineerSocket.handlers.add(handlers);
      return () => engineerSocket.handlers.delete(handlers);
    },
  };
});
const sendEngineerMessage = (msg: unknown) =>
  engineerSocket.handlers.forEach((handlers) => dispatchEngineerMessage(msg, handlers));

describe('SettingsSync', () => {
  beforeEach(() => {
    useRadioSettingsStore.getState().resetStoreToDefaults();
    useToastStore.getState().clearToasts();
    resetComparatorPreferencesStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useRadioSettingsStore.getState().resetStoreToDefaults();
    useSettingsSaveStore.getState().clear();
  });

  it('reloads the race engineer settings when another device saves a newer version', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      saved: true,
      version: 5,
      tyre_wear_warn_pct: 61,
      trigger_preset: 'custom',
      alert_switches: Object.fromEntries(ALERT_TOGGLE_KEYS.map((key) => [key, true])),
    });
    render(<SettingsSync />);

    act(() => sendEngineerMessage({ type: 'settings_changed', section: 'engineer', source: 'tab-b', version: 5 }));

    await waitFor(() => expect(useRadioSettingsStore.getState().tyreWearWarningPct).toBe(61));
    expect(getSpy).toHaveBeenCalledWith('/api/settings/engineer');
    expect(useRadioSettingsStore.getState().engineerVersion).toBe(5);
  });

  it('ignores its own saves and versions it already has', () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({});
    useRadioSettingsStore.setState({ engineerVersion: 5 });
    render(<SettingsSync />);

    act(() => {
      sendEngineerMessage({ type: 'settings_changed', section: 'engineer', source: DASHBOARD_CLIENT_ID, version: 6 });
      sendEngineerMessage({ type: 'settings_changed', section: 'engineer', source: 'tab-b', version: 5 });
      sendEngineerMessage({ type: 'settings_changed', section: 'voice', source: DASHBOARD_CLIENT_ID });
    });

    expect(getSpy).not.toHaveBeenCalled();
  });

  it('reloads the voice when another device saves it', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ saved: true, persona: 'colapinto', driver_callsign: 'Mati' });
    render(<SettingsSync />);

    act(() => sendEngineerMessage({ type: 'settings_changed', section: 'voice', source: 'tab-b' }));

    await waitFor(() => expect(useRadioSettingsStore.getState().driverCallsign).toBe('Mati'));
    expect(getSpy).toHaveBeenCalledWith('/api/settings/voice');
  });

  it('reloads the comparator preferences once this tab has them', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ saved: true, rival_mode: 'teammate', rival_driver_name: '' });
    render(<SettingsSync />);

    act(() => sendEngineerMessage({ type: 'settings_changed', section: 'comparator', source: 'tab-b' }));
    expect(getSpy).not.toHaveBeenCalled();

    useComparatorPreferencesStore.setState({ loaded: true });
    act(() => sendEngineerMessage({ type: 'settings_changed', section: 'comparator', source: 'tab-b' }));

    await waitFor(() => expect(useComparatorPreferencesStore.getState().preferences.rivalMode).toBe('teammate'));
    expect(getSpy).toHaveBeenCalledWith('/api/settings/comparator');
  });

  it('shows failed saves and conflicts as toasts', () => {
    render(<SettingsSync />);

    act(() => useSettingsSaveStore.getState().report('engineer', 'failed', 'disk full'));
    act(() => useSettingsSaveStore.getState().report('voice', 'conflict', 'changed elsewhere'));

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(2);
    expect(toasts[0]).toMatchObject({ type: 'error' });
    expect(toasts[0].message).toContain('race engineer');
    expect(toasts[0].message).toContain('disk full');
    expect(toasts[1]).toMatchObject({ type: 'info' });
    expect(toasts[1].message).toContain('another device');
    expect(useSettingsSaveStore.getState().problem).toBeNull();
  });
});
