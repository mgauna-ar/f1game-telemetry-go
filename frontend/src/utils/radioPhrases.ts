import type { RadioPersona } from '../constants/f1';
import type { LocaleCode } from '../locales';
import { box_timing_phrases as enBox, radio_phrases as en } from '../locales/en/radio_phrases';
import { box_timing_phrases as esBox, radio_phrases as es } from '../locales/es/radio_phrases';
import type { BoxCallKind, EngineerBoxTiming, RadioAlertCategory, RadioPhrasePool } from '../types/telemetry';

export type { RadioAlertCategory };

/**
 * The spoken wording of every proactive radio call, per language. The engine only sends an alert
 * key; this catalog is the one place its words come from. Only the Live tab speaks them, so they
 * load with it rather than with the UI dictionaries. Both languages: the radio's language is its
 * own setting, not the UI's.
 */
export const RADIO_PHRASE_CATALOG: Record<LocaleCode, Record<RadioAlertCategory, RadioPhrasePool>> = { en, es };

/** What is said after a call to pit about when to, per language. */
export const BOX_TIMING_PHRASES: Record<LocaleCode, Record<BoxCallKind, Record<EngineerBoxTiming, RadioPhrasePool>>> = {
  en: enBox,
  es: esBox,
};

/**
 * The calls that offer a stop rather than order one; every other call that comes with a box timing
 * tells the driver to box. Their phrases leave the timing out: it is added from BOX_TIMING_PHRASES.
 */
const BOX_OPTION_CATEGORIES: ReadonlySet<RadioAlertCategory> = new Set<RadioAlertCategory>([
  'safety_car',
  'vsc',
  'pit_window_open',
  'pit_clean_air',
]);

/** The phrases `persona` can say for `category` in `language`, falling back to the standard pool. */
export function radioPhrasePool(
  category: RadioAlertCategory,
  language: LocaleCode,
  persona: RadioPersona
): readonly string[] {
  return personaPhrases(RADIO_PHRASE_CATALOG[language][category], persona);
}

function personaPhrases(catPool: RadioPhrasePool, persona: RadioPersona): readonly string[] {
  const personaPool = persona === 'bono' ? catPool.bono : persona === 'colapinto' ? catPool.colapinto : undefined;
  return personaPool && personaPool.length > 0 ? personaPool : catPool.standard;
}

const pick = (pool: readonly string[]): string => pool[Math.floor(Math.random() * pool.length)] ?? pool[0] ?? '';

/** What `persona` says about when to pit, after a call of `category` with this box timing. */
export function boxTimingPhrase(
  category: RadioAlertCategory,
  box: EngineerBoxTiming,
  language: LocaleCode,
  persona: RadioPersona
): string {
  const kind: BoxCallKind = BOX_OPTION_CATEGORIES.has(category) ? 'option' : 'instruction';
  return pick(personaPhrases(BOX_TIMING_PHRASES[language][kind][box], persona));
}

/**
 * Returns a random phrase for a proactive radio call, in the listener's language and the
 * engineer's persona, addressed to the driver's callsign. A call to pit ends with when to (`box`).
 */
export function getProactiveRadioSpeech(
  category: RadioAlertCategory,
  language: LocaleCode = 'es',
  persona: RadioPersona = 'bono',
  driverCallsign?: string,
  box?: EngineerBoxTiming
): string {
  const speech = interpolateCallsign(pick(radioPhrasePool(category, language, persona)), driverCallsign);
  const timing = box ? boxTimingPhrase(category, box, language, persona) : '';
  return timing ? `${speech} ${timing}` : speech;
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
