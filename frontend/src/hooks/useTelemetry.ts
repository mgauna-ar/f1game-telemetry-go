import { useEffect } from 'react';
import { connectTelemetryWebSocket, parseDriverName } from '../store/useTelemetryStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import type {
  CarTelemetryData,
  LapData,
  CarMotionData,
  WeatherForecastSample,
  SessionData,
  RaceEvent,
  ParticipantData,
  CarStatusData,
  CarDamageData,
  PacketHeader,
  TelemetrySample,
  CarTelemetry2Data,
} from '../types/telemetry';
import { F1_DRIVER_NAMES } from '../constants/f1';

export type {
  CarTelemetryData,
  LapData,
  CarMotionData,
  WeatherForecastSample,
  SessionData,
  RaceEvent,
  ParticipantData,
  CarStatusData,
  CarDamageData,
  PacketHeader,
  TelemetrySample,
  CarTelemetry2Data,
};

export { F1_DRIVER_NAMES, parseDriverName };

const EMPTY_TRACK_PATH: { x: number; z: number }[] = [];
const EMPTY_MOTION: CarMotionData[] = [];
const EMPTY_HISTORY: TelemetrySample[] = [];

export interface UseTelemetryReturn {
  session: SessionData | null;
  participants: ParticipantData[];
  allLaps: LapData[];
  allMotion: CarMotionData[];
  allCarStatus: CarStatusData[];
  allCarDamage: CarDamageData[];
  allTelemetry: CarTelemetryData[];
  allTelemetry2: CarTelemetry2Data[];
  telemetry: CarTelemetryData | null;
  telemetry2: CarTelemetry2Data | null;
  lap: LapData | null;
  motion: CarMotionData | null;
  carStatus: CarStatusData | null;
  carDamage: CarDamageData | null;
  trackPath: { x: number; z: number }[];
  connected: boolean;
  history: TelemetrySample[];
  events: RaceEvent[];
  clearEvents: () => void;
  playerCarIndex: number;
  selectedCarIndex: number;
  setSelectedCarIndex: (index: number) => void;
  packetFormat: number | null;
}

/**
 * @deprecated Prefer using fine-grained selectors directly from `useTelemetryDataStore` and `useSessionStatusStore`
 * to avoid triggering unnecessary component re-renders on every 10Hz telemetry update.
 */
export function useTelemetry(wsUrl?: string): UseTelemetryReturn {

  useEffect(() => {
    const disconnect = connectTelemetryWebSocket(wsUrl);
    return () => {
      disconnect();
    };
  }, [wsUrl]);

  const session = useSessionStatusStore((s) => s.session);
  const participants = useSessionStatusStore((s) => s.participants);
  const events = useSessionStatusStore((s) => s.events);
  const clearEvents = useSessionStatusStore((s) => s.clearEvents);
  const packetFormat = useSessionStatusStore((s) => s.packetFormat);
  const connected = useSessionStatusStore((s) => s.connected);

  const allLaps = useTelemetryDataStore((s) => s.allLaps);
  const allCarStatus = useTelemetryDataStore((s) => s.allCarStatus);
  const allCarDamage = useTelemetryDataStore((s) => s.allCarDamage);
  const allTelemetry = useTelemetryDataStore((s) => s.allTelemetry);
  const allTelemetry2 = useTelemetryDataStore((s) => s.allTelemetry2);
  const playerCarIndex = useTelemetryDataStore((s) => s.playerCarIndex);
  const selectedCarIndex = useTelemetryDataStore((s) => s.selectedCarIndex);
  const setSelectedCarIndex = useTelemetryDataStore((s) => s.setSelectedCarIndex);

  const maxCars = Math.max(participants.length, allCarStatus.length, allLaps.length, allTelemetry.length, 22);
  const activeIdx = selectedCarIndex >= 0 && selectedCarIndex < maxCars ? selectedCarIndex : playerCarIndex;

  const telemetry = allTelemetry[activeIdx] || null;
  const lap = allLaps[activeIdx] || null;
  const motion: CarMotionData | null = null;
  const carStatus = allCarStatus[activeIdx] || null;
  const carDamage = allCarDamage[activeIdx] || null;
  const telemetry2 = allTelemetry2[activeIdx] || null;

  return {
    session,
    participants,
    allLaps,
    allMotion: EMPTY_MOTION,
    allCarStatus,
    allCarDamage,
    allTelemetry,
    allTelemetry2,
    telemetry,
    telemetry2,
    lap,
    motion,
    carStatus,
    carDamage,
    trackPath: EMPTY_TRACK_PATH,
    connected,
    history: EMPTY_HISTORY,
    events,
    clearEvents,
    playerCarIndex,
    selectedCarIndex,
    setSelectedCarIndex,
    packetFormat,
  };
}
