import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { RADIO_STORAGE_KEYS } from '../constants/f1';
import {
  resetDevicePreferences,
  STORAGE_KEY_UNITS,
  useDevicePreferencesStore,
} from '../store/useDevicePreferencesStore';
import { usePerformanceModeStore } from '../store/usePerformanceModeStore';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { useDeviceSettingsSync } from './useDeviceSettingsSync';

/** Another window of the app on this PC saves a This device setting. */
const savedElsewhere = (key: string, value: string) => {
  localStorage.setItem(key, value);
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
  });
};

describe('useDeviceSettingsSync', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDevicePreferences();
    useRadioSettingsStore.getState().resetStoreToDefaults();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('takes the radio, units and performance mode another window changed', () => {
    const { unmount } = renderHook(() => useDeviceSettingsSync());
    const persona = useRadioSettingsStore.getState().persona;

    savedElsewhere(RADIO_STORAGE_KEYS.VOLUME, '0.3');
    savedElsewhere(RADIO_STORAGE_KEYS.ALERTS_ENABLED, 'false');
    expect(useRadioSettingsStore.getState()).toMatchObject({ volume: 0.3, isRadioEnabled: false, persona });

    savedElsewhere(STORAGE_KEY_UNITS, JSON.stringify({ speed: 'mph', temperature: 'f', clock: '12h' }));
    expect(useDevicePreferencesStore.getState().units).toEqual({ speed: 'mph', temperature: 'f', clock: '12h' });

    savedElsewhere('f1_performance_mode', 'true');
    expect(usePerformanceModeStore.getState().enabled.general).toBe(true);

    // Once the page is gone, it stops listening
    unmount();
    savedElsewhere(RADIO_STORAGE_KEYS.VOLUME, '0.9');
    expect(useRadioSettingsStore.getState().volume).toBe(0.3);
  });
});
