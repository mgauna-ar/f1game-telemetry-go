import type { RadioPersona } from '../constants/f1';
import type { LocaleCode } from '../locales';
import { radio_phrases as en } from '../locales/en/radio_phrases';
import { radio_phrases as es } from '../locales/es/radio_phrases';
import type { RadioAlertCategory, RadioPhrasePool } from '../types/telemetry';

export type { RadioAlertCategory };

/**
 * The spoken wording of every proactive radio call, per language. The engine only sends an alert
 * key; this catalog is the one place its words come from. Only the Live tab speaks them, so they
 * load with it rather than with the UI dictionaries. Both languages: the radio's language is its
 * own setting, not the UI's.
 */
export const RADIO_PHRASE_CATALOG: Record<LocaleCode, Record<RadioAlertCategory, RadioPhrasePool>> = { en, es };

/** The phrases `persona` can say for `category` in `language`, falling back to the standard pool. */
export function radioPhrasePool(
  category: RadioAlertCategory,
  language: LocaleCode,
  persona: RadioPersona
): readonly string[] {
  const catPool = RADIO_PHRASE_CATALOG[language][category];
  const personaPool = persona === 'bono' ? catPool.bono : persona === 'colapinto' ? catPool.colapinto : undefined;
  return personaPool && personaPool.length > 0 ? personaPool : catPool.standard;
}

/**
 * Returns a random phrase for a proactive radio call, in the listener's language and the
 * engineer's persona, addressed to the driver's callsign.
 */
export function getProactiveRadioSpeech(
  category: RadioAlertCategory,
  language: LocaleCode = 'es',
  persona: RadioPersona = 'bono',
  driverCallsign?: string
): string {
  const pool = radioPhrasePool(category, language, persona);
  const template = pool[Math.floor(Math.random() * pool.length)] ?? pool[0] ?? '';
  return interpolateCallsign(template, driverCallsign);
}

function interpolateCallsign(template: string, driverCallsign?: string): string {
  const callsign = driverCallsign?.trim() || '';

  if (template.includes('{driver}')) {
    if (callsign) {
      return template.replace(/{driver}/g, callsign);
    }
    // Remove {driver} with trailing or leading comma cleanly
    return template
      .replace(/,\s*{driver}/g, '')
      .replace(/{driver},\s*/g, '')
      .replace(/{driver}/g, '')
      .trim();
  }

  // If callsign is provided and template has no placeholder, prepend callsign
  if (callsign) {
    return `${callsign}, ${template}`;
  }

  return template;
}
