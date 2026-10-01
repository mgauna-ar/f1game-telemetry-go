import { create } from 'zustand';
import { RACE_CONTROL_LAYOUTS, STORAGE_KEY_RACE_CONTROL_LAYOUT, type RaceControlLayout } from '../constants/f1';
import { STORAGE_KEY_AI_EXPANDED } from '../context/RaceEngineerContextDefinitions';
import { isRaceControlLayout } from '../utils/raceControl';
import { storage } from '../utils/storage';

export interface DevicePreferencesState {
  /** The AI chat opens in its wide reading view. */
  chatExpanded: boolean;
  /** How Race Control places its hub panels. */
  raceControlLayout: RaceControlLayout;
  setChatExpanded: (expanded: boolean) => void;
  setRaceControlLayout: (layout: RaceControlLayout) => void;
}

const loadLayout = (): RaceControlLayout => {
  const saved = storage.get<string>(STORAGE_KEY_RACE_CONTROL_LAYOUT, RACE_CONTROL_LAYOUTS.GRID);
  return isRaceControlLayout(saved) ? saved : RACE_CONTROL_LAYOUTS.GRID;
};

const loadState = () => ({
  chatExpanded: storage.get<boolean>(STORAGE_KEY_AI_EXPANDED, false) === true,
  raceControlLayout: loadLayout(),
});

/**
 * Choices that belong to one screen rather than to the user, kept in this browser: the views
 * read them, and the settings page's "This device" section changes them.
 */
export const useDevicePreferencesStore = create<DevicePreferencesState>((set) => ({
  ...loadState(),
  setChatExpanded: (chatExpanded) => {
    storage.set(STORAGE_KEY_AI_EXPANDED, chatExpanded);
    set({ chatExpanded });
  },
  setRaceControlLayout: (raceControlLayout) => {
    storage.set(STORAGE_KEY_RACE_CONTROL_LAYOUT, raceControlLayout);
    set({ raceControlLayout });
  },
}));

/** Back to the defaults, for tests. */
export function resetDevicePreferences(): void {
  useDevicePreferencesStore.setState({ chatExpanded: false, raceControlLayout: RACE_CONTROL_LAYOUTS.GRID });
}
