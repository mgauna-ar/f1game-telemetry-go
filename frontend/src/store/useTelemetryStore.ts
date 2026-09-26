import { create } from 'zustand';
import type {
  CarTelemetryData,
  LapData,
  WeatherForecastSample,
  RaceEvent,
  ParticipantData,
  CarStatusData,
  CarDamageData,
  PacketHeader,
  CarTelemetry2Data,
} from '../types/telemetry';
import {
  F1_DRIVER_NAMES,
  PACKET_IDS,
  PENALTY_TYPES,
} from '../constants/f1';
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
  Events?: RaceEvent[];
  ActiveCarCount?: number;
}

export interface TelemetryState {
  processIncomingMessage: (data: unknown) => void;
  resetStore: () => void;
  resetSession: () => void;
}

// Internal tracking references outside Zustand state to prevent extra subscriber triggers
let lastSessionUID: string | number | null = null;
let participantsCache: ParticipantData[] = [];

export const useTelemetryStore = create<TelemetryState>((_set, get) => ({
  resetStore: () => {
    participantsCache = [];
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

    // Detect session transition
    if (header.SessionUID && lastSessionUID !== null && lastSessionUID !== header.SessionUID) {
      get().resetStore();
    }
    if (header.SessionUID) {
      lastSessionUID = header.SessionUID;
    }

    const playerIdx = header.PlayerCarIndex !== undefined ? header.PlayerCarIndex : 0;
    const pktFormat = header.PacketFormat ?? null;

    // /ws only carries these two message types, both sent by the server's LiveBroadcaster.
    // 1. Consolidated 10Hz Live Snapshot Packet
    if (header.PacketId === PACKET_IDS.LIVE_SNAPSHOT) {
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
          const sliced = pList.slice(0, validCount);
          participantsCache = sliced;
          partialStatus.participants = sliced;
        }
      }

      // Handle LapData
      if (snapshot.LapData?.LapData) {
        partialData.allLaps = snapshot.LapData.LapData;
      }

      // Handle Server Synthetic Events
      if (snapshot.Events && snapshot.Events.length > 0) {
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
      return;
    }

    // 2. Real-time Event Data Packet
    if (header.PacketId === PACKET_IDS.EVENT) {
      const eventData = data as {
        EventCode: string;
        VehicleIdx?: number;
        LapTime?: number;
        OtherVehicleIdx?: number;
        PenaltyType?: number;
        PenaltyTime?: number;
        InfringementType?: number;
        PlacesGained?: number;
        LapNum?: number;
        Speed?: number;
      };
      const code = eventData.EventCode;
      const currentParticipants = useSessionStatusStore.getState().participants;
      // Only events about a car carry a vehicle index; never credit the others to car 0.
      const driverAt = (idx: number | undefined): string | undefined => {
        if (idx === undefined) return undefined;
        const driver = participantsCache[idx] || currentParticipants[idx];
        return parseDriverName(driver?.Name, `Car #${idx + 1}`, driver?.DriverId);
      };
      const vIdx = eventData.VehicleIdx;
      const driverName = driverAt(vIdx);
      const driverLabel = driverName ?? 'Driver';

      switch (code) {
        case 'FTLP':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'FTLP',
            type: 'fastest_lap',
            description: `${driverLabel} set the fastest lap (${(eventData.LapTime || 0).toFixed(3)}s)`,
            vehicleIdx: vIdx,
            driverName,
            lapTime: eventData.LapTime,
            severity: 'purple',
            sessionTime: header.SessionTime,
          });
          break;
        case 'OVTK': {
          const targetIdx = eventData.OtherVehicleIdx;
          const targetName = driverAt(targetIdx);
          useSessionStatusStore.getState().addEvent({
            eventCode: 'OVTK',
            type: 'overtake',
            description: `${driverLabel} overtook ${targetName ?? 'Car'}`,
            vehicleIdx: vIdx,
            driverName,
            otherVehicleIdx: targetIdx,
            targetDriverName: targetName,
            severity: 'info',
            sessionTime: header.SessionTime,
          });
          break;
        }
        case 'PENA': {
          const targetIdx = eventData.OtherVehicleIdx !== undefined && eventData.OtherVehicleIdx < 255 ? eventData.OtherVehicleIdx : undefined;
          const targetName = driverAt(targetIdx);
          const isSevere = eventData.PenaltyType === PENALTY_TYPES.DISQUALIFIED || (eventData.PenaltyTime !== undefined && eventData.PenaltyTime >= 10 && eventData.PenaltyTime < 255);
          useSessionStatusStore.getState().addEvent({
            eventCode: 'PENA',
            type: 'penalty',
            description: `${driverLabel} received a penalty`,
            vehicleIdx: vIdx,
            driverName,
            otherVehicleIdx: targetIdx,
            targetDriverName: targetName,
            lapNum: eventData.LapNum,
            penaltyType: eventData.PenaltyType,
            infringementType: eventData.InfringementType,
            penaltyTime: eventData.PenaltyTime,
            placesGained: eventData.PlacesGained,
            severity: isSevere ? 'danger' : 'warning',
            sessionTime: header.SessionTime,
          });
          break;
        }
        case 'SPTP':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'SPTP',
            type: 'speed_trap',
            description: `${driverLabel} triggered speed trap at ${(eventData.Speed || 0).toFixed(1)} km/h`,
            vehicleIdx: vIdx,
            driverName,
            speed: eventData.Speed,
            severity: 'success',
            sessionTime: header.SessionTime,
          });
          break;
        case 'RTMT':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'RTMT',
            type: 'retirement',
            description: `${driverLabel} retired from the session`,
            vehicleIdx: vIdx,
            driverName,
            severity: 'danger',
            sessionTime: header.SessionTime,
          });
          break;
        case 'DTSV':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'DTSV',
            type: 'penalty',
            description: `${driverLabel} served Drive Through penalty`,
            vehicleIdx: vIdx,
            driverName,
            severity: 'info',
            sessionTime: header.SessionTime,
          });
          break;
        case 'SGSV':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'SGSV',
            type: 'penalty',
            description: `${driverLabel} served Stop & Go penalty`,
            vehicleIdx: vIdx,
            driverName,
            severity: 'info',
            sessionTime: header.SessionTime,
          });
          break;
        case 'COLL': {
          const targetIdx = eventData.OtherVehicleIdx;
          const targetName = driverAt(targetIdx);
          useSessionStatusStore.getState().addEvent({
            eventCode: 'COLL',
            type: 'penalty',
            description: `Collision between ${driverLabel} and ${targetName ?? 'Car'}`,
            vehicleIdx: vIdx,
            driverName,
            otherVehicleIdx: targetIdx,
            targetDriverName: targetName,
            severity: 'danger',
            sessionTime: header.SessionTime,
          });
          break;
        }
        case 'RDFL':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'RDFL',
            type: 'flag',
            description: 'Red Flag deployed!',
            severity: 'danger',
            sessionTime: header.SessionTime,
          });
          break;
        case 'SSTA':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'SSTA',
            type: 'general',
            description: 'Session Started',
            severity: 'info',
            sessionTime: header.SessionTime,
          });
          break;
        case 'CHQF':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'CHQF',
            type: 'flag',
            description: 'Chequered Flag waved',
            severity: 'info',
            sessionTime: header.SessionTime,
          });
          break;
        case 'RCWN':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'RCWN',
            type: 'general',
            description: `${driverLabel} won the race!`,
            vehicleIdx: vIdx,
            driverName,
            severity: 'success',
            sessionTime: header.SessionTime,
          });
          break;
        case 'FLG_':
          break;
        case 'STLG':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'STLG',
            type: 'general',
            description: 'Start lights countdown active',
            severity: 'warning',
            sessionTime: header.SessionTime,
          });
          break;
        case 'LGOT':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'LGOT',
            type: 'general',
            description: 'LIGHTS OUT AND AWAY WE GO!',
            severity: 'success',
            sessionTime: header.SessionTime,
          });
          break;
        case 'SEND':
          useSessionStatusStore.getState().addEvent({
            eventCode: 'SEND',
            type: 'general',
            description: 'Chequered flag — Session complete',
            severity: 'purple',
            sessionTime: header.SessionTime,
          });
          break;
      }
    }
  },
}));
