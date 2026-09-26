import { describe, it, expect, beforeEach } from 'vitest';
import { useTelemetryStore, useSessionStatusStore, useTelemetryDataStore } from './useTelemetryStore';
import { PACKET_IDS, PENALTY_TYPES } from '../constants/f1';
import { makeFeedEvent } from '../test/wireFactories';

const SESSION_UID = '0x0000000000000001';

function header(packetId: number) {
  return { PacketId: packetId, SessionTime: 42, SessionUID: SESSION_UID, PlayerCarIndex: 0, PacketFormat: 2025 };
}

function sendSnapshot(fields: Record<string, unknown>) {
  useTelemetryStore.getState().processIncomingMessage({ Header: header(PACKET_IDS.LIVE_SNAPSHOT), ...fields });
}

describe('useTelemetryStore race feed', () => {
  beforeEach(() => {
    useTelemetryStore.getState().resetStore();
  });

  it("appends the snapshot's feed rows as the server sent them", () => {
    const pitEntry = makeFeedEvent({ eventCode: 'TMPT', type: 'pit', severity: 'warning', vehicleIdx: 2, lapNum: 6 });
    const penalty = makeFeedEvent({
      eventCode: 'PENA',
      type: 'penalty',
      severity: 'warning',
      vehicleIdx: 1,
      driverName: 'Max Verstappen',
      penaltyType: PENALTY_TYPES.TIME_PENALTY,
      penaltyTime: 5,
    });
    sendSnapshot({ Events: [pitEntry, penalty] });

    const events = useSessionStatusStore.getState().events;
    expect(events).toHaveLength(2);
    // Newest first
    expect(events[0]).toMatchObject(penalty);
    expect(events[1]).toMatchObject(pitEntry);
    expect(events[1].driverName).toBeUndefined();
  });

  it('ignores messages that are not snapshots, like raw game events', () => {
    useTelemetryStore.getState().processIncomingMessage({ Header: header(PACKET_IDS.EVENT), EventCode: 'SGSV', VehicleIdx: 2 });

    expect(useSessionStatusStore.getState().events).toEqual([]);
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
