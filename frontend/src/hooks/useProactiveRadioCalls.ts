import { useCallback, useRef } from 'react';
import { RADIO_LINE } from '../constants/f1';
import {
  NO_CALLSIGN_CATEGORIES,
  TRAFFIC_CUT_IN_CATEGORIES,
  TRAFFIC_KEPT_ON_PTT_CATEGORIES,
} from '../constants/radioAlertCategories';
import type { RadioLineRequest, RadioLineResponse } from '../types/ai';
import type { RadioAlertPayload } from '../types/telemetry';
import { useDevicePreferencesStore } from '../store/useDevicePreferencesStore';
import { api } from '../utils/apiClient';
import { prepareProactiveRadioCall } from '../utils/radioPhrases';
import type { SpokenCall } from '../utils/radioHeardReport';
import { useProactiveTelemetryRadio } from './useProactiveTelemetryRadio';
import type { UseRadioControllerReturn } from './useRadioController';

/** What the pit wall's calls need from the radio. */
export type ProactiveRadio = Pick<
  UseRadioControllerReturn,
  | 'isRadioEnabled'
  | 'effectiveLanguage'
  | 'persona'
  | 'driverCallsign'
  | 'speakMessage'
  | 'prefetchMessage'
  | 'isExchangeActive'
>;

/** Asks the AI for a call in fresh words; null when no line comes within deadlineMs or it can't be said. */
async function wordRadioLine(body: RadioLineRequest, deadlineMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const res = await api.post<RadioLineResponse>('/api/ai/radio-line', body, controller.signal);
    return res.text?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Says the pit wall's proactive calls. An urgent call is said at once, in the catalogue's words. A
 * routine call the engine marked wordable is worded afresh by the AI first: it waits up to
 * RADIO_LINE.CLIENT_DEADLINE_MS for the line, while its catalogue words are synthesized so they
 * start at once if no line comes. A call made during a push-to-talk exchange keeps the catalogue's
 * words. Routine calls are said in the order they came, each with its useful life cut by the wait.
 */
export function useProactiveRadioCalls(radio: ProactiveRadio): void {
  const radioRef = useRef(radio);
  radioRef.current = radio;
  // The routine calls waiting to be said, in order.
  const routineRef = useRef<Promise<void>>(Promise.resolve());

  const onCall = useCallback((payload: RadioAlertPayload) => {
    const r = radioRef.current;
    const call = prepareProactiveRadioCall(payload.category, {
      language: r.effectiveLanguage,
      persona: r.persona,
      // A traffic call, a blue flag or the car right behind starts with the warning, not the driver's name.
      callsign: NO_CALLSIGN_CATEGORIES.has(payload.category) ? undefined : r.driverCallsign,
      box: payload.box,
      values: payload.values,
      urgent: payload.isCritical,
      temperatureUnit: useDevicePreferencesStore.getState().units.temperature,
    });
    if (!call) return;

    const madeAt = Date.now();
    const spoken: SpokenCall = {
      directiveId: payload.directiveId,
      receivedAt: madeAt,
      visible: typeof document === 'undefined' || document.visibilityState === 'visible',
      cutIn: payload.isCritical && TRAFFIC_CUT_IN_CATEGORIES.has(payload.category),
      keptOnPtt: payload.isCritical && TRAFFIC_KEPT_ON_PTT_CATEGORIES.has(payload.category),
    };
    const say = (text: string) => {
      const ttlMs = payload.ttlMs === undefined ? undefined : payload.ttlMs - (Date.now() - madeAt);
      if (ttlMs !== undefined && ttlMs <= 0) return;
      void radioRef.current.speakMessage(text, payload.isCritical, payload.emotion, ttlMs, spoken);
    };
    if (payload.isCritical) {
      say(call.speech);
      return;
    }

    let line: Promise<string> = Promise.resolve(call.speech);
    if (payload.wordable && !r.isExchangeActive()) {
      r.prefetchMessage(call.speech, payload.emotion);
      line = wordRadioLine(
        {
          directive_id: payload.directiveId,
          language: r.effectiveLanguage,
          persona: r.persona,
          baseline: call.baseline,
        },
        RADIO_LINE.CLIENT_DEADLINE_MS
      ).then((text) => (text ? call.address(text) : call.speech));
    }
    routineRef.current = routineRef.current.then(() => line).then(say);
  }, []);

  useProactiveTelemetryRadio({ isRadioEnabled: radio.isRadioEnabled, onTriggerAlert: onCall });
}
