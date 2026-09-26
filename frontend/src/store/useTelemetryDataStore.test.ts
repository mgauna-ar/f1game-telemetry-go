import { describe, it, expect, beforeEach } from 'vitest';
import { useTelemetryDataStore } from './useTelemetryDataStore';
import { makeLiveCarTelemetry, makeLiveLap } from '../test/wireFactories';

describe('useTelemetryDataStore', () => {
  beforeEach(() => {
    useTelemetryDataStore.getState().resetTelemetryData();
  });

  it('initializes with empty 10Hz arrays and zero indices', () => {
    const state = useTelemetryDataStore.getState();
    expect(state.allLaps).toEqual([]);
    expect(state.allCarStatus).toEqual([]);
    expect(state.allCarDamage).toEqual([]);
    expect(state.allTelemetry).toEqual([]);
    expect(state.allTelemetry2).toEqual([]);
    expect(state.playerCarIndex).toBe(0);
    expect(state.selectedCarIndex).toBe(0);
  });

  it('updates selectedCarIndex', () => {
    useTelemetryDataStore.getState().setSelectedCarIndex(4);
    expect(useTelemetryDataStore.getState().selectedCarIndex).toBe(4);
  });

  it('sets partial telemetry data', () => {
    const telemetry = makeLiveCarTelemetry({ Speed: 315 });
    useTelemetryDataStore.getState().setTelemetryData({
      playerCarIndex: 2,
      allTelemetry: [telemetry],
    });

    const state = useTelemetryDataStore.getState();
    expect(state.playerCarIndex).toBe(2);
    expect(state.allTelemetry).toEqual([telemetry]);
  });

  it('resets telemetry data cleanly', () => {
    useTelemetryDataStore.getState().setTelemetryData({
      playerCarIndex: 3,
      selectedCarIndex: 3,
      allLaps: [makeLiveLap({ CurrentLapNum: 10 })],
    });

    useTelemetryDataStore.getState().resetTelemetryData();
    const state = useTelemetryDataStore.getState();
    expect(state.playerCarIndex).toBe(0);
    expect(state.selectedCarIndex).toBe(0);
    expect(state.allLaps).toEqual([]);
  });
});
