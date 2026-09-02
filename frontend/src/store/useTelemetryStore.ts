import { create } from 'zustand';
import type {
  CarTelemetryData,
  LapData,
  WeatherForecastSample,
  SessionData,
  RaceEvent,
  ParticipantData,
  CarStatusData,
  CarDamageData,
  PacketHeader,
  CarTelemetry2Data,
  CarMotionData,
} from '../types/telemetry';
import {
  F1_DRIVER_NAMES,
  PACKET_IDS,
} from '../constants/f1';
import { useTelemetryDataStore, type TelemetryDataState } from './useTelemetryDataStore';
import { useSessionStatusStore, type SessionStatusState } from './useSessionStatusStore';
import { createWebSocket, type WebSocketClient } from '../utils/websocketClient';

export { useTelemetryDataStore, useSessionStatusStore };
export type { TelemetryDataState, SessionStatusState };

export function parseDriverName(rawName: string | number[] | undefined, defaultName: string, driverId?: number): string {
  let nameStr = '';
  if (typeof rawName === 'string') {
    // Go's encoding/json marshals [48]byte as base64 strings.
    if (rawName.length > 20 && /^[A-Za-z0-9+/=]+$/.test(rawName)) {
      try {
        const decoded = atob(rawName);
        const nullIdx = decoded.indexOf('\0');
        const candidate = (nullIdx !== -1 ? decoded.slice(0, nullIdx) : decoded).trim();
        if (candidate.length > 0 && /^[\x20-\x7E]+$/.test(candidate)) {
          nameStr = candidate;
        }
      } catch {
        // atob failed - fall through to raw string
      }
    }

    if (!nameStr) {
      const nullIdx = rawName.indexOf('\0');
      nameStr = (nullIdx !== -1 ? rawName.slice(0, nullIdx) : rawName).trim();
    }
  } else if (Array.isArray(rawName)) {
    const nullIdx = rawName.indexOf(0);
    const validBytes = nullIdx !== -1 ? rawName.slice(0, nullIdx) : rawName;
    nameStr = validBytes.map((c) => String.fromCharCode(c)).join('').trim();
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
  Motion?: {
    CarMotionData: CarMotionData[];
  };
  Events?: RaceEvent[];
  ActiveCarCount?: number;
}

export interface TelemetryState {
  session: SessionData | null;
  participants: ParticipantData[];
  allLaps: LapData[];
  allCarStatus: CarStatusData[];
  allCarDamage: CarDamageData[];
  allTelemetry: CarTelemetryData[];
  allTelemetry2: CarTelemetry2Data[];
  allMotion: CarMotionData[];
  events: RaceEvent[];
  playerCarIndex: number;
  selectedCarIndex: number;
  packetFormat: number | null;
  connected: boolean;

  setSelectedCarIndex: (index: number) => void;
  addEvent: (event: Omit<RaceEvent, 'id' | 'timestamp'>) => void;
  clearEvents: () => void;
  resetSession: () => void;
  setConnected: (connected: boolean) => void;
  processIncomingMessage: (data: any) => void;
}

// Internal tracking references outside Zustand state to prevent extra subscriber triggers
let lastSessionUID: string | number | null = null;
let participantsCache: ParticipantData[] = [];

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  session: null,
  participants: [],
  allLaps: [],
  allCarStatus: [],
  allCarDamage: [],
  allTelemetry: [],
  allTelemetry2: [],
  allMotion: [],
  events: [],
  playerCarIndex: 0,
  selectedCarIndex: 0,
  packetFormat: null,
  connected: false,

  setSelectedCarIndex: (index: number) => {
    useTelemetryDataStore.getState().setSelectedCarIndex(index);
    set({ selectedCarIndex: index });
  },

  addEvent: (event: Omit<RaceEvent, 'id' | 'timestamp'>) => {
    useSessionStatusStore.getState().addEvent(event);
    const newEvt: RaceEvent = {
      ...event,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      events: [newEvt, ...state.events].slice(0, 80),
    }));
  },

  clearEvents: () => {
    useSessionStatusStore.getState().clearEvents();
    set({ events: [] });
  },

  resetSession: () => {
    participantsCache = [];
    useTelemetryDataStore.getState().resetTelemetryData();
    useSessionStatusStore.getState().resetSession();
    set({
      session: null,
      participants: [],
      allLaps: [],
      allCarStatus: [],
      allCarDamage: [],
      allTelemetry: [],
      allTelemetry2: [],
      allMotion: [],
      events: [],
    });
  },

  setConnected: (connected: boolean) => {
    useSessionStatusStore.getState().setConnected(connected);
    set({ connected });
  },

  processIncomingMessage: (data: any) => {
    if (!data || !data.Header) return;
    const header = data.Header as PacketHeader;

    // Detect session transition
    if (header.SessionUID && lastSessionUID !== null && lastSessionUID !== header.SessionUID) {
      get().resetSession();
    }
    if (header.SessionUID) {
      lastSessionUID = header.SessionUID;
    }

    const playerIdx = header.PlayerCarIndex !== undefined ? header.PlayerCarIndex : 0;
    const pktFormat = header.PacketFormat ?? null;

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
          get().addEvent(evt);
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
      if (snapshot.Motion?.CarMotionData) {
        partialData.allMotion = snapshot.Motion.CarMotionData;
      }

      useTelemetryDataStore.getState().setTelemetryData(partialData);
      useSessionStatusStore.getState().setSessionStatus(partialStatus);

      set({
        ...partialData,
        ...partialStatus,
      });
      return;
    }

    // 2. Real-time Event Data Packet
    if (header.PacketId === PACKET_IDS.EVENT) {
      const code = data.EventCode;
      const vIdx = data.VehicleIdx ?? 0;
      const currentParticipants = useSessionStatusStore.getState().participants;
      const driver = participantsCache[vIdx] || currentParticipants[vIdx];
      const driverName = parseDriverName(driver?.Name, `Car #${vIdx + 1}`, driver?.DriverId);

      switch (code) {
        case 'FTLP':
          get().addEvent({
            eventCode: 'FTLP',
            type: 'fastest_lap',
            description: `${driverName} set the fastest lap (${(data.LapTime || 0).toFixed(3)}s)`,
            vehicleIdx: vIdx,
            driverName,
            lapTime: data.LapTime,
            severity: 'purple',
            sessionTime: header.SessionTime,
          });
          break;
        case 'OVTK': {
          const targetIdx = data.OtherVehicleIdx ?? 0;
          const targetDriver = participantsCache[targetIdx] || currentParticipants[targetIdx];
          const targetName = parseDriverName(targetDriver?.Name, `Car #${targetIdx + 1}`, targetDriver?.DriverId);
          get().addEvent({
            eventCode: 'OVTK',
            type: 'overtake',
            description: `${driverName} overtook ${targetName}`,
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
          const targetIdx = data.OtherVehicleIdx !== undefined && data.OtherVehicleIdx < 255 ? data.OtherVehicleIdx : undefined;
          const targetDriver = targetIdx !== undefined ? (participantsCache[targetIdx] || currentParticipants[targetIdx]) : undefined;
          const targetName = targetDriver ? parseDriverName(targetDriver?.Name, `Car #${(targetIdx ?? 0) + 1}`, targetDriver?.DriverId) : undefined;
          const isSevere = data.PenaltyType === 6 || (data.PenaltyTime !== undefined && data.PenaltyTime >= 10 && data.PenaltyTime < 255);
          get().addEvent({
            eventCode: 'PENA',
            type: 'penalty',
            description: `${driverName} received a penalty`,
            vehicleIdx: vIdx,
            driverName,
            otherVehicleIdx: targetIdx,
            targetDriverName: targetName,
            lapNum: data.LapNum,
            penaltyType: data.PenaltyType,
            infringementType: data.InfringementType,
            penaltyTime: data.PenaltyTime,
            placesGained: data.PlacesGained,
            severity: isSevere ? 'danger' : 'warning',
            sessionTime: header.SessionTime,
          });
          break;
        }
        case 'SPTP':
          get().addEvent({
            eventCode: 'SPTP',
            type: 'speed_trap',
            description: `${driverName} triggered speed trap at ${(data.Speed || 0).toFixed(1)} km/h`,
            vehicleIdx: vIdx,
            driverName,
            speed: data.Speed,
            severity: 'success',
            sessionTime: header.SessionTime,
          });
          break;
        case 'TMPT':
          get().addEvent({
            eventCode: 'TMPT',
            type: 'pit',
            description: `${driverName} entered the pit lane`,
            vehicleIdx: vIdx,
            driverName,
            severity: 'warning',
            sessionTime: header.SessionTime,
          });
          break;
        case 'RTMT':
          get().addEvent({
            eventCode: 'RTMT',
            type: 'retirement',
            description: `${driverName} retired from the session`,
            vehicleIdx: vIdx,
            driverName,
            severity: 'danger',
            sessionTime: header.SessionTime,
          });
          break;
        case 'DTSV':
          get().addEvent({
            eventCode: 'DTSV',
            type: 'penalty',
            description: `${driverName} served Drive Through penalty`,
            vehicleIdx: vIdx,
            driverName,
            severity: 'info',
            sessionTime: header.SessionTime,
          });
          break;
        case 'SGSV':
          get().addEvent({
            eventCode: 'SGSV',
            type: 'penalty',
            description: `${driverName} served Stop & Go penalty`,
            vehicleIdx: vIdx,
            driverName,
            severity: 'info',
            sessionTime: header.SessionTime,
          });
          break;
        case 'COLL': {
          const targetIdx = data.OtherVehicleIdx ?? 0;
          const targetDriver = participantsCache[targetIdx] || currentParticipants[targetIdx];
          const targetName = parseDriverName(targetDriver?.Name, `Car #${targetIdx + 1}`, targetDriver?.DriverId);
          get().addEvent({
            eventCode: 'COLL',
            type: 'penalty',
            description: `Collision between ${driverName} and ${targetName}`,
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
          get().addEvent({
            eventCode: 'RDFL',
            type: 'flag',
            description: 'Red Flag deployed!',
            severity: 'danger',
            sessionTime: header.SessionTime,
          });
          break;
        case 'SSTA':
          get().addEvent({
            eventCode: 'SSTA',
            type: 'general',
            description: 'Session Started',
            severity: 'success',
            sessionTime: header.SessionTime,
          });
          break;
        case 'SEND':
          get().addEvent({
            eventCode: 'SEND',
            type: 'general',
            description: 'Session Ended',
            severity: 'info',
            sessionTime: header.SessionTime,
          });
          break;
        case 'CHQF':
          get().addEvent({
            eventCode: 'CHQF',
            type: 'flag',
            description: 'Chequered Flag waved',
            severity: 'info',
            sessionTime: header.SessionTime,
          });
          break;
        case 'RCWN':
          get().addEvent({
            eventCode: 'RCWN',
            type: 'general',
            description: `${driverName} won the race!`,
            vehicleIdx: vIdx,
            driverName,
            severity: 'success',
            sessionTime: header.SessionTime,
          });
          break;
      }
      return;
    }

    // 3. Fallback compatibility for individual packet formats
    if (header.PacketId === PACKET_IDS.SESSION) {
      const sessionObj = {
        Weather: data.Weather,
        TrackTemperature: data.TrackTemperature,
        AirTemperature: data.AirTemperature,
        TotalLaps: data.TotalLaps,
        TrackLength: data.TrackLength,
        SessionType: data.SessionType,
        TrackId: data.TrackId,
        SessionTimeLeft: data.SessionTimeLeft,
        SessionDuration: data.SessionDuration,
        SafetyCarStatus: data.SafetyCarStatus,
        PitStopWindowIdealLap: data.PitStopWindowIdealLap,
        PitStopWindowLatestLap: data.PitStopWindowLatestLap,
        PitStopRejoinPosition: data.PitStopRejoinPosition,
        NumWeatherForecastSamples: data.NumWeatherForecastSamples,
        WeatherForecastSamples: data.WeatherForecastSamples?.slice(0, data.NumWeatherForecastSamples || 4),
        NumSafetyCarPeriods: data.NumSafetyCarPeriods,
        NumVirtualSafetyCarPeriods: data.NumVirtualSafetyCarPeriods,
        NumRedFlagPeriods: data.NumRedFlagPeriods,
        PacketFormat: header.PacketFormat,
      };
      useSessionStatusStore.getState().setSessionStatus({ session: sessionObj, packetFormat: pktFormat });
      useTelemetryDataStore.getState().setTelemetryData({ playerCarIndex: playerIdx });
      set({ session: sessionObj, playerCarIndex: playerIdx, packetFormat: pktFormat });
    } else if (header.PacketId === PACKET_IDS.PARTICIPANTS && data.Participants) {
      participantsCache = data.Participants;
      useSessionStatusStore.getState().setSessionStatus({ participants: data.Participants });
      useTelemetryDataStore.getState().setTelemetryData({ playerCarIndex: playerIdx });
      set({ participants: data.Participants, playerCarIndex: playerIdx });
    } else if (header.PacketId === PACKET_IDS.LAP_DATA && data.LapData) {
      useTelemetryDataStore.getState().setTelemetryData({ allLaps: data.LapData, playerCarIndex: playerIdx });
      set({ allLaps: data.LapData, playerCarIndex: playerIdx });
    } else if (header.PacketId === PACKET_IDS.CAR_TELEMETRY && data.CarTelemetryData) {
      useTelemetryDataStore.getState().setTelemetryData({ allTelemetry: data.CarTelemetryData, playerCarIndex: playerIdx });
      set({ allTelemetry: data.CarTelemetryData, playerCarIndex: playerIdx });
    } else if (header.PacketId === PACKET_IDS.CAR_TELEMETRY_2 && data.CarTelemetry2Data) {
      useTelemetryDataStore.getState().setTelemetryData({ allTelemetry2: data.CarTelemetry2Data, playerCarIndex: playerIdx });
      set({ allTelemetry2: data.CarTelemetry2Data, playerCarIndex: playerIdx });
    } else if (header.PacketId === PACKET_IDS.CAR_STATUS && data.CarStatusData) {
      useTelemetryDataStore.getState().setTelemetryData({ allCarStatus: data.CarStatusData, playerCarIndex: playerIdx });
      set({ allCarStatus: data.CarStatusData, playerCarIndex: playerIdx });
    } else if (header.PacketId === PACKET_IDS.CAR_DAMAGE && data.CarDamageData) {
      useTelemetryDataStore.getState().setTelemetryData({ allCarDamage: data.CarDamageData, playerCarIndex: playerIdx });
      set({ allCarDamage: data.CarDamageData, playerCarIndex: playerIdx });
    }
  },
}));

// Singleton WebSocket Manager
let activeWsClient: WebSocketClient | null = null;
let wsSubscribers = 0;

export function connectTelemetryWebSocket(wsUrl?: string): () => void {
  wsSubscribers++;

  if (!activeWsClient) {
    activeWsClient = createWebSocket(wsUrl || '/ws', {
      onConnect: () => {
        useTelemetryStore.getState().setConnected(true);
      },
      onDisconnect: () => {
        useTelemetryStore.getState().setConnected(false);
      },
      onMessage: (data) => {
        useTelemetryStore.getState().processIncomingMessage(data);
      },
    });
  }

  if (!activeWsClient.isConnected()) {
    activeWsClient.connect();
  }

  return () => {
    wsSubscribers = Math.max(0, wsSubscribers - 1);
    if (wsSubscribers === 0 && activeWsClient) {
      activeWsClient.disconnect();
      activeWsClient = null;
      useTelemetryStore.getState().setConnected(false);
    }
  };
}
