import { useEffect, useRef } from 'react';
import type { RadioAlertPayload, RadioEmotion } from '../types/telemetry';
import { subscribeEngineerMessages } from '../utils/engineerSocket';
import { RADIO_ALERT_CATEGORIES } from '../constants/radioAlertCategories';

export interface UseProactiveTelemetryRadioOptions {
  isRadioEnabled?: boolean;
  enabled?: boolean; // backwards compatibility alias
  onTriggerAlert: (payload: RadioAlertPayload) => void;
}

const CRITICAL_EMOTION: RadioEmotion = { rateModifier: 12, pitchModifier: 5 };
const CALM_EMOTION: RadioEmotion = { rateModifier: 0, pitchModifier: 0 };

/**
 * Subscribes to the proactive pit wall directives generated server-side by Go's EngineerEngine
 * and hands each one to the radio as the phrase category to speak. The directive carries only
 * its alert key; the words come from the phrase catalog.
 */
export function useProactiveTelemetryRadio({
  isRadioEnabled = true,
  enabled = true,
  onTriggerAlert,
}: UseProactiveTelemetryRadioOptions): void {
  const active = isRadioEnabled && enabled;
  const lastDirectiveIdRef = useRef<string>('');
  const onTriggerAlertRef = useRef(onTriggerAlert);
  onTriggerAlertRef.current = onTriggerAlert;

  useEffect(() => {
    if (!active) return;

    return subscribeEngineerMessages({
      directive: (directive) => {
        if (!directive.id || directive.id === lastDirectiveIdRef.current) return;
        // A key a newer server added and this dashboard doesn't know has nothing to say yet.
        const category = RADIO_ALERT_CATEGORIES[directive.sub_alert];
        if (!category) return;

        lastDirectiveIdRef.current = directive.id;

        const isCritical = directive.urgency === 'critical' || directive.urgency === 'high';
        onTriggerAlertRef.current({
          category,
          isCritical,
          emotion: isCritical ? CRITICAL_EMOTION : CALM_EMOTION,
        });
      },
    });
  }, [active]);
}
