import { describe, it, expect, beforeEach } from 'vitest';
import { useTelemetryStore, useSessionStatusStore, useTelemetryDataStore } from './useTelemetryStore';
import { PACKET_IDS, PENALTY_TYPES } from '../constants/f1';
import {
  makeFeedEvent,
  makeForecastSample,
  makeLiveCarDamage,
  makeLiveCarStatus,
  makeLiveCarTelemetry,
  makeLiveCarTelemetry2,
  makeLiveLap,
  makeLiveParticipant,
  makeLiveSession,
  makeLiveSnapshot,
} from '../test/wireFactories';

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

  it('stores the slim snapshot rows as the server sent them', () => {
    const { PacketFormat: _format, SessionUID: _uid, ...session } = makeLiveSession({
      TrackId: 7,
      WeatherForecastSamples: [makeForecastSample({ RainPercentage: 40 })],
    });
    const laps = [makeLiveLap({ CarPosition: 2 }), makeLiveLap({ CarPosition: 1 })];
    const participants = [makeLiveParticipant({ Name: 'Driver A' }), makeLiveParticipant({ Name: 'Driver B' })];
    const status = [makeLiveCarStatus({ VisualTyreCompound: 16 }), makeLiveCarStatus()];
    const damage = [makeLiveCarDamage({ FloorDamage: 12 }), makeLiveCarDamage()];
    const telemetry = [makeLiveCarTelemetry({ Speed: 300 }), makeLiveCarTelemetry()];
    const telemetry2 = [makeLiveCarTelemetry2({ OvertakeActive: 1 }), makeLiveCarTelemetry2()];

    useTelemetryStore.getState().processIncomingMessage(
      makeLiveSnapshot(
        {
          Session: session,
          Participants: participants,
          LapData: laps,
          CarStatus: status,
          CarDamage: damage,
          CarTelemetry: telemetry,
          CarTelemetry2: telemetry2,
          ActiveCarCount: 2,
        },
        { SessionUID: SESSION_UID, PacketFormat: 2025, PlayerCarIndex: 1 }
      )
    );

    const statusState = useSessionStatusStore.getState();
    expect(statusState.session).toEqual({ ...session, PacketFormat: 2025, SessionUID: SESSION_UID });
    expect(statusState.participants).toEqual(participants);
    expect(statusState.packetFormat).toBe(2025);

    const data = useTelemetryDataStore.getState();
    expect(data.playerCarIndex).toBe(1);
    expect(data.allLaps).toEqual(laps);
    expect(data.allCarStatus).toEqual(status);
    expect(data.allCarDamage).toEqual(damage);
    expect(data.allTelemetry).toEqual(telemetry);
    expect(data.allTelemetry2).toEqual(telemetry2);
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
