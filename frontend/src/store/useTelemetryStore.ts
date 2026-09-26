import { create } from 'zustand';
import type {
  CarTelemetryData,
  LapData,
  WeatherForecastSample,
  ParticipantData,
  CarStatusData,
  CarDamageData,
  PacketHeader,
  CarTelemetry2Data,
  FeedEvent,
} from '../types/telemetry';
import { F1_DRIVER_NAMES, PACKET_IDS } from '../constants/f1';
import { useTelemetryDataStore, type TelemetryDataState } from './useTelemetryDataStore';
import { useSessionStatusStore, type SessionStatusState } from './useSessionStatusStore';
import { connectTelemetryWebSocket } from '../utils/telemetrySocket';

export { useTelemetryDataStore, useSessionStatusStore, connectTelemetryWebSocket };
export type { TelemetryDataState, SessionStatusState };

export function parseDriverName(rawName: string | undefined, defaultName: string, driverId?: number): string {
  let nameStr = '';
  if (typeof rawName === 'string') {
    const nullIdx = rawName.indexOf('\0');
    nameStr = (nullIdx !== -1 ? rawName.slice(0, nullIdx) : rawName).trim();
  }

  if (nameStr && nameStr.length > 0) {
    return nameStr;
  }

  if (driverId !== undefined && F1_DRIVER_NAMES[driverId]) {
    return F1_DRIVER_NAMES[driverId];
  }

  return defaultName;
}

export interface LiveSnapshotData {
  Header: PacketHeader;
  Session?: {
    Weather: number;
    TrackTemperature: number;
    AirTemperature: number;
    TotalLaps: number;
    TrackLength: number;
    SessionType: number;
    TrackId: number;
    SessionTimeLeft: number;
    SessionDuration: number;
    SafetyCarStatus: number;
    PitStopWindowIdealLap?: number;
    PitStopWindowLatestLap?: number;
    PitStopRejoinPosition?: number;
    NumWeatherForecastSamples?: number;
    WeatherForecastSamples?: WeatherForecastSample[];
    NumSafetyCarPeriods?: number;
    NumVirtualSafetyCarPeriods?: number;
    NumRedFlagPeriods?: number;
    GamePaused?: number;
  };
  Participants?: {
    NumActiveCars: number;
    Participants: ParticipantData[];
  };
  LapData?: {
    LapData: LapData[];
  };
  CarTelemetry?: {
    CarTelemetryData: CarTelemetryData[];
  };
  CarTelemetry2?: {
    CarTelemetry2Data: CarTelemetry2Data[];
  };
  CarStatus?: {
    CarStatusData: CarStatusData[];
  };
  CarDamage?: {
    CarDamageData: CarDamageData[];
  };
  Events?: FeedEvent[];
  ActiveCarCount?: number;
}

export interface TelemetryState {
  processIncomingMessage: (data: unknown) => void;
  resetStore: () => void;
  resetSession: () => void;
}

// Kept outside Zustand state to prevent extra subscriber triggers
let lastSessionUID: string | null = null;

export const useTelemetryStore = create<TelemetryState>((_set, get) => ({
  resetStore: () => {
    lastSessionUID = null;
    useTelemetryDataStore.getState().resetTelemetryData();
    useSessionStatusStore.getState().resetSession();
  },

  resetSession: () => {
    get().resetStore();
  },

  processIncomingMessage: (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const msg = data as { Header?: PacketHeader; [key: string]: unknown };
    if (!msg.Header) return;
    const header = msg.Header;
    // /ws only carries the server's consolidated 10Hz live snapshot; anything else is ignored.
    if (header.PacketId !== PACKET_IDS.LIVE_SNAPSHOT) return;

    // Detect session transition
    if (header.SessionUID && lastSessionUID !== null && lastSessionUID !== header.SessionUID) {
      get().resetStore();
    }
    if (header.SessionUID) {
      lastSessionUID = header.SessionUID;
    }

    const playerIdx = header.PlayerCarIndex !== undefined ? header.PlayerCarIndex : 0;
    const pktFormat = header.PacketFormat ?? null;

    const snapshot = data as LiveSnapshotData;
    const partialData: Partial<TelemetryDataState> = {
      playerCarIndex: playerIdx,
    };
    const partialStatus: Partial<SessionStatusState> = {};
    if (pktFormat !== null) partialStatus.packetFormat = pktFormat;

    // Handle Session
    if (snapshot.Session) {
      const s = snapshot.Session;
      partialStatus.session = {
        Weather: s.Weather,
        TrackTemperature: s.TrackTemperature,
        AirTemperature: s.AirTemperature,
        TotalLaps: s.TotalLaps,
        TrackLength: s.TrackLength,
        SessionType: s.SessionType,
        TrackId: s.TrackId,
        SessionTimeLeft: s.SessionTimeLeft,
        SessionDuration: s.SessionDuration,
        SafetyCarStatus: s.SafetyCarStatus,
        PitStopWindowIdealLap: s.PitStopWindowIdealLap,
        PitStopWindowLatestLap: s.PitStopWindowLatestLap,
        PitStopRejoinPosition: s.PitStopRejoinPosition,
        NumWeatherForecastSamples: s.NumWeatherForecastSamples,
        WeatherForecastSamples: s.WeatherForecastSamples?.slice(0, s.NumWeatherForecastSamples || 4),
        NumSafetyCarPeriods: s.NumSafetyCarPeriods,
        NumVirtualSafetyCarPeriods: s.NumVirtualSafetyCarPeriods,
        NumRedFlagPeriods: s.NumRedFlagPeriods,
        PacketFormat: header.PacketFormat,
        GamePaused: s.GamePaused,
        SessionUID: header.SessionUID,
      };
    }

    // Handle Participants
    if (snapshot.Participants?.Participants && snapshot.Participants.Participants.length > 0) {
      const pList = snapshot.Participants.Participants;
      let maxPopulatedIndex = -1;
      for (let i = 0; i < pList.length; i++) {
        const p = pList[i];
        const hasName = typeof p.Name === 'string' && p.Name.split('\0').join('').trim().length > 0;
        const hasNumber = p.RaceNumber !== undefined && p.RaceNumber > 0;
        const hasDriverId = p.DriverId !== undefined && p.DriverId !== 255 && p.DriverId > 0;
        if (hasName || hasNumber || hasDriverId) {
          maxPopulatedIndex = i;
        }
      }
      const validCount = Math.max(
        snapshot.ActiveCarCount || 0,
        snapshot.Participants.NumActiveCars || 0,
        maxPopulatedIndex >= 0 ? maxPopulatedIndex + 1 : 0
      );
      if (validCount > 0) {
        partialStatus.participants = pList.slice(0, validCount);
      }
    }

    // Handle LapData
    if (snapshot.LapData?.LapData) {
      partialData.allLaps = snapshot.LapData.LapData;
    }

    // Race feed rows: the server sends them ready to list (codes and parameters, no text)
    if (snapshot.Events) {
      for (const evt of snapshot.Events) {
        useSessionStatusStore.getState().addEvent(evt);
      }
    }

    if (snapshot.CarTelemetry?.CarTelemetryData) {
      partialData.allTelemetry = snapshot.CarTelemetry.CarTelemetryData;
    }
    if (snapshot.CarTelemetry2?.CarTelemetry2Data) {
      partialData.allTelemetry2 = snapshot.CarTelemetry2.CarTelemetry2Data;
    }
    if (snapshot.CarStatus?.CarStatusData) {
      partialData.allCarStatus = snapshot.CarStatus.CarStatusData;
    }
    if (snapshot.CarDamage?.CarDamageData) {
      partialData.allCarDamage = snapshot.CarDamage.CarDamageData;
    }

    useTelemetryDataStore.getState().setTelemetryData(partialData);
    useSessionStatusStore.getState().setSessionStatus(partialStatus);
  },
}));
