import { create } from 'zustand';
import type {
  CarTelemetryData,
  CarTelemetry2Data,
  LapData,
  CarStatusData,
  CarDamageData,
} from '../types/telemetry';

export interface TelemetryDataState {
  allLaps: LapData[];
  allCarStatus: CarStatusData[];
  allCarDamage: CarDamageData[];
  allTelemetry: CarTelemetryData[];
  allTelemetry2: CarTelemetry2Data[];
  playerCarIndex: number;
  selectedCarIndex: number;

  setSelectedCarIndex: (index: number) => void;
  setTelemetryData: (data: Partial<TelemetryDataState>) => void;
  resetTelemetryData: () => void;
}

export const useTelemetryDataStore = create<TelemetryDataState>((set) => ({
  allLaps: [],
  allCarStatus: [],
  allCarDamage: [],
  allTelemetry: [],
  allTelemetry2: [],
  playerCarIndex: 0,
  selectedCarIndex: 0,

  setSelectedCarIndex: (index: number) => set({ selectedCarIndex: index }),

  setTelemetryData: (data: Partial<TelemetryDataState>) => set(data),

  resetTelemetryData: () =>
    set({
      allLaps: [],
      allCarStatus: [],
      allCarDamage: [],
      allTelemetry: [],
      allTelemetry2: [],
      playerCarIndex: 0,
      selectedCarIndex: 0,
    }),
}));
