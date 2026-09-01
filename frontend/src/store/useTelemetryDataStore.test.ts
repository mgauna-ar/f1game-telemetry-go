import { describe, it, expect, beforeEach } from 'vitest';
import { useTelemetryDataStore } from './useTelemetryDataStore';

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
    expect(state.allMotion).toEqual([]);
    expect(state.playerCarIndex).toBe(0);
    expect(state.selectedCarIndex).toBe(0);
  });

  it('updates selectedCarIndex', () => {
    useTelemetryDataStore.getState().setSelectedCarIndex(4);
    expect(useTelemetryDataStore.getState().selectedCarIndex).toBe(4);
  });

  it('sets partial telemetry data', () => {
    useTelemetryDataStore.getState().setTelemetryData({
      playerCarIndex: 2,
      allTelemetry: [{ Speed: 315 } as any],
    });

    const state = useTelemetryDataStore.getState();
    expect(state.playerCarIndex).toBe(2);
    expect(state.allTelemetry).toEqual([{ Speed: 315 }]);
  });

  it('resets telemetry data cleanly', () => {
    useTelemetryDataStore.getState().setTelemetryData({
      playerCarIndex: 3,
      selectedCarIndex: 3,
      allLaps: [{ CurrentLapNum: 10 } as any],
    });

    useTelemetryDataStore.getState().resetTelemetryData();
    const state = useTelemetryDataStore.getState();
    expect(state.playerCarIndex).toBe(0);
    expect(state.selectedCarIndex).toBe(0);
    expect(state.allLaps).toEqual([]);
  });
});
