import { create } from 'zustand';
import { STORAGE_KEY_PERFORMANCE_MODE, STORAGE_KEY_PERFORMANCE_MODE_DRIVER } from '../constants/f1';
import { storage } from '../utils/storage';

/** Where a performance mode choice applies: the Driver view, or every other page. */
export type PerformanceContext = 'driver' | 'general';

const STORAGE_KEYS: Record<PerformanceContext, string> = {
  driver: STORAGE_KEY_PERFORMANCE_MODE_DRIVER,
  general: STORAGE_KEY_PERFORMANCE_MODE,
};

/** On by default only in the Driver view, a phone on the rig. */
const DEFAULTS: Record<PerformanceContext, boolean> = { driver: true, general: false };

export interface PerformanceModeState {
  /** Whether performance mode is on, per context, as this device saved it. */
  enabled: Record<PerformanceContext, boolean>;
  setEnabled: (context: PerformanceContext, on: boolean) => void;
}

const load = (context: PerformanceContext): boolean =>
  storage.get<boolean>(STORAGE_KEYS[context], DEFAULTS[context]) === true;

/** Performance mode (solid surfaces, no glow or motion), saved per device and per context. */
export const usePerformanceModeStore = create<PerformanceModeState>((set) => ({
  enabled: { driver: load('driver'), general: load('general') },
  setEnabled: (context, on) => {
    storage.set(STORAGE_KEYS[context], on);
    set((s) => ({ enabled: { ...s.enabled, [context]: on } }));
  },
}));
