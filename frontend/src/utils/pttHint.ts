import { RADIO_ALERT_CONSTANTS } from '../constants/f1';
import type { GamepadMapping, GlobalPTTMapping } from '../hooks/usePTTConfig';

export interface PttControls {
  mappedKey?: string;
  mappedGamepadButton?: GamepadMapping | null;
  globalMapping?: GlobalPTTMapping | null;
}

export interface PttHint {
  /** Short label of the push-to-talk control for a key chip, or null when none is set up. */
  badge: string | null;
  /** The instruction to show next to it. */
  text: string;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

const getMappedButtonIndex = ({ globalMapping, mappedGamepadButton }: PttControls): number | null => {
  // The native wheel mapping works while the game has focus, so it wins over the browser gamepad one
  if (globalMapping && globalMapping.device_type !== 'none' && globalMapping.button_index !== undefined) {
    return globalMapping.button_index;
  }
  return mappedGamepadButton ? mappedGamepadButton.buttonIndex : null;
};

/** Describes how the driver talks to the pit wall: the key or button to hold, or that none is set up. */
export function getPttHint(controls: PttControls, t: Translate): PttHint {
  const { mappedKey, globalMapping } = controls;

  if (mappedKey && mappedKey !== RADIO_ALERT_CONSTANTS.DEFAULT_KEYBOARD_KEY) {
    return { badge: mappedKey, text: t('ai_engineer.radio.pttHint', { key: mappedKey }) };
  }
  if (globalMapping?.device_type === 'keyboard' && globalMapping.key_name) {
    return { badge: globalMapping.key_name, text: t('ai_engineer.radio.pttHint', { key: globalMapping.key_name }) };
  }

  const buttonIndex = getMappedButtonIndex(controls);
  if (buttonIndex !== null) {
    const buttonNumber = buttonIndex + 1;
    return {
      badge: `B${buttonNumber}`,
      text: t('ai_engineer.radio.pttHintButton', {
        button: t('ai_engineer.radio.buttonNumber', { number: buttonNumber }),
      }),
    };
  }

  return { badge: null, text: t('ai_engineer.radio.pttNotSet') };
}
