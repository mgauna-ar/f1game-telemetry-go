import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchEngineerMessage, subscribeEngineerMessages } from './engineerSocket';
import { makeEngineerDirective, makePTTMapping } from '../test/wireFactories';

class MockWS {
  static instances: MockWS[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState: number = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 1;
    MockWS.instances.push(this);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
}

describe('engineerSocket singleton', () => {
  beforeEach(() => {
    MockWS.instances = [];
    vi.stubGlobal('WebSocket', MockWS);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('connects when first subscriber registers and disconnects when all unsubscribe', () => {
    const handler1 = vi.fn();
    const unsub1 = subscribeEngineerMessages({ ptt_event: handler1 });

    expect(MockWS.instances.length).toBe(1);
    const ws = MockWS.instances[0];

    const handler2 = vi.fn();
    const unsub2 = subscribeEngineerMessages({ ptt_event: handler2 });

    // Should share the same connection without creating a second WebSocket
    expect(MockWS.instances.length).toBe(1);

    const msg = { type: 'ptt_event', state: 'down', mapping: makePTTMapping(), timestamp: 1 };
    ws.onmessage?.({ data: JSON.stringify(msg) });
    expect(handler1).toHaveBeenCalledWith(msg);
    expect(handler2).toHaveBeenCalledWith(msg);

    // Unsubscribe first
    unsub1();
    expect(ws.readyState).toBe(WebSocket.OPEN);

    // Unsubscribe second (all subscribers gone)
    unsub2();
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it('safely handles non-JSON messages without crashing subscribers', () => {
    const handler = vi.fn();
    const unsub = subscribeEngineerMessages({ directive: handler });

    const ws = MockWS.instances[MockWS.instances.length - 1];
    ws.onmessage?.({ data: 'invalid JSON string' });

    expect(handler).not.toHaveBeenCalled();
    unsub();
  });

  it('logs a subscriber exception instead of swallowing it', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('radio handler failed');
    const unsub1 = subscribeEngineerMessages({
      directive: () => {
        throw failure;
      },
    });
    const healthy = vi.fn();
    const unsub2 = subscribeEngineerMessages({ directive: healthy });

    const directive = makeEngineerDirective();
    const ws = MockWS.instances[MockWS.instances.length - 1];
    ws.onmessage?.({ data: JSON.stringify(directive) });

    expect(healthy).toHaveBeenCalledWith(directive);
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), failure);
    unsub1();
    unsub2();
  });
});

describe('dispatchEngineerMessage', () => {
  const handlers = () => ({
    directive: vi.fn(),
    ptt_event: vi.fn(),
    ptt_learned: vi.fn(),
    ptt_learn_timeout: vi.fn(),
    settings_changed: vi.fn(),
  });

  it.each([
    ['directive', makeEngineerDirective()],
    ['ptt_event', { type: 'ptt_event', state: 'up', mapping: makePTTMapping(), timestamp: 2 }],
    ['ptt_learned', { type: 'ptt_learned', mapping: makePTTMapping() }],
    ['ptt_learn_timeout', { type: 'ptt_learn_timeout' }],
    ['settings_changed', { type: 'settings_changed', section: 'engineer', source: 'tab-a', version: 3 }],
  ] as const)('routes a %s message to its handler only', (type, msg) => {
    const h = handlers();
    dispatchEngineerMessage(msg, h);

    for (const [name, fn] of Object.entries(h)) {
      if (name === type) expect(fn).toHaveBeenCalledWith(msg);
      else expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['null', null],
    ['a string', 'directive'],
    ['a number', 7],
    ['an array', [{ type: 'directive' }]],
    ['no type', { id: 'x' }],
    ['a non-string type', { type: 1 }],
    ['an unknown type', { type: 'heartbeat' }],
    ['an inherited property name', { type: 'toString' }],
  ])('drops %s', (_name, data) => {
    const h = handlers();
    dispatchEngineerMessage(data, h);
    for (const fn of Object.values(h)) expect(fn).not.toHaveBeenCalled();
  });

  it('ignores a message type with no handler', () => {
    expect(() => dispatchEngineerMessage({ type: 'ptt_learn_timeout' }, {})).not.toThrow();
  });
});
