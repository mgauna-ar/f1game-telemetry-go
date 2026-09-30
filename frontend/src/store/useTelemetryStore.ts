import { create } from 'zustand';
import type { LiveSnapshot, PacketHeader } from '../types/telemetry';
import { F1_DRIVER_NAMES, PACKET_IDS } from '../constants/f1';
import { useTelemetryDataStore, type TelemetryDataState } from './useTelemetryDataStore';
import { useSessionStatusStore, type SessionStatusState } from './useSessionStatusStore';
import { connectTelemetryWebSocket } from '../utils/telemetrySocket';
import { mergeBestLaps } from '../utils/liveTiming';

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

export interface TelemetryState {
  processIncomingMessage: (data: unknown) => void;
  resetStore: () => void;
  resetSession: () => void;
}

// Kept outside Zustand state to prevent extra subscriber triggers
let lastSessionUID: string | null = null;
// Best laps start over when the session type or track changes, even under the same UID
let lastBestLapKey: string | null = null;

export const useTelemetryStore = create<TelemetryState>((_set, get) => ({
  resetStore: () => {
    lastSessionUID = null;
    lastBestLapKey = null;
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

    // The server sends one entry per active car and only the fields the live views read.
    const snapshot = data as LiveSnapshot;
    const partialData: Partial<TelemetryDataState> = {
      playerCarIndex: playerIdx,
    };
    const partialStatus: Partial<SessionStatusState> = {};
    if (pktFormat !== null) partialStatus.packetFormat = pktFormat;

    if (snapshot.Session) {
      partialStatus.session = {
        ...snapshot.Session,
        PacketFormat: header.PacketFormat,
        SessionUID: header.SessionUID,
      };
    }
    if (snapshot.Participants && snapshot.Participants.length > 0) {
      partialStatus.participants = snapshot.Participants;
    }
    let bestLapTimes = useTelemetryDataStore.getState().bestLapTimes;
    if (snapshot.Session) {
      const bestLapKey = `${snapshot.Session.SessionType}_${snapshot.Session.TrackId}`;
      if (bestLapKey !== lastBestLapKey) bestLapTimes = [];
      lastBestLapKey = bestLapKey;
    }
    if (snapshot.LapData) {
      partialData.allLaps = snapshot.LapData;
      bestLapTimes = mergeBestLaps(bestLapTimes, snapshot.LapData);
    }
    partialData.bestLapTimes = bestLapTimes;
    partialData.gapAheadTrend = snapshot.GapAheadTrend ?? null;
    partialData.gapBehindTrend = snapshot.GapBehindTrend ?? null;
    if (snapshot.CarTelemetry) partialData.allTelemetry = snapshot.CarTelemetry;
    if (snapshot.CarTelemetry2) partialData.allTelemetry2 = snapshot.CarTelemetry2;
    if (snapshot.CarStatus) partialData.allCarStatus = snapshot.CarStatus;
    if (snapshot.CarDamage) partialData.allCarDamage = snapshot.CarDamage;

    // Race feed rows: the server sends them ready to list (codes and parameters, no text)
    if (snapshot.Events) {
      for (const evt of snapshot.Events) {
        useSessionStatusStore.getState().addEvent(evt);
      }
    }

    useTelemetryDataStore.getState().setTelemetryData(partialData);
    useSessionStatusStore.getState().setSessionStatus(partialStatus);
  },
}));
