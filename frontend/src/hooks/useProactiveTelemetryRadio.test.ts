import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProactiveTelemetryRadio } from './useProactiveTelemetryRadio';
import type { EngineerDirective } from '../types/telemetry';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.OPEN;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn(() => {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  });
  send = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

describe('useProactiveTelemetryRadio WebSocket hook', () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
    vi.clearAllMocks();
  });

  afterEach(() => {
    (globalThis as any).WebSocket = originalWebSocket;
  });

  it('connects to /ws/engineer when radio is enabled', () => {
    const onTriggerAlert = vi.fn();

    renderHook(() =>
      useProactiveTelemetryRadio({
        isRadioEnabled: true,
        onTriggerAlert,
      })
    );

    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toContain('/ws/engineer');
  });

  it('does not connect when radio is disabled', () => {
    const onTriggerAlert = vi.fn();

    renderHook(() =>
      useProactiveTelemetryRadio({
        isRadioEnabled: false,
        onTriggerAlert,
      })
    );

    expect(MockWebSocket.instances.length).toBe(0);
  });

  it('closes WebSocket connection when unmounted', () => {
    const onTriggerAlert = vi.fn();

    const { unmount } = renderHook(() =>
      useProactiveTelemetryRadio({
        isRadioEnabled: true,
        onTriggerAlert,
      })
    );

    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];

    unmount();
    expect(ws.close).toHaveBeenCalledTimes(1);
  });

  it('dispatches incoming tyre wear directive to onTriggerAlert', () => {
    const onTriggerAlert = vi.fn();

    renderHook(() =>
      useProactiveTelemetryRadio({
        isRadioEnabled: true,
        onTriggerAlert,
      })
    );

    const ws = MockWebSocket.instances[0];
    const directive: EngineerDirective = {
      id: 'dir-1',
      type: 'directive',
      category: 'tyres',
      sub_alert: 'tyre_wear',
      title: 'Tyre Wear Alert',
      message: 'Tyre wear reached 42% (stint age: 12 laps).',
      urgency: 'low',
      timestamp: Date.now(),
      car_index: 0,
      session_time: 120.5,
      metadata: { wear_pct: 42, tyre_age: 12 },
    };

    ws.onmessage?.({ data: JSON.stringify(directive) });

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      {
        category: 'tyre_wear',
        isCritical: false,
        alertKey: 'tyre_wear',
        subsystem: 'tyres',
        message: 'Tyre Wear Alert — Tyre wear reached 42% (stint age: 12 laps).',
        emotion: { rateModifier: 0, pitchModifier: 0 },
        metadata: { wear_pct: 42, tyre_age: 12 },
      },
      false,
      { rateModifier: 0, pitchModifier: 0 }
    );
  });

  it('dispatches critical puncture directive with elevated urgency and voice emotion', () => {
    const onTriggerAlert = vi.fn();

    renderHook(() =>
      useProactiveTelemetryRadio({
        isRadioEnabled: true,
        onTriggerAlert,
      })
    );

    const ws = MockWebSocket.instances[0];
    const directive: EngineerDirective = {
      id: 'dir-2',
      type: 'directive',
      category: 'tyres',
      sub_alert: 'tyre_puncture',
      title: 'Critical Tyre Puncture',
      message: 'Critical tyre puncture / tyre failure on car! Wear is at 96%. Order driver to box immediately.',
      urgency: 'critical',
      timestamp: Date.now(),
      car_index: 0,
      session_time: 140.2,
    };

    ws.onmessage?.({ data: JSON.stringify(directive) });

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'tyre_puncture',
        isCritical: true,
        alertKey: 'tyre_puncture',
        emotion: { rateModifier: 12, pitchModifier: 5 },
      }),
      true,
      { rateModifier: 12, pitchModifier: 5 }
    );
  });

  it('dispatches Full Safety Car and VSC flags directives', () => {
    const onTriggerAlert = vi.fn();

    renderHook(() =>
      useProactiveTelemetryRadio({
        isRadioEnabled: true,
        onTriggerAlert,
      })
    );

    const ws = MockWebSocket.instances[0];
    const scDirective: EngineerDirective = {
      id: 'dir-sc',
      type: 'directive',
      category: 'flags',
      sub_alert: 'safety_car',
      title: 'Safety Car Deployed',
      message: 'Full Safety Car deployed! Maintain delta positive, stand by for pit stop window.',
      urgency: 'critical',
      timestamp: Date.now(),
      car_index: 0,
      session_time: 200.0,
    };

    ws.onmessage?.({ data: JSON.stringify(scDirective) });

    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'safety_car',
        isCritical: true,
        alertKey: 'safety_car',
      }),
      true,
      expect.any(Object)
    );
  });

  it('deduplicates directives with the same ID', () => {
    const onTriggerAlert = vi.fn();

    renderHook(() =>
      useProactiveTelemetryRadio({
        isRadioEnabled: true,
        onTriggerAlert,
      })
    );

    const ws = MockWebSocket.instances[0];
    const directive: EngineerDirective = {
      id: 'dup-1',
      type: 'directive',
      category: 'ers',
      sub_alert: 'ers_low',
      title: 'Low ERS Reserve',
      message: 'ERS battery reserve is low at 10%!',
      urgency: 'low',
      timestamp: Date.now(),
      car_index: 0,
      session_time: 300.0,
    };

    // Send twice with same ID
    ws.onmessage?.({ data: JSON.stringify(directive) });
    ws.onmessage?.({ data: JSON.stringify(directive) });

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed messages safely', () => {
    const onTriggerAlert = vi.fn();

    renderHook(() =>
      useProactiveTelemetryRadio({
        isRadioEnabled: true,
        onTriggerAlert,
      })
    );

    const ws = MockWebSocket.instances[0];

    // Non-JSON string
    ws.onmessage?.({ data: 'invalid JSON' });
    // Non-directive type
    ws.onmessage?.({ data: JSON.stringify({ type: 'heartbeat' }) });

    expect(onTriggerAlert).not.toHaveBeenCalled();
  });
});
