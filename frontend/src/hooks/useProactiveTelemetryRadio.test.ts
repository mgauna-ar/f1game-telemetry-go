import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProactiveTelemetryRadio } from './useProactiveTelemetryRadio';
import { makeEngineerDirective } from '../test/wireFactories';
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
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  const send = (directive: EngineerDirective) =>
    MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify(directive) });

  it('hands a tyre wear directive to onTriggerAlert as its phrase category', () => {
    const onTriggerAlert = vi.fn();
    renderHook(() => useProactiveTelemetryRadio({ isRadioEnabled: true, onTriggerAlert }));

    send(makeEngineerDirective({ id: 'dir-1', category: 'tyres', sub_alert: 'tyre_wear', urgency: 'low' }));

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith({
      category: 'tyre_wear',
      isCritical: false,
      emotion: { rateModifier: 0, pitchModifier: 0 },
      ttlMs: 15000,
    });
  });

  it('passes on how long the call stays worth saying', () => {
    const onTriggerAlert = vi.fn();
    renderHook(() => useProactiveTelemetryRadio({ isRadioEnabled: true, onTriggerAlert }));

    send(makeEngineerDirective({ id: 'dir-gap', sub_alert: 'rival_defend', urgency: 'medium', ttl_ms: 5000 }));

    expect(onTriggerAlert).toHaveBeenCalledWith(expect.objectContaining({ category: 'rival_defend', ttlMs: 5000 }));
  });

  it('passes on when the driver can pit', () => {
    const onTriggerAlert = vi.fn();
    renderHook(() => useProactiveTelemetryRadio({ isRadioEnabled: true, onTriggerAlert }));

    send(makeEngineerDirective({ id: 'dir-box', sub_alert: 'tyre_puncture', urgency: 'critical', box: 'next_lap' }));

    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'tyre_puncture', box: 'next_lap' })
    );
  });

  it('passes on the numbers a report says', () => {
    const onTriggerAlert = vi.fn();
    renderHook(() => useProactiveTelemetryRadio({ isRadioEnabled: true, onTriggerAlert }));

    const values = { position: 3, ahead: { gap_sec: 1.2, trend: 'closing' as const, per_lap_sec: 0.1 } };
    send(makeEngineerDirective({ id: 'dir-report', sub_alert: 'gap_report', urgency: 'low', values }));

    expect(onTriggerAlert).toHaveBeenCalledWith(expect.objectContaining({ category: 'gap_report', values }));
  });

  it.each([
    ['damage_wing', 'wing_damage'],
    ['brake_hot', 'brake_overheat'],
    ['coaching_s1', 'sector_delta'],
    ['rival_attack_override', 'rival_attack_override'],
  ] as const)('speaks the %s alert with the %s phrases', (subAlert, category) => {
    const onTriggerAlert = vi.fn();
    renderHook(() => useProactiveTelemetryRadio({ isRadioEnabled: true, onTriggerAlert }));

    send(makeEngineerDirective({ id: `dir-${subAlert}`, sub_alert: subAlert, urgency: 'medium' }));

    expect(onTriggerAlert).toHaveBeenCalledWith(expect.objectContaining({ category, isCritical: false }));
  });

  it('stays silent for an alert key this dashboard does not know yet', () => {
    const onTriggerAlert = vi.fn();
    renderHook(() => useProactiveTelemetryRadio({ isRadioEnabled: true, onTriggerAlert }));

    MockWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({ ...makeEngineerDirective({ id: 'dir-new' }), sub_alert: 'brand_new_alert' }),
    });

    expect(onTriggerAlert).not.toHaveBeenCalled();
  });

  it.each(['critical', 'high'] as const)('speaks a %s directive urgently', (urgency) => {
    const onTriggerAlert = vi.fn();
    renderHook(() => useProactiveTelemetryRadio({ isRadioEnabled: true, onTriggerAlert }));

    send(makeEngineerDirective({ id: `dir-${urgency}`, sub_alert: 'tyre_puncture', urgency }));

    expect(onTriggerAlert).toHaveBeenCalledWith({
      category: 'tyre_puncture',
      isCritical: true,
      emotion: { rateModifier: 12, pitchModifier: 5 },
      ttlMs: 15000,
    });
  });

  it('deduplicates directives with the same ID', () => {
    const onTriggerAlert = vi.fn();
    renderHook(() => useProactiveTelemetryRadio({ isRadioEnabled: true, onTriggerAlert }));

    const directive = makeEngineerDirective({ id: 'dup-1', category: 'ers', sub_alert: 'ers_low' });
    send(directive);
    send(directive);

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed and non-directive messages', () => {
    const onTriggerAlert = vi.fn();
    renderHook(() => useProactiveTelemetryRadio({ isRadioEnabled: true, onTriggerAlert }));

    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: 'invalid JSON' });
    ws.onmessage?.({ data: JSON.stringify({ type: 'heartbeat' }) });
    ws.onmessage?.({ data: JSON.stringify({ type: 'ptt_event', state: 'down' }) });

    expect(onTriggerAlert).not.toHaveBeenCalled();
  });
});
