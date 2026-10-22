import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { RADIO_LINE } from '../constants/f1';
import { useDevicePreferencesStore } from '../store/useDevicePreferencesStore';
import type { RadioAlertPayload } from '../types/telemetry';
import { useProactiveRadioCalls, type ProactiveRadio } from './useProactiveRadioCalls';

const { post, onTrigger, prepare } = vi.hoisted(() => ({
  post: vi.fn(),
  onTrigger: { current: null as ((payload: RadioAlertPayload) => void) | null },
  // Each call's catalogue words name it, and the callsign goes in front of a line the AI worded.
  prepare: vi.fn((category: string) => ({
    speech: `Max, the ${category} line.`,
    baseline: `The ${category} line.`,
    address: (line: string) => `Max, ${line}`,
  })),
}));

vi.mock('../utils/apiClient', () => ({ api: { post } }));
vi.mock('./useProactiveTelemetryRadio', () => ({
  useProactiveTelemetryRadio: ({ onTriggerAlert }: { onTriggerAlert: (payload: RadioAlertPayload) => void }) => {
    onTrigger.current = onTriggerAlert;
  },
}));
vi.mock('../utils/radioPhrases', () => ({ prepareProactiveRadioCall: prepare }));

const CALM = { rateModifier: 0, pitchModifier: 0 };

/** The call details the speech carries for the app log. */
const heard = (directiveId: string, cutIn = false) => expect.objectContaining({ directiveId, cutIn });

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

  it("says a temperature change in the device's unit", () => {
    const units = useDevicePreferencesStore.getState().units;
    useDevicePreferencesStore.getState().setUnits({ temperature: 'f' });
    try {
      const { send } = setup();
      send(call({ category: 'track_temp_up', values: { track_temp_delta_c: 7 } }));
      expect(prepare).toHaveBeenLastCalledWith(
        'track_temp_up',
        expect.objectContaining({ temperatureUnit: 'f', values: { track_temp_delta_c: 7 } })
      );
    } finally {
      useDevicePreferencesStore.getState().setUnits(units);
    }
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
    expect(speak).toHaveBeenCalledWith(
      'Max, front left at 45, ease off the exits.',
      false,
      CALM,
      14200,
      heard('directive_1_tyre_wear')
    );
  });

  it('says the catalogue line when no line comes by the deadline, with what is left of its life', async () => {
    lineAfter(null);
    const { send, speak } = setup();

    send(call());
    await vi.advanceTimersByTimeAsync(RADIO_LINE.CLIENT_DEADLINE_MS - 1);
    expect(speak).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(speak).toHaveBeenCalledWith(
      'Max, the tyre_wear line.',
      false,
      CALM,
      15000 - RADIO_LINE.CLIENT_DEADLINE_MS,
      heard('directive_1_tyre_wear')
    );
  });

  it('says the catalogue line at once when the AI fails', async () => {
    post.mockRejectedValueOnce(new Error('422 RADIO_LINE_REJECTED'));
    const { send, speak } = setup();

    send(call());
    await vi.advanceTimersByTimeAsync(0);
    expect(speak).toHaveBeenCalledWith('Max, the tyre_wear line.', false, CALM, 15000, heard('directive_1_tyre_wear'));
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
    expect(speak).toHaveBeenCalledWith(
      'Max, the tyre_puncture line.',
      true,
      CALM,
      15000,
      heard('directive_2_tyre_puncture')
    );

    await vi.advanceTimersByTimeAsync(1000);
    expect(speak).toHaveBeenLastCalledWith(
      'Max, worded tyre call.',
      false,
      CALM,
      14000,
      heard('directive_1_tyre_wear')
    );
  });

  it.each([
    ['a call the AI may not word', { wordable: false }, {}],
    ['a call made during a push-to-talk exchange', {}, { isExchangeActive: () => true }],
  ])('says %s in the catalogue words without asking the AI', async (_name, fields, radio) => {
    const { send, speak } = setup(radio);

    send(call(fields));
    await vi.advanceTimersByTimeAsync(0);
    expect(post).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith('Max, the tyre_wear line.', false, CALM, 15000, heard('directive_1_tyre_wear'));
  });

  it('says a traffic call without the callsign in front, and lets it cut in', async () => {
    const { send, speak } = setup();

    send(
      call({
        directiveId: 'directive_3_inlap_traffic_behind',
        category: 'inlap_traffic_behind',
        isCritical: true,
        wordable: false,
      })
    );
    expect(prepare).toHaveBeenLastCalledWith(
      'inlap_traffic_behind',
      expect.objectContaining({ callsign: undefined, urgent: true })
    );
    expect(speak).toHaveBeenLastCalledWith(
      'Max, the inlap_traffic_behind line.',
      true,
      CALM,
      15000,
      heard('directive_3_inlap_traffic_behind', true)
    );

    send(
      call({
        directiveId: 'directive_4_qualy_lap_result',
        category: 'qualy_lap_result',
        isCritical: true,
        wordable: false,
      })
    );
    expect(prepare).toHaveBeenLastCalledWith('qualy_lap_result', expect.objectContaining({ callsign: 'Max' }));
    expect(speak).toHaveBeenLastCalledWith(
      expect.any(String),
      true,
      CALM,
      15000,
      heard('directive_4_qualy_lap_result', false)
    );
  });

  it('says a blue flag and the car right behind without the callsign; the blue flag cuts in and outlasts push-to-talk', () => {
    const { send, speak } = setup();
    send(call({ directiveId: 'directive_8_flags_blue', category: 'flags_blue_two', isCritical: true }));
    expect(prepare).toHaveBeenLastCalledWith('flags_blue_two', expect.objectContaining({ callsign: undefined }));
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: true, keptOnPtt: true }));
    send(call({ directiveId: 'directive_9_flags_blue_clear', category: 'flags_blue_clear', isCritical: true }));
    expect(prepare).toHaveBeenLastCalledWith('flags_blue_clear', expect.objectContaining({ callsign: undefined }));
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: false, keptOnPtt: false }));
    send(call({ directiveId: 'directive_10_rival_defend', category: 'rival_defend_drs', isCritical: true }));
    expect(prepare).toHaveBeenLastCalledWith('rival_defend_drs', expect.objectContaining({ callsign: undefined }));
    // The defend call cuts routine speech as any urgent call does, but doesn't cut an urgent one.
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: false, keptOnPtt: false }));
    send(call({ directiveId: 'directive_11_flags_yellow', category: 'flags_yellow', isCritical: true }));
    expect(prepare).toHaveBeenLastCalledWith('flags_yellow', expect.objectContaining({ callsign: 'Max' }));
  });

  it('keeps a traffic call with no number through a push-to-talk press, not one with a number', () => {
    const { send, speak } = setup();
    send(call({ directiveId: 'directive_5_inlap_traffic_close', category: 'inlap_traffic_close', isCritical: true }));
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: true, keptOnPtt: true }));
    send(call({ directiveId: 'directive_6_inlap_traffic_behind', category: 'inlap_traffic_behind', isCritical: true }));
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: true, keptOnPtt: false }));
    send(call({ directiveId: 'directive_7_inlap_traffic_clear', category: 'inlap_traffic_clear', isCritical: true }));
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: false, keptOnPtt: false }));
  });

  it('says a slow or stopped car ahead in a race without the callsign, cutting in; right there outlasts push-to-talk', () => {
    const { send, speak } = setup();
    send(
      call({ directiveId: 'directive_12_race_slow_car_ahead', category: 'race_stopped_car_ahead', isCritical: true })
    );
    expect(prepare).toHaveBeenLastCalledWith(
      'race_stopped_car_ahead',
      expect.objectContaining({ callsign: undefined })
    );
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: true, keptOnPtt: false }));
    send(
      call({ directiveId: 'directive_13_race_slow_car_ahead', category: 'race_slow_car_ahead_now', isCritical: true })
    );
    expect(prepare).toHaveBeenLastCalledWith(
      'race_slow_car_ahead_now',
      expect.objectContaining({ callsign: undefined })
    );
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: true, keptOnPtt: true }));
  });

  it('says the cars coming on a slow driver without the callsign; the ones with no number outlast push-to-talk', () => {
    const { send, speak } = setup();
    send(call({ directiveId: 'directive_14_race_car_behind', category: 'race_car_behind_two', isCritical: true }));
    expect(prepare).toHaveBeenLastCalledWith('race_car_behind_two', expect.objectContaining({ callsign: undefined }));
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: true, keptOnPtt: false }));
    send(
      call({ directiveId: 'directive_15_race_car_behind_close', category: 'race_car_behind_close', isCritical: true })
    );
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: true, keptOnPtt: true }));
    send(
      call({ directiveId: 'directive_16_race_car_behind_clear', category: 'race_car_behind_clear', isCritical: true })
    );
    expect(prepare).toHaveBeenLastCalledWith('race_car_behind_clear', expect.objectContaining({ callsign: undefined }));
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: false, keptOnPtt: false }));
    send(
      call({ directiveId: 'directive_17_race_pit_exit_traffic', category: 'race_pit_exit_traffic', isCritical: true })
    );
    expect(speak.mock.calls.at(-1)?.[4]).toEqual(expect.objectContaining({ cutIn: true, keptOnPtt: true }));
  });

  it('notes when the call came and whether the page was in front', async () => {
    vi.setSystemTime(1_700_000_000_000);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      const { send, speak } = setup();
      send(call({ wordable: false }));
      await vi.advanceTimersByTimeAsync(0);
      expect(speak.mock.calls[0][4]).toEqual({
        directiveId: 'directive_1_tyre_wear',
        receivedAt: 1_700_000_000_000,
        visible: false,
        cutIn: false,
        keptOnPtt: false,
      });
    } finally {
      visibility.mockRestore();
    }
  });
});
