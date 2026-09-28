import { create } from 'zustand';
import type { Session } from '../../../types/session';

interface PlayerPickerState {
  /** The session whose driver is being picked, or null while the picker is closed. */
  session: Session | null;
  openPlayerPicker: (session: Session) => void;
  closePlayerPicker: () => void;
}

/**
 * Which session the "Who were you?" picker is open for. History renders one `PlayerPickerModal`;
 * the list rows, the Story tab and the Your race card open it from here.
 */
export const usePlayerPickerStore = create<PlayerPickerState>((set) => ({
  session: null,
  openPlayerPicker: (session) => set({ session }),
  closePlayerPicker: () => set({ session: null }),
}));

export const openPlayerPicker = (session: Session) => usePlayerPickerStore.getState().openPlayerPicker(session);
