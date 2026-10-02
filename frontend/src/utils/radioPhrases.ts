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
 * engineer's persona, addressed to the driver's callsign. A phrase can say the call's numbers
 * (`values`) through placeholders; the most informative phrase whose numbers are known is said.
 * A call to pit ends with when to (`box`), a qualifying lap result with where it stands against
 * the cut line. A call none of whose phrases can be said (a report without its numbers) is left
 * unsaid ('').
 */
export function getProactiveRadioSpeech(
  category: RadioAlertCategory,
  language: LocaleCode = 'es',
  persona: RadioPersona = 'bono',
  driverCallsign?: string,
  box?: EngineerBoxTiming,
  values?: DirectiveValues
): string {
  if (category === 'gap_report') {
    const body = values ? gapReportBody(values, language, persona) : '';
    const opener = interpolateCallsign(pick(radioPhrasePool(category, language, persona)), driverCallsign);
    return body ? `${opener} ${body}` : '';
  }
  const pool =
    category === 'tyre_life' && values?.tyre_laps_left === 1
      ? personaPhrases(REPORT_PHRASES[language].tyre_life_one_lap, persona)
      : radioPhrasePool(category, language, persona);
  const phrase = pickPhrase(pool, callNumbers(values, language));
  if (!phrase) return '';
  const parts = [interpolateCallsign(phrase, driverCallsign)];
  if (values?.elimination) parts.push(reportPhrase(`elimination_${values.elimination}`, language, persona));
  if (box) parts.push(boxTimingPhrase(category, box, language, persona));
  return parts.filter(Boolean).join(' ');
}

/** The number placeholders a phrase can use; `{driver}` is the callsign. */
const NUMBER_PLACEHOLDER = /{(position|gap|rate|laps|minutes|pole_gap)}/g;

/** The numbers a call says, written the listener's way, by placeholder. */
function callNumbers(values: DirectiveValues | undefined, language: LocaleCode): Record<string, string> {
  const numbers: Record<string, string> = {};
  if (!values) return numbers;
  if (values.position) numbers.position = String(values.position);
  // The phrases say "minutes": one minute left is said without the number.
  if (values.minutes && values.minutes > 1) numbers.minutes = String(values.minutes);
  if (values.tyre_laps_left) numbers.laps = String(values.tyre_laps_left);
  if (values.pole_gap_sec) numbers.pole_gap = formatThousandths(values.pole_gap_sec, language);
  // A traffic call is about one car, ahead or behind.
  const car = values.ahead ?? values.behind;
  if (car) numbers.gap = formatTenths(car.gap_sec, language);
  return numbers;
}

/**
 * Picks a phrase saying as many of the call's numbers as it can: among the phrases whose numbers
 * are all known, one that says the most of them. '' when none can be said.
 */
function pickPhrase(pool: readonly string[], numbers: Record<string, string>): string {
  let best: string[] = [];
  let bestCount = -1;
  for (const template of pool) {
    const keys = new Set([...template.matchAll(NUMBER_PLACEHOLDER)].map((m) => m[1]));
    if (![...keys].every((key) => numbers[key] !== undefined)) continue;
    if (keys.size > bestCount) {
      best = [template];
      bestCount = keys.size;
    } else if (keys.size === bestCount) {
      best.push(template);
    }
  }
  return best.length > 0 ? fillNumbers(pick(best), numbers) : '';
}

/** A number with one decimal, written the listener's way ("1.4", "1,4"). */
export function formatTenths(value: number, language: LocaleCode): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/** A qualifying gap, to the thousandth, written the listener's way ("0.088", "0,088"). */
export function formatThousandths(value: number, language: LocaleCode): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
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
  return template.replace(NUMBER_PLACEHOLDER, (match, key: string) => numbers[key] ?? match);
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
