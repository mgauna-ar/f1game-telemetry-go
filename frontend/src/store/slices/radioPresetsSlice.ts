import type { StateCreator } from 'zustand';
import { RADIO_TRIGGER_PRESETS, type RadioTriggerPreset } from '../../constants/f1';
import type { EngineerSettings } from '../../types/settings';
import { api } from '../../utils/apiClient';
import type { RadioSettingsState } from '../useRadioSettingsStore';
import { getInitialAlertThresholds, thresholdsFromSettings } from './alertThresholdsSlice';
import { TRIGGER_PRESET_VALUES } from './triggerPresets';

export interface RadioPresetsSlice {
  triggerPreset: RadioTriggerPreset;

  applyTriggerPreset: (preset: RadioTriggerPreset) => void;
  resetTriggerDefaults: () => Promise<void>;
}

export function getInitialRadioPresets(): Omit<
  RadioPresetsSlice,
  'applyTriggerPreset' | 'resetTriggerDefaults'
> {
  return {
    triggerPreset: RADIO_TRIGGER_PRESETS.IMMERSIVE,
  };
}

export const createRadioPresetsSlice: StateCreator<
  RadioSettingsState,
  [],
  [],
  RadioPresetsSlice
> = (set, get) => ({
  ...getInitialRadioPresets(),

  applyTriggerPreset: (preset) => {
    const partial: Partial<RadioSettingsState> =
      preset === RADIO_TRIGGER_PRESETS.CUSTOM
        ? { triggerPreset: preset }
        : { triggerPreset: preset, ...TRIGGER_PRESET_VALUES[preset] };

    set(partial);
    get().syncConfigToBackend();
  },

  resetTriggerDefaults: async () => {
    // The server owns the default thresholds; the bundled ones are only used when it can't be reached.
    const bundledDefaults = getInitialAlertThresholds();
    let thresholds = bundledDefaults;
    try {
      const serverDefaults = await api.get<EngineerSettings>('/api/settings/engineer/defaults');
      if (serverDefaults) {
        thresholds = thresholdsFromSettings(serverDefaults, bundledDefaults);
      }
    } catch {
      // Backend unavailable, keep the bundled defaults
    }

    set({
      ...TRIGGER_PRESET_VALUES[RADIO_TRIGGER_PRESETS.IMMERSIVE],
      ...thresholds,
      triggerPreset: RADIO_TRIGGER_PRESETS.IMMERSIVE,
    });
    get().syncConfigToBackend();
  },
});
