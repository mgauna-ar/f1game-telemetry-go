import { RADIO_PHRASE_CONSTANTS, type RadioPersona } from '../constants/f1';
import type { LocaleCode } from '../locales';
import type { TemperatureUnit } from './units';
import {
  box_timing_phrases as enBox,
  exchange_phrases as enExchange,
  radio_phrases as en,
  report_phrases as enReport,
  value_words as enWords,
} from '../locales/en/radio_phrases';
import {
  box_timing_phrases as esBox,
  exchange_phrases as esExchange,
  radio_phrases as es,
  report_phrases as esReport,
  value_words as esWords,
} from '../locales/es/radio_phrases';
import type {
  BoxCallKind,
  DirectiveValues,
  EngineerBoxTiming,
  ExchangeLine,
  GapToCar,
  RadioAlertCategory,
  RadioPhrasePool,
  RadioValueWords,
  ReportPhrase,
} from '../types/telemetry';

export type { RadioAlertCategory };

/**
 * The spoken wording of every proactive radio call, per language. The engine only sends an alert
 * key and the call's values; this catalog is the one place its words come from. Only the Live tab
 * speaks them, so they load with it rather than with the UI dictionaries. Both languages: the
 * radio's language is its own setting, not the UI's.
 */
export const RADIO_PHRASE_CATALOG: Record<LocaleCode, Record<RadioAlertCategory, RadioPhrasePool>> = { en, es };

/** What is said after a call to pit about when to, per language. */
export const BOX_TIMING_PHRASES: Record<LocaleCode, Record<BoxCallKind, Record<EngineerBoxTiming, RadioPhrasePool>>> = {
  en: enBox,
  es: esBox,
};

/** The parts the reports' numbers are said with, per language. */
export const REPORT_PHRASES: Record<LocaleCode, Record<ReportPhrase, RadioPhrasePool>> = { en: enReport, es: esReport };

/** The engineer's own lines in a push-to-talk exchange, besides the answer, per language. */
export const EXCHANGE_PHRASES: Record<LocaleCode, Record<ExchangeLine, RadioPhrasePool>> = {
  en: enExchange,
  es: esExchange,
};

/** The words a call's wheel, axle and tyre are said with, per language. */
export const RADIO_VALUE_WORDS: Record<LocaleCode, RadioValueWords> = { en: enWords, es: esWords };

/**
 * The calls that offer a stop rather than order one; every other call that comes with a box timing
 * tells the driver to box. Their phrases leave the timing out: it is added from BOX_TIMING_PHRASES.
 */
const BOX_OPTION_CATEGORIES: ReadonlySet<RadioAlertCategory> = new Set<RadioAlertCategory>([
  'safety_car',
  'vsc',
  'pit_clean_air',
  'tyre_crossover_slicks',
]);

/** The phrases `persona` can say for `category` in `language`, falling back to the standard pool. */
export function radioPhrasePool(
  category: RadioAlertCategory,
  language: LocaleCode,
  persona: RadioPersona
): readonly string[] {
  return personaPhrases(RADIO_PHRASE_CATALOG[language][category], persona);
}

/** The phrases `persona` can say about when to pit, after a call of `category` with this box timing. */
export function boxTimingPool(
  category: RadioAlertCategory,
  box: EngineerBoxTiming,
  language: LocaleCode,
  persona: RadioPersona
): readonly string[] {
  const kind: BoxCallKind = BOX_OPTION_CATEGORIES.has(category) ? 'option' : 'instruction';
  return personaPhrases(BOX_TIMING_PHRASES[language][kind][box], persona);
}

function personaPhrases(catPool: RadioPhrasePool, persona: RadioPersona): readonly string[] {
  const personaPool = persona === 'bono' ? catPool.bono : persona === 'colapinto' ? catPool.colapinto : undefined;
  return personaPool && personaPool.length > 0 ? personaPool : catPool.standard;
}

/** The placeholders a phrase can fill from its call's values; `{driver}` is the callsign. */
const VALUE_PLACEHOLDER =
  /{(position|gap|rate|laps|minutes|pole_gap|count|penalty_sec|stop_sec|sector|delta|reaction|wheel|axle|compound|pct|rain_pct|fuel_laps|temp_delta|reach)}/g;

/**
 * What a call's values say, written the listener's way, by placeholder: numbers as digits, the
 * wheel, axle and tyre in the language's words, and a temperature change in the listener's unit.
 * A value the call doesn't have is left out.
 */
export function callFacts(
  values: DirectiveValues | undefined,
  language: LocaleCode,
  temperatureUnit: TemperatureUnit = 'c'
): Record<string, string> {
  const facts: Record<string, string> = {};
  if (!values) return facts;
  const words = RADIO_VALUE_WORDS[language];
  if (values.position) facts.position = String(values.position);
  // The phrases say "minutes": one minute is said without the number.
  if (values.minutes && values.minutes > 1) facts.minutes = String(values.minutes);
  if (values.tyre_laps_left) facts.laps = String(values.tyre_laps_left);
  // The phrases say "laps": a car one lap from range is said without the number.
  if (values.laps_to_range && values.laps_to_range > 1) facts.laps = String(values.laps_to_range);
  // How much the track temperature moved, as the server's facts for the AI give it in both units.
  if (values.track_temp_delta_c) {
    const celsius = Math.abs(values.track_temp_delta_c);
    facts.temp_delta = String(temperatureUnit === 'f' ? Math.round((celsius * 9) / 5) : celsius);
  }
  if (values.pole_gap_sec) facts.pole_gap = formatThousandths(values.pole_gap_sec, language);
  if (values.count) facts.count = String(values.count);
  if (values.penalty_sec) facts.penalty_sec = String(values.penalty_sec);
  if (values.stop_sec) facts.stop_sec = formatTenths(values.stop_sec, language);
  if (values.sector) facts.sector = String(values.sector);
  if (values.delta_sec) facts.delta = formatTenths(values.delta_sec, language);
  if (values.reaction_sec) facts.reaction = formatHundredths(values.reaction_sec, language);
  if (values.wheel) facts.wheel = words.wheel[values.wheel];
  if (values.axle) facts.axle = words.axle[values.axle];
  if (values.compound) facts.compound = words.compound[values.compound];
  if (values.pct) facts.pct = String(values.pct);
  if (values.rain_pct) facts.rain_pct = String(values.rain_pct);
  // Fuel short is said as how many laps short; a delta that rounds to nothing isn't.
  if (values.fuel_delta_laps && Math.abs(values.fuel_delta_laps) >= 0.05) {
    facts.fuel_laps = formatTenths(Math.abs(values.fuel_delta_laps), language);
  }
  // A traffic or battle call is about one car, ahead or behind. How fast the gap comes down is
  // only said while it is closing: the phrases with {rate} say the driver is catching, or caught.
  const car = values.ahead ?? values.behind;
  if (car) facts.gap = formatTenths(car.gap_sec, language);
  if (car?.trend === 'closing' && car.per_lap_sec) facts.rate = formatTenths(car.per_lap_sec, language);
  // When a qualifying traffic call's two cars meet, in whole seconds: the phrases say "seconds".
  if (car?.reach_sec && car.reach_sec > 1) facts.reach = String(car.reach_sec);
  return facts;
}

/**
 * The phrases of a pool that say the most of a call's values: among the phrases whose values are
 * all known, the ones with the most of them. Empty when none can be said.
 */
export function mostInformative(pool: readonly string[], facts: Record<string, string>): string[] {
  let best: string[] = [];
  let bestCount = -1;
  for (const template of pool) {
    const keys = new Set([...template.matchAll(VALUE_PLACEHOLDER)].map((m) => m[1]));
    if (![...keys].every((key) => facts[key] !== undefined)) continue;
    if (keys.size > bestCount) {
      best = [template];
      bestCount = keys.size;
    } else if (keys.size === bestCount) {
      best.push(template);
    }
  }
  return best;
}

/** A number with one decimal, written the listener's way ("1.4", "1,4"). */
export function formatTenths(value: number, language: LocaleCode): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/** A start reaction time, to the hundredth, written the listener's way ("0.21", "0,21"). */
export function formatHundredths(value: number, language: LocaleCode): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** A qualifying gap, to the thousandth, written the listener's way ("0.088", "0,088"). */
export function formatThousandths(value: number, language: LocaleCode): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
}

function fillValues(template: string, facts: Record<string, string>): string {
  return template.replace(VALUE_PLACEHOLDER, (match, key: string) => facts[key] ?? match);
}

/** How a proactive call is said. */
export interface ProactiveSpeechOptions {
  language?: LocaleCode;
  persona?: RadioPersona;
  /** The driver's callsign: always said on an urgent call, now and then on a routine one. */
  callsign?: string;
  /** When the driver can pit, on a call that asks them to. */
  box?: EngineerBoxTiming;
  /** The call's numbers and the wheel, axle or tyre it is about. */
  values?: DirectiveValues;
  /** An urgent call (critical or high) always says the callsign. */
  urgent?: boolean;
  /** The unit a temperature change is said in. */
  temperatureUnit?: TemperatureUnit;
}

/** A proactive call ready to say, in the catalogue's words or in words the AI found for it. */
export interface ProactiveCall {
  /** The call in the catalogue's words, with the callsign when this call says it. */
  speech: string;
  /** The catalogue's words without the callsign: what the AI words afresh, keeping its facts. */
  baseline: string;
  /** Says a line the AI worded for the call to the driver, with the callsign when `speech` has it. */
  address: (line: string) => string;
}

/** Picks the radio's words, without saying the same line twice in a row. */
export interface RadioPhrasePicker {
  /**
   * A proactive radio call, in the listener's language and the engineer's persona. A phrase can
   * say the call's values through placeholders; among the phrases that say the most of them, the
   * lines go round in a shuffled order, so none comes back before the others were said. A call to
   * pit ends with when to (`box`), a qualifying lap result with where it stands against the cut
   * line. A call none of whose phrases can be said (a report without its numbers) is left unsaid ('').
   */
  proactive(category: RadioAlertCategory, options?: ProactiveSpeechOptions): string;
  /**
   * The same call as `proactive`, with what the AI needs to word it afresh; null when it can't be
   * said. Each call counts once towards the callsign cadence, whichever words are said.
   */
  prepare(category: RadioAlertCategory, options?: ProactiveSpeechOptions): ProactiveCall | null;
  /**
   * What `persona` says, addressed to the driver's callsign, in a push-to-talk exchange besides the
   * answer: ask again, say the radio isn't working, ask to stand by, or say there is no answer.
   */
  exchange(line: ExchangeLine, language: LocaleCode, persona: RadioPersona, callsign?: string): string;
}

/**
 * A phrase picker drawing from `random` (Math.random by default). Each pool is a shuffled bag: its
 * lines are said in a random order, each once, then the bag is refilled, never starting with the
 * line just said.
 */
export function createRadioPhrasePicker(random: () => number = () => Math.random()): RadioPhrasePicker {
  const bags = new Map<string, { left: string[]; last: string }>();
  let routineCalls = 0;

  const draw = (key: string, candidates: readonly string[]): string => {
    if (candidates.length <= 1) return candidates[0] ?? '';
    const bag = bags.get(key);
    let left = bag ? bag.left.filter((line) => candidates.includes(line)) : [];
    if (left.length === 0) {
      left = shuffle(candidates, random);
      // Lines are drawn from the end: a refill doesn't start with the line just said.
      if (left[left.length - 1] === bag?.last) [left[0], left[left.length - 1]] = [left[left.length - 1], left[0]];
    }
    const line = left.pop() ?? '';
    bags.set(key, { left, last: line });
    return line;
  };

  const reportPart = (
    key: ReportPhrase,
    language: LocaleCode,
    persona: RadioPersona,
    facts: Record<string, string> = {}
  ): string =>
    fillValues(
      draw(`report|${language}|${persona}|${key}`, personaPhrases(REPORT_PHRASES[language][key], persona)),
      facts
    );

  /** The position and the gaps around the driver, after the gap report's opening phrase. */
  const gapReportBody = (values: DirectiveValues, language: LocaleCode, persona: RadioPersona): string => {
    if (!values.position) return '';
    const parts = [
      values.position === 1
        ? reportPart('leading', language, persona)
        : reportPart('position', language, persona, { position: String(values.position) }),
    ];
    const side = (where: 'ahead' | 'behind', gap?: GapToCar) => {
      if (!gap) return;
      // A gap that moves too little to say how much is said without its trend.
      let key: ReportPhrase = where;
      if (gap.trend === 'stable' || (gap.trend && gap.per_lap_sec)) key = `${where}_${gap.trend}`;
      parts.push(
        reportPart(key, language, persona, {
          gap: formatTenths(gap.gap_sec, language),
          rate: formatTenths(gap.per_lap_sec ?? 0, language),
        })
      );
    };
    side('ahead', values.ahead);
    side('behind', values.behind);
    if (!values.ahead && !values.behind) parts.push(reportPart('nobody_close', language, persona));
    return parts.join(' ');
  };

  const prepare = (
    category: RadioAlertCategory,
    {
      language = 'es',
      persona = 'bono',
      callsign,
      box,
      values,
      urgent = false,
      temperatureUnit,
    }: ProactiveSpeechOptions = {}
  ): ProactiveCall | null => {
    const key = `call|${language}|${persona}|${category}`;
    let parts: string[];
    if (category === 'gap_report') {
      const body = values ? gapReportBody(values, language, persona) : '';
      if (!body) return null;
      parts = [draw(key, radioPhrasePool(category, language, persona)), body];
    } else {
      const pool =
        category === 'tyre_life' && values?.tyre_laps_left === 1
          ? personaPhrases(REPORT_PHRASES[language].tyre_life_one_lap, persona)
          : radioPhrasePool(category, language, persona);
      const facts = callFacts(values, language, temperatureUnit);
      const phrase = draw(key, mostInformative(pool, facts));
      if (!phrase) return null;
      parts = [fillValues(phrase, facts)];
      if (values?.elimination) parts.push(reportPart(`elimination_${values.elimination}`, language, persona));
      if (box) {
        parts.push(
          draw(`box|${language}|${persona}|${category}|${box}`, boxTimingPool(category, box, language, persona))
        );
      }
    }
    // An urgent call always gets the driver's attention; a routine one says the callsign now and then.
    const sayCallsign = urgent || routineCalls++ % RADIO_PHRASE_CONSTANTS.CALLSIGN_ROUTINE_EVERY === 0;
    const name = sayCallsign ? callsign : undefined;
    const say = (opening: string) => [opening, ...parts.slice(1)].filter(Boolean).join(' ');
    return {
      speech: say(addressDriver(parts[0], name)),
      baseline: say(addressDriver(parts[0])),
      address: (line) => addressDriver(line, name),
    };
  };

  return {
    proactive: (category, options) => prepare(category, options)?.speech ?? '',
    prepare,

    exchange(line, language, persona, callsign) {
      const pool = personaPhrases(EXCHANGE_PHRASES[language][line], persona);
      return addressDriver(draw(`exchange|${language}|${persona}|${line}`, pool), callsign);
    },
  };
}

/** A shuffled copy of `items` (Fisher-Yates). */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Words a line can start with that keep their capital after the callsign: names, not sentence starts. */
const CAPITALISED_WORDS = /^(I|Safety|Virtual|Straight|Override|Inters?|Intermediates?)$/;

/**
 * Says `template` to the driver: `{driver}` becomes the callsign, or goes away cleanly without
 * one (a line that started with it then starts with a capital); a phrase without `{driver}`
 * starts with the callsign when there is one, its first word in lower case unless it is a name.
 */
export function addressDriver(template: string, callsign?: string): string {
  const name = callsign?.trim() || '';
  if (template.includes('{driver}')) {
    if (name) return template.replace(/{driver}/g, name);
    return template
      .replace(/,\s*{driver}/g, '')
      .replace(/{driver},\s*/g, '')
      .replace(/{driver}/g, '')
      .trim()
      .replace(/^([¡¿]?)(\p{Ll})/u, (_, mark: string, letter: string) => mark + letter.toUpperCase());
  }
  if (!name) return template;
  // A word like "VSC" or "P5" isn't all lower case after its first letter, so it stays as it is.
  const opening = template.replace(
    /^([¡¿]?)(\p{Lu})(\p{Ll}*)(?!\p{L}|\p{N})/u,
    (match, mark: string, first: string, rest: string) =>
      CAPITALISED_WORDS.test(first + rest) ? match : mark + first.toLowerCase() + rest
  );
  return `${name}, ${opening}`;
}

/**
 * Every line the picker may say for a call of `category` with these values, filled in, without the
 * callsign: the phrases that say the most of them. What is synthesized ahead of a call that must
 * start at once.
 */
export function possibleProactiveLines(
  category: RadioAlertCategory,
  { language = 'es', persona = 'bono', values }: Pick<ProactiveSpeechOptions, 'language' | 'persona' | 'values'> = {}
): string[] {
  const facts = callFacts(values, language);
  return mostInformative(radioPhrasePool(category, language, persona), facts).map((t) =>
    addressDriver(fillValues(t, facts))
  );
}

const radio = createRadioPhrasePicker();

/** A proactive radio call's words, from the dashboard's picker (see RadioPhrasePicker.proactive). */
export function getProactiveRadioSpeech(category: RadioAlertCategory, options?: ProactiveSpeechOptions): string {
  return radio.proactive(category, options);
}

/** A proactive radio call ready to say or have the AI word, from the dashboard's picker (see RadioPhrasePicker.prepare). */
export function prepareProactiveRadioCall(
  category: RadioAlertCategory,
  options?: ProactiveSpeechOptions
): ProactiveCall | null {
  return radio.prepare(category, options);
}

/** A push-to-talk exchange line, from the dashboard's picker (see RadioPhrasePicker.exchange). */
export function getExchangeSpeech(
  line: ExchangeLine,
  language: LocaleCode,
  persona: RadioPersona,
  driverCallsign?: string
): string {
  return radio.exchange(line, language, persona, driverCallsign);
}
