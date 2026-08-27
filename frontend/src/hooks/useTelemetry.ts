import { useEffect } from 'react';
import { useTelemetryStore, connectTelemetryWebSocket, parseDriverName } from '../store/useTelemetryStore';
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

/**
 * @deprecated Prefer using fine-grained selectors directly from `useTelemetryStore`
 * (e.g. `useTelemetryStore((s) => s.session)`) to avoid triggering unnecessary component
 * re-renders on every 10Hz telemetry update.
 */
export function useTelemetry(wsUrl?: string) {
  useEffect(() => {
    const disconnect = connectTelemetryWebSocket(wsUrl);
    return () => {
      disconnect();
    };
  }, [wsUrl]);

  const session = useTelemetryStore((s) => s.session);
  const participants = useTelemetryStore((s) => s.participants);
  const allLaps = useTelemetryStore((s) => s.allLaps);
  const allCarStatus = useTelemetryStore((s) => s.allCarStatus);
  const allCarDamage = useTelemetryStore((s) => s.allCarDamage);
  const allTelemetry = useTelemetryStore((s) => s.allTelemetry);
  const allTelemetry2 = useTelemetryStore((s) => s.allTelemetry2);
  const events = useTelemetryStore((s) => s.events);
  const playerCarIndex = useTelemetryStore((s) => s.playerCarIndex);
  const selectedCarIndex = useTelemetryStore((s) => s.selectedCarIndex);
  const setSelectedCarIndex = useTelemetryStore((s) => s.setSelectedCarIndex);
  const clearEvents = useTelemetryStore((s) => s.clearEvents);
  const packetFormat = useTelemetryStore((s) => s.packetFormat);
  const connected = useTelemetryStore((s) => s.connected);

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
