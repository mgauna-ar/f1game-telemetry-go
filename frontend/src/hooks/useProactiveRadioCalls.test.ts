import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { RADIO_LINE } from '../constants/f1';
import type { RadioAlertPayload } from '../types/telemetry';
import { useProactiveRadioCalls, type ProactiveRadio } from './useProactiveRadioCalls';

const { post, onTrigger } = vi.hoisted(() => ({
  post: vi.fn(),
  onTrigger: { current: null as ((payload: RadioAlertPayload) => void) | null },
}));

vi.mock('../utils/apiClient', () => ({ api: { post } }));
vi.mock('./useProactiveTelemetryRadio', () => ({
  useProactiveTelemetryRadio: ({ onTriggerAlert }: { onTriggerAlert: (payload: RadioAlertPayload) => void }) => {
    onTrigger.current = onTriggerAlert;
  },
}));
// Each call's catalogue words name it, and the callsign goes in front of a line the AI worded.
vi.mock('../utils/radioPhrases', () => ({
  prepareProactiveRadioCall: (category: string) => ({
    speech: `Max, the ${category} line.`,
    baseline: `The ${category} line.`,
    address: (line: string) => `Max, ${line}`,
  }),
}));

const CALM = { rateModifier: 0, pitchModifier: 0 };

const call = (fields: Partial<RadioAlertPayload> = {}): RadioAlertPayload => ({
  directiveId: 'directive_1_tyre_wear',
  wordable: true,
  category: 'tyre_wear',
  isCritical: false,
  emotion: CALM,
  ttlMs: 15000,
  ...fields,
});

/** An AI line that comes after ms, or never; a request aborted at the deadline fails as fetch does. */
const lineAfter = (text: string | null, ms = 0) =>
  post.mockImplementationOnce(
    (_path: string, _body: unknown, signal: AbortSignal) =>
      new Promise((resolve, reject) => {
        if (text !== null) setTimeout(() => resolve({ text }), ms);
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
  );

function setup(overrides: Partial<ProactiveRadio> = {}) {
  const radio: ProactiveRadio = {
    isRadioEnabled: true,
    effectiveLanguage: 'en',
    persona: 'bono',
    driverCallsign: 'Max',
    speakMessage: vi.fn().mockResolvedValue(undefined),
    prefetchMessage: vi.fn(),
    isExchangeActive: () => false,
    ...overrides,
  };
  renderHook(() => useProactiveRadioCalls(radio));
  const send = (payload: RadioAlertPayload) => onTrigger.current?.(payload);
  return { radio, send, speak: radio.speakMessage as ReturnType<typeof vi.fn> };
}

describe('useProactiveRadioCalls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    post.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("says a wordable call in the AI's words, addressed like the catalogue line", async () => {
    lineAfter('front left at 45, ease off the exits.', 800);
    const { radio, send, speak } = setup();

    send(call());
    expect(radio.prefetchMessage).toHaveBeenCalledWith('Max, the tyre_wear line.', CALM);
    expect(post).toHaveBeenCalledWith(
      '/api/ai/radio-line',
      { directive_id: 'directive_1_tyre_wear', language: 'en', persona: 'bono', baseline: 'The tyre_wear line.' },
      expect.any(AbortSignal)
    );

    await vi.advanceTimersByTimeAsync(800);
    expect(speak).toHaveBeenCalledWith('Max, front left at 45, ease off the exits.', false, CALM, 14200);
  });

  it('says the catalogue line when no line comes by the deadline, with what is left of its life', async () => {
    lineAfter(null);
    const { send, speak } = setup();

    send(call());
    await vi.advanceTimersByTimeAsync(RADIO_LINE.CLIENT_DEADLINE_MS - 1);
    expect(speak).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(speak).toHaveBeenCalledWith('Max, the tyre_wear line.', false, CALM, 15000 - RADIO_LINE.CLIENT_DEADLINE_MS);
  });

  it('says the catalogue line at once when the AI fails', async () => {
    post.mockRejectedValueOnce(new Error('422 RADIO_LINE_REJECTED'));
    const { send, speak } = setup();

    send(call());
    await vi.advanceTimersByTimeAsync(0);
    expect(speak).toHaveBeenCalledWith('Max, the tyre_wear line.', false, CALM, 15000);
  });

  it('drops a call that went stale while it waited', async () => {
    lineAfter(null);
    const { send, speak } = setup();

    send(call({ ttlMs: 2000 }));
    await vi.advanceTimersByTimeAsync(RADIO_LINE.CLIENT_DEADLINE_MS);
    expect(speak).not.toHaveBeenCalled();
  });

  it('keeps routine calls in the order they came', async () => {
    lineAfter('worded tyre call.', 1000);
    const { send, speak } = setup();

    send(call());
    send(call({ directiveId: 'directive_2_fuel_delta', category: 'fuel_deficit', wordable: false }));
    await vi.advanceTimersByTimeAsync(0);
    expect(speak).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(speak.mock.calls.map((c) => c[0])).toEqual(['Max, worded tyre call.', 'Max, the fuel_deficit line.']);
  });

  it('says an urgent call at once in the catalogue words, ahead of a routine call being worded', async () => {
    lineAfter('worded tyre call.', 1000);
    const { send, speak } = setup();

    send(call());
    send(
      call({ directiveId: 'directive_2_tyre_puncture', category: 'tyre_puncture', isCritical: true, wordable: true })
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith('Max, the tyre_puncture line.', true, CALM, 15000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(speak).toHaveBeenLastCalledWith('Max, worded tyre call.', false, CALM, 14000);
  });

  it.each([
    ['a call the AI may not word', { wordable: false }, {}],
    ['a call made during a push-to-talk exchange', {}, { isExchangeActive: () => true }],
  ])('says %s in the catalogue words without asking the AI', async (_name, fields, radio) => {
    const { send, speak } = setup(radio);

    send(call(fields));
    await vi.advanceTimersByTimeAsync(0);
    expect(post).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith('Max, the tyre_wear line.', false, CALM, 15000);
  });
});
