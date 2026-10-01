import { create } from 'zustand';
import type {
  CarTelemetryData,
  CarTelemetry2Data,
  LapData,
  CarStatusData,
  CarDamageData,
  GapTrend,
  LapTimes,
} from '../types/telemetry';

export interface TelemetryDataState {
  allLaps: LapData[];
  allCarStatus: CarStatusData[];
  allCarDamage: CarDamageData[];
  allTelemetry: CarTelemetryData[];
  allTelemetry2: CarTelemetry2Data[];
  /** Each car's completed-lap sectors and bests from the session history, by car index. */
  allLapTimes: LapTimes[];
  playerCarIndex: number;
  selectedCarIndex: number;
  /** Each car's best completed lap this session in ms, by car index (0: none yet). */
  bestLapTimes: number[];
  /** The race engineer's gap trends to the player's neighbours; null until measured. */
  gapAheadTrend: GapTrend | null;
  gapBehindTrend: GapTrend | null;

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
  allLapTimes: [],
  playerCarIndex: 0,
  selectedCarIndex: 0,
  bestLapTimes: [],
  gapAheadTrend: null,
  gapBehindTrend: null,

  setSelectedCarIndex: (index: number) => set({ selectedCarIndex: index }),

  setTelemetryData: (data: Partial<TelemetryDataState>) => set(data),

  resetTelemetryData: () =>
    set({
      allLaps: [],
      allCarStatus: [],
      allCarDamage: [],
      allTelemetry: [],
      allTelemetry2: [],
      allLapTimes: [],
      playerCarIndex: 0,
      selectedCarIndex: 0,
      bestLapTimes: [],
      gapAheadTrend: null,
      gapBehindTrend: null,
    }),
}));
