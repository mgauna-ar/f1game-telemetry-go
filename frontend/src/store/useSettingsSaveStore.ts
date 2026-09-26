import { create } from 'zustand';
import type { SettingsSection } from '../types/settings';

/**
 * A settings save that didn't go through: it `failed`, or it was a `conflict` because another
 * device saved first and this tab reloaded the newer copy.
 */
export interface SettingsSaveProblem {
  id: number;
  section: SettingsSection;
  kind: 'failed' | 'conflict';
  message: string;
}

interface SettingsSaveStore {
  /** The latest problem; `SettingsSync` shows it as a toast and clears it. */
  problem: SettingsSaveProblem | null;
  report: (section: SettingsSection, kind: SettingsSaveProblem['kind'], message: string) => void;
  clear: () => void;
}

let problemCounter = 0;

export const useSettingsSaveStore = create<SettingsSaveStore>((set) => ({
  problem: null,
  report: (section, kind, message) => set({ problem: { id: ++problemCounter, section, kind, message } }),
  clear: () => set({ problem: null }),
}));

/** Records a failed save of `section`; the toast shows `err`'s message. */
export function reportSettingsSaveFailure(section: SettingsSection, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  useSettingsSaveStore.getState().report(section, 'failed', message);
}
