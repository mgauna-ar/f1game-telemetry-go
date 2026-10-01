import { create } from 'zustand';
import { RACE_CONTROL_LAYOUTS, STORAGE_KEY_RACE_CONTROL_LAYOUT, type RaceControlLayout } from '../constants/f1';
import { STORAGE_KEY_AI_DOCKED, STORAGE_KEY_AI_EXPANDED } from '../context/RaceEngineerContextDefinitions';
import { isRaceControlLayout } from '../utils/raceControl';
import { storage } from '../utils/storage';
import { browserLocale, defaultUnitsForLocale, normalizeUnits, type UnitPreferences } from '../utils/units';

/** Units saved on this device; until one is changed they follow the browser's locale. */
export const STORAGE_KEY_UNITS = 'f1_units';

export interface DevicePreferencesState {
  /** The AI chat opens in its wide reading view. */
  chatExpanded: boolean;
  /** The open AI chat docks beside the page instead of floating over it, where the window is wide enough. */
  chatDocked: boolean;
  /** How Race Control places its hub panels. */
  raceControlLayout: RaceControlLayout;
  /** Speed, temperature and clock units. */
  units: UnitPreferences;
  setUnits: (units: Partial<UnitPreferences>) => void;
  setChatExpanded: (expanded: boolean) => void;
  setChatDocked: (docked: boolean) => void;
  setRaceControlLayout: (layout: RaceControlLayout) => void;
}

const loadLayout = (): RaceControlLayout => {
  const saved = storage.get<string>(STORAGE_KEY_RACE_CONTROL_LAYOUT, RACE_CONTROL_LAYOUTS.GRID);
  return isRaceControlLayout(saved) ? saved : RACE_CONTROL_LAYOUTS.GRID;
};

const loadUnits = (): UnitPreferences =>
  normalizeUnits(storage.get<unknown>(STORAGE_KEY_UNITS, null), defaultUnitsForLocale(browserLocale()));

const loadState = () => ({
  chatExpanded: storage.get<boolean>(STORAGE_KEY_AI_EXPANDED, false) === true,
  chatDocked: storage.get<boolean>(STORAGE_KEY_AI_DOCKED, false) === true,
  raceControlLayout: loadLayout(),
  units: loadUnits(),
});

/**
 * Choices that belong to one screen rather than to the user, kept in this browser (units start
 * from the browser's locale): the views read them, and the settings page's "This device" section
 * changes them.
 */
export const useDevicePreferencesStore = create<DevicePreferencesState>((set) => ({
  ...loadState(),
  setChatExpanded: (chatExpanded) => {
    storage.set(STORAGE_KEY_AI_EXPANDED, chatExpanded);
    set({ chatExpanded });
  },
  setChatDocked: (chatDocked) => {
    storage.set(STORAGE_KEY_AI_DOCKED, chatDocked);
    set({ chatDocked });
  },
  setUnits: (change) =>
    set((state) => {
      const units = { ...state.units, ...change };
      storage.set(STORAGE_KEY_UNITS, units);
      return { units };
    }),
  setRaceControlLayout: (raceControlLayout) => {
    storage.set(STORAGE_KEY_RACE_CONTROL_LAYOUT, raceControlLayout);
    set({ raceControlLayout });
  },
}));

/** Back to the defaults, for tests. */
export function resetDevicePreferences(): void {
  useDevicePreferencesStore.setState({
    chatExpanded: false,
    chatDocked: false,
    raceControlLayout: RACE_CONTROL_LAYOUTS.GRID,
    units: { speed: 'kmh', temperature: 'c', clock: '24h' },
  });
}
