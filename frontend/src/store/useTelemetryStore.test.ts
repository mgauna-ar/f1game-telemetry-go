import { describe, it, expect, beforeEach } from 'vitest';
import { useTelemetryStore, useSessionStatusStore, useTelemetryDataStore } from './useTelemetryStore';
import { PACKET_IDS, PENALTY_TYPES } from '../constants/f1';

const SESSION_UID = '0x0000000000000001';

function header(packetId: number) {
  return { PacketId: packetId, SessionTime: 42, SessionUID: SESSION_UID, PlayerCarIndex: 0, PacketFormat: 2025 };
}

function sendSnapshotWithDrivers() {
  const names = ['Franco Colapinto', 'Max Verstappen', 'Lando Norris'];
  useTelemetryStore.getState().processIncomingMessage({
    Header: header(PACKET_IDS.LIVE_SNAPSHOT),
    Participants: {
      NumActiveCars: names.length,
      Participants: names.map((Name, i) => ({ Name, DriverId: 0, RaceNumber: i + 1 })),
    },
  });
}

function sendEvent(fields: Record<string, unknown>) {
  useTelemetryStore.getState().processIncomingMessage({ Header: header(PACKET_IDS.EVENT), ...fields });
}

describe('useTelemetryStore event messages', () => {
  beforeEach(() => {
    useTelemetryStore.getState().resetStore();
    sendSnapshotWithDrivers();
  });

  it('credits Stop & Go served to the car in VehicleIdx', () => {
    sendEvent({ EventCode: 'SGSV', VehicleIdx: 2, StopTime: 10 });

    const [evt] = useSessionStatusStore.getState().events;
    expect(evt.eventCode).toBe('SGSV');
    expect(evt.vehicleIdx).toBe(2);
    expect(evt.driverName).toBe('Lando Norris');
  });

  it('does not credit an event without VehicleIdx to car 0', () => {
    sendEvent({ EventCode: 'SGSV' });

    const [evt] = useSessionStatusStore.getState().events;
    expect(evt.eventCode).toBe('SGSV');
    expect(evt.vehicleIdx).toBeUndefined();
    expect(evt.driverName).toBeUndefined();
  });

  it('keeps session-wide events free of a driver', () => {
    sendEvent({ EventCode: 'RDFL' });

    const [evt] = useSessionStatusStore.getState().events;
    expect(evt.eventCode).toBe('RDFL');
    expect(evt.vehicleIdx).toBeUndefined();
    expect(evt.driverName).toBeUndefined();
  });

  it('resolves both cars of a penalty', () => {
    sendEvent({
      EventCode: 'PENA',
      VehicleIdx: 1,
      OtherVehicleIdx: 0,
      PenaltyType: PENALTY_TYPES.TIME_PENALTY,
      PenaltyTime: 5,
    });

    const [evt] = useSessionStatusStore.getState().events;
    expect(evt.driverName).toBe('Max Verstappen');
    expect(evt.targetDriverName).toBe('Franco Colapinto');
  });
});

describe('useTelemetryStore message formats', () => {
  beforeEach(() => {
    useTelemetryStore.getState().resetStore();
  });

  it('ignores per-packet messages the server never sends', () => {
    useTelemetryStore.getState().processIncomingMessage({
      Header: header(PACKET_IDS.CAR_TELEMETRY),
      CarTelemetryData: [{ Speed: 315 }],
    });
    useTelemetryStore.getState().processIncomingMessage({
      Header: header(PACKET_IDS.LAP_DATA),
      LapData: [{ CurrentLapNum: 3 }],
    });

    const data = useTelemetryDataStore.getState();
    expect(data.allTelemetry).toEqual([]);
    expect(data.allLaps).toEqual([]);
  });
});
