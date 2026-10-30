import { useEffect } from 'react';
import { RADIO_STORAGE_KEYS } from '../constants/f1';
import { getDeviceAudioSettings } from '../store/slices/audioSettingsSlice';
import { DEVICE_PREFERENCE_KEYS, reloadDevicePreferences } from '../store/useDevicePreferencesStore';
import { PERFORMANCE_MODE_KEYS, reloadPerformanceMode } from '../store/usePerformanceModeStore';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { onStoredElsewhere } from '../utils/storage';

/**
 * Keeps this page's This device settings in step with the app's other windows on the PC, which
 * share them (Windows): the radio switch, volume and effects, units, views and performance mode
 * changed in the main window reach the engineer's at once, and the other way round. The language
 * follows in I18nProvider. Mounted once per page: App and the engineer's.
 */
export function useDeviceSettingsSync(): void {
  useEffect(() => {
    const stops = [
      onStoredElsewhere(Object.values(RADIO_STORAGE_KEYS), () =>
        useRadioSettingsStore.setState(getDeviceAudioSettings())
      ),
      onStoredElsewhere(DEVICE_PREFERENCE_KEYS, reloadDevicePreferences),
      onStoredElsewhere(PERFORMANCE_MODE_KEYS, reloadPerformanceMode),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);
}
