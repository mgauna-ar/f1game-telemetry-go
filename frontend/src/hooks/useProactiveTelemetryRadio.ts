import { useEffect, useRef } from 'react';
import type {
  EngineerDirective,
  EngineerSocketMessage,
  RadioAlertCategory,
  RadioAlertPayload,
} from '../types/telemetry';
import { subscribeEngineerWebSocket } from '../utils/engineerSocket';
import radioAlertCategories from '../constants/radioAlertCategories.json';

export interface UseProactiveTelemetryRadioOptions {
  isRadioEnabled?: boolean;
  enabled?: boolean; // backwards compatibility alias
  onTriggerAlert: (
    payload: RadioAlertPayload | string,
    isCritical?: boolean,
    emotion?: { rateModifier?: number; pitchModifier?: number }
  ) => void;
  // Legacy props gracefully ignored (now handled server-side in Go backend)
  [key: string]: unknown;
}

/**
 * Radio phrase category for each directive sub_alert. null reads out the engine's own message.
 * internal/engineer/alert_categories_test.go fails when the engine emits a key this map lacks.
 */
const ALERT_CATEGORIES: Readonly<Record<string, RadioAlertCategory | null>> = radioAlertCategories as Record<
  string,
  RadioAlertCategory | null
>;

/**
 * High-performance hook that subscribes to proactive pit wall intelligence directives
 * generated server-side by Go's EngineerEngine and dispatches them to the Neural TTS radio system.
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

    return subscribeEngineerWebSocket((data) => {
      try {
        const msg = data as EngineerSocketMessage | null;
        if (!msg || msg.type !== 'directive' || !msg.id || msg.id === lastDirectiveIdRef.current) {
          return;
        }
        // The server sends category and urgency as plain strings; a value this dashboard doesn't
        // know gets the generic 'directive' handling below.
        const directive = msg as EngineerDirective;

        lastDirectiveIdRef.current = directive.id;

        const isCritical = directive.urgency === 'critical' || directive.urgency === 'high';
        const emotion = isCritical
          ? { rateModifier: 12, pitchModifier: 5 }
          : { rateModifier: 0, pitchModifier: 0 };

        const subKey = directive.sub_alert || directive.category;
        const alertCat: RadioAlertCategory = ALERT_CATEGORIES[subKey] ?? 'directive';

        onTriggerAlertRef.current(
          {
            category: alertCat,
            isCritical,
            alertKey: subKey,
            subsystem: directive.category,
            message: `${directive.title} — ${directive.message}`,
            emotion,
            metadata: directive.metadata,
          },
          isCritical,
          emotion
        );
      } catch {
        // Silently ignore directive processing failure
      }
    });
  }, [active]);
}
