import type { RadioPersona } from '../constants/f1';
import type { LocaleCode } from '../locales';
import {
  box_timing_phrases as enBox,
  radio_phrases as en,
  report_phrases as enReport,
} from '../locales/en/radio_phrases';
import {
  box_timing_phrases as esBox,
  radio_phrases as es,
  report_phrases as esReport,
} from '../locales/es/radio_phrases';
import type {
  BoxCallKind,
  DirectiveValues,
  EngineerBoxTiming,
  GapToCar,
  RadioAlertCategory,
  RadioPhrasePool,
  ReportPhrase,
} from '../types/telemetry';

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

/** The parts the reports' numbers are said with, per language. */
export const REPORT_PHRASES: Record<LocaleCode, Record<ReportPhrase, RadioPhrasePool>> = { en: enReport, es: esReport };

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
 * engineer's persona, addressed to the driver's callsign. A call to pit ends with when to (`box`);
 * a report says its numbers (`values`), and is left unsaid ('') without them.
 */
export function getProactiveRadioSpeech(
  category: RadioAlertCategory,
  language: LocaleCode = 'es',
  persona: RadioPersona = 'bono',
  driverCallsign?: string,
  box?: EngineerBoxTiming,
  values?: DirectiveValues
): string {
  if (category === 'tyre_life') {
    return tyreLifeSpeech(values, language, persona, driverCallsign);
  }
  const speech = interpolateCallsign(pick(radioPhrasePool(category, language, persona)), driverCallsign);
  if (category === 'gap_report') {
    const body = values ? gapReportBody(values, language, persona) : '';
    return body ? `${speech} ${body}` : '';
  }
  const timing = box ? boxTimingPhrase(category, box, language, persona) : '';
  return timing ? `${speech} ${timing}` : speech;
}

/** A number with one decimal, written the listener's way ("1.4", "1,4"). */
export function formatTenths(value: number, language: LocaleCode): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function reportPhrase(
  key: ReportPhrase,
  language: LocaleCode,
  persona: RadioPersona,
  numbers: Record<string, string> = {}
): string {
  return fillNumbers(pick(personaPhrases(REPORT_PHRASES[language][key], persona)), numbers);
}

function fillNumbers(template: string, numbers: Record<string, string>): string {
  return template.replace(/{(position|gap|rate|laps)}/g, (match, key: string) => numbers[key] ?? match);
}

/** The position and the gaps around the driver, after the gap report's opening phrase. */
function gapReportBody(values: DirectiveValues, language: LocaleCode, persona: RadioPersona): string {
  if (!values.position) return '';
  const parts = [
    values.position === 1
      ? reportPhrase('leading', language, persona)
      : reportPhrase('position', language, persona, { position: String(values.position) }),
  ];
  const side = (where: 'ahead' | 'behind', gap?: GapToCar) => {
    if (!gap) return;
    // A gap that moves too little to say how much is said without its trend.
    let key: ReportPhrase = where;
    if (gap.trend === 'stable' || (gap.trend && gap.per_lap_sec)) key = `${where}_${gap.trend}`;
    parts.push(
      reportPhrase(key, language, persona, {
        gap: formatTenths(gap.gap_sec, language),
        rate: formatTenths(gap.per_lap_sec ?? 0, language),
      })
    );
  };
  side('ahead', values.ahead);
  side('behind', values.behind);
  if (!values.ahead && !values.behind) {
    parts.push(reportPhrase('nobody_close', language, persona));
  }
  return parts.join(' ');
}

/** About how many laps the tyres have left. */
function tyreLifeSpeech(
  values: DirectiveValues | undefined,
  language: LocaleCode,
  persona: RadioPersona,
  driverCallsign?: string
): string {
  const laps = values?.tyre_laps_left;
  if (!laps) return '';
  const template =
    laps === 1
      ? pick(personaPhrases(REPORT_PHRASES[language].tyre_life_one_lap, persona))
      : pick(radioPhrasePool('tyre_life', language, persona));
  return interpolateCallsign(fillNumbers(template, { laps: String(laps) }), driverCallsign);
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
