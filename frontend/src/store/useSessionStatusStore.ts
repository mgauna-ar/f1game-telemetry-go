import { create } from 'zustand';
import type {
  SessionData,
  RaceEvent,
  ParticipantData,
} from '../types/telemetry';

export interface SessionStatusState {
  session: SessionData | null;
  participants: ParticipantData[];
  events: RaceEvent[];
  packetFormat: number | null;
  connected: boolean;

  addEvent: (event: Omit<RaceEvent, 'id' | 'timestamp'>) => void;
  clearEvents: () => void;
  resetSession: () => void;
  setConnected: (connected: boolean) => void;
  setSessionStatus: (status: Partial<SessionStatusState>) => void;
}

export const useSessionStatusStore = create<SessionStatusState>((set) => ({
  session: null,
  participants: [],
  events: [],
  packetFormat: null,
  connected: false,

  addEvent: (event: Omit<RaceEvent, 'id' | 'timestamp'>) => {
    const newEvt: RaceEvent = {
      ...event,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      events: [newEvt, ...state.events].slice(0, 80),
    }));
  },

  clearEvents: () => set({ events: [] }),

  resetSession: () =>
    set({
      session: null,
      participants: [],
      events: [],
    }),

  setConnected: (connected: boolean) => set({ connected }),

  setSessionStatus: (status: Partial<SessionStatusState>) => set(status),
}));
