import { useEffect, useRef } from 'react';
import type { EngineerDirective, RadioAlertCategory, RadioAlertPayload } from '../types/telemetry';
import { subscribeEngineerWebSocket } from '../utils/engineerSocket';

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

const CATEGORY_MAP: Record<string, RadioAlertCategory> = {
  safety_car: 'safety_car',
  vsc: 'vsc',
  red_flag: 'red_flag',
  tyre_puncture: 'tyre_puncture',
  tyre_wear: 'tyre_wear',
  tyre_overheat: 'tyre_overheat',
  tyre_cold: 'tyre_cold',
  wing_damage: 'wing_damage',
  floor_damage: 'floor_damage',
  engine_wear: 'engine_wear',
  mechanical_fault: 'mechanical_fault',
  ers_fault: 'ers_fault',
  aero_fault: 'aero_fault',
  ers_low: 'ers_low',
  radiator_overheat: 'radiator_overheat',
  brake_overheat: 'brake_overheat',
  brake_cold: 'brake_cold',
  fuel_deficit: 'fuel_deficit',
  undercut_window: 'undercut_window',
  undercut: 'undercut_window',
  pit_clean_air: 'pit_clean_air',
  pit_window_open: 'pit_window_open',
  pit_window: 'pit_window_open',
  rival_defend: 'rival_defend',
  rival_attack: 'rival_attack',
  sector_delta: 'sector_delta',
  teammate_ahead: 'teammate_ahead',
  teammate_proximity: 'teammate_ahead',
  teammate_pitting: 'teammate_pitting',
  qualy_traffic: 'qualy_traffic',
  qualy_clean_air: 'qualy_clean_air',
  qualy_deleted_lap: 'qualy_deleted_lap',
  qualy_invalid: 'qualy_deleted_lap',
  qualy_session_time: 'qualy_session_time',
  qualy_time: 'qualy_session_time',
  qualy_elimination_danger: 'qualy_elimination_danger',
  qualy_elim: 'qualy_elimination_danger',
  track_limits_warnings: 'track_limits_warnings',
  track_limits: 'track_limits_warnings',
  penalties_incurred: 'penalties_incurred',
  penalties: 'penalties_incurred',
  weather_rain: 'weather_rain',
  flags_rain: 'weather_rain',
  flags_sc: 'safety_car',
  flags_red: 'red_flag',
  race_finish: 'race_finish',
  inlap_traffic_behind: 'inlap_traffic_behind',
  inlap_cooldown: 'inlap_cooldown',
  flags_rain_live: 'flags_rain_live',
  tyre_crossover: 'tyre_crossover',
  flags_sc_in: 'flags_sc_in',
  safety_car_in: 'flags_sc_in',
  flags_green: 'flags_green',
  green_flag: 'flags_green',
  flags_blue: 'flags_blue',
  blue_flag: 'flags_blue',
  flags_yellow: 'flags_yellow',
  yellow_flag: 'flags_yellow',
  pit_window_close: 'pit_window_close',
  teammate_doublestack: 'teammate_doublestack',
  damage_aero_fault: 'aero_fault',
  damage_ers_fault: 'ers_fault',
  rival_defend_override: 'rival_defend_override',
  rival_attack_override: 'rival_attack_override',
};

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
        const directive = data as EngineerDirective;
        if (!directive || directive.type !== 'directive' || !directive.id || directive.id === lastDirectiveIdRef.current) {
          return;
        }

        lastDirectiveIdRef.current = directive.id;

        const isCritical = directive.urgency === 'critical' || directive.urgency === 'high';
        const emotion = isCritical
          ? { rateModifier: 12, pitchModifier: 5 }
          : { rateModifier: 0, pitchModifier: 0 };

        const subKey = directive.sub_alert || directive.category;
        const alertCat: RadioAlertCategory = CATEGORY_MAP[subKey] || 'directive';

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
