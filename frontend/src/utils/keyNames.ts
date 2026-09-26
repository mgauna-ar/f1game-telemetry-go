import { RADIO_ALERT_CONSTANTS } from '../constants/f1';

// KeyboardEvent.code prefixes of letter and digit keys ("KeyQ", "Digit1").
const LETTER_OR_DIGIT_CODE = /^(?:key([a-z])|digit([0-9]))$/;
const SPACE_KEY_NAME = 'space';
const SPACEBAR_KEY_NAME = 'spacebar';

/**
 * Makes key names comparable, ignoring case, spaces and the "Key"/"Digit" code prefixes, so the
 * server's "Caps Lock", the browser's "CapsLock" and a stored "CAPSLOCK" are the same key.
 */
export function normalizeKeyName(name: string): string {
  // KeyboardEvent.key for the space bar is " "
  if (name !== '' && name.trim() === '') return SPACE_KEY_NAME;
  const normalized = name.replace(/\s+/g, '').toLowerCase();
  if (normalized === SPACEBAR_KEY_NAME) return SPACE_KEY_NAME;
  const letterOrDigit = LETTER_OR_DIGIT_CODE.exec(normalized);
  return letterOrDigit ? (letterOrDigit[1] ?? letterOrDigit[2]) : normalized;
}

/** Whether a keyboard event is for the push-to-talk key, whichever naming the key was saved with. */
export function isKeyboardEventForKey(mappedKey: string, event: Pick<KeyboardEvent, 'code' | 'key'>): boolean {
  if (!mappedKey || mappedKey === RADIO_ALERT_CONSTANTS.DEFAULT_KEYBOARD_KEY) return false;
  const target = normalizeKeyName(mappedKey);
  return normalizeKeyName(event.code) === target || normalizeKeyName(event.key) === target;
}
