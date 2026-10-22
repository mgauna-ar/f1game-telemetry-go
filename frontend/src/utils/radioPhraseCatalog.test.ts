import { describe, it, expect } from 'vitest';
import {
  BOX_TIMING_PHRASES,
  callFacts,
  createRadioPhrasePicker,
  EXCHANGE_PHRASES,
  mostInformative,
  radioPhrasePool,
  RADIO_PHRASE_CATALOG,
  REPORT_PHRASES,
} from './radioPhrases';
import { RADIO_ALERT_CATEGORIES, TRAFFIC_CALL_CATEGORIES } from '../constants/radioAlertCategories';
import type { RadioPersona } from '../constants/f1';
import type { LocaleCode } from '../locales';
import type {
  DirectiveValues,
  EngineerAlertKey,
  EngineerBoxTiming,
  ExchangeLine,
  RadioAlertCategory,
  RadioPhrasePool,
  ReportPhrase,
} from '../types/telemetry';

/**
 * The catalog's style guide, checked: enough wordings to go round, short enough to say on a
 * straight, only the facts each call carries, and Rioplatense Spanish.
 */

const LOCALES: LocaleCode[] = ['en', 'es'];
const PERSONAS: RadioPersona[] = ['bono', 'colapinto', 'custom'];
const CATEGORIES = [...new Set(Object.values(RADIO_ALERT_CATEGORIES))].sort();

/**
 * The values the engine sends with each call, most informative first: the phrases are picked for
 * each of these. A call not listed comes without values.
 */
const CALL_VALUES: Partial<Record<RadioAlertCategory, DirectiveValues[]>> = {
  tyre_life: [{ tyre_laps_left: 6, wheel: 'rear_left' }],
  inlap_traffic_behind: [{ behind: { gap_sec: 2.3 } }],
  qualy_traffic: [{ ahead: { gap_sec: 1.5 } }],
  qualy_traffic_ahead: [{ ahead: { gap_sec: 3.1 } }],
  qualy_session_time: [{ minutes: 3 }],
  qualy_session_time_garage: [{ minutes: 3 }],
  qualy_elimination_danger: [{ position: 16, minutes: 3 }, { position: 16 }],
  qualy_elimination_bubble: [{ position: 15, minutes: 3 }, { position: 15 }],
  qualy_lap_pole: [{ position: 1, pole_gap_sec: 0.088 }, { position: 1 }],
  qualy_lap_result: [{ position: 6, pole_gap_sec: 0.345 }, { position: 6 }],
  qualy_lap_no_improvement: [{ position: 7 }],
  race_finish: [{ position: 14 }],
  race_finish_points: [{ position: 8 }],
  race_finish_podium: [{ position: 2 }],
  race_final_lap: [{ position: 5 }],
  pit_stop_duration: [{ stop_sec: 3.1 }],
  pit_stop_fast: [{ stop_sec: 2.4 }],
  pit_stop_slow: [{ stop_sec: 4.6 }],
  penalties_incurred: [{ penalty_sec: 5 }],
  pit_serve_penalty: [{ penalty_sec: 5 }],
  track_limits_warnings: [{ count: 2 }],
  rival_attack: [{ ahead: { gap_sec: 0.9, trend: 'closing', per_lap_sec: 0.3 } }, { ahead: { gap_sec: 0.9 } }],
  rival_attack_drs: [{ ahead: { gap_sec: 0.8, trend: 'closing', per_lap_sec: 0.2 } }, { ahead: { gap_sec: 0.8 } }],
  rival_attack_override: [{ ahead: { gap_sec: 0.9, trend: 'closing', per_lap_sec: 0.3 } }, { ahead: { gap_sec: 0.9 } }],
  rival_defend: [{ behind: { gap_sec: 0.6, trend: 'closing', per_lap_sec: 0.2 } }, { behind: { gap_sec: 0.6 } }],
  rival_defend_drs: [{ behind: { gap_sec: 0.6, trend: 'closing', per_lap_sec: 0.2 } }, { behind: { gap_sec: 0.6 } }],
  rival_defend_override: [
    { behind: { gap_sec: 0.7, trend: 'closing', per_lap_sec: 0.2 } },
    { behind: { gap_sec: 0.7 } },
  ],
  teammate_ahead: [{ ahead: { gap_sec: 0.8 } }],
  undercut_window: [{ behind: { gap_sec: 1.8 } }],
  overcut_window: [{ ahead: { gap_sec: 1.5 } }],
  pit_plan_next_lap: [{ position: 9 }],
  pit_plan_next_lap_traffic: [{ position: 9, ahead: { gap_sec: 1.4 } }, { ahead: { gap_sec: 1.4 } }],
  pit_plan_box: [{ position: 9 }],
  pit_clean_air: [{ position: 8 }],
  rival_closing: [
    { ahead: { gap_sec: 2.6, trend: 'closing', per_lap_sec: 0.4 }, laps_to_range: 4 },
    { ahead: { gap_sec: 2.6, trend: 'closing', per_lap_sec: 0.4 }, laps_to_range: 1 },
  ],
  rival_catching_you: [
    { behind: { gap_sec: 2.2, trend: 'closing', per_lap_sec: 0.3 }, laps_to_range: 4 },
    { behind: { gap_sec: 2.2, trend: 'closing', per_lap_sec: 0.3 }, laps_to_range: 1 },
  ],
  rival_penalty_ahead: [{ ahead: { gap_sec: 3.2 }, penalty_sec: 5 }],
  rival_penalty_behind: [{ behind: { gap_sec: 2.1 }, penalty_sec: 5 }],
  leader_pitted: [{ ahead: { gap_sec: 12.4 } }],
  nearby_pitted_ahead: [{ ahead: { gap_sec: 6.2 } }],
  nearby_pitted_behind: [{ behind: { gap_sec: 4.8 } }],
  sector_delta: [{ sector: 2, delta_sec: 0.42 }],
  start_reaction_time: [{ reaction_sec: 0.31 }],
  start_reaction_fast: [{ reaction_sec: 0.21 }],
  start_reaction_slow: [{ reaction_sec: 0.48 }],
  brake_overheat: [{ wheel: 'front_left' }],
  brake_overheat_rear: [{ wheel: 'rear_right' }],
  brake_bias: [{ axle: 'front' }],
  brake_bias_forward: [{ axle: 'rear' }],
  tyre_worn_out: [{ wheel: 'front_left', pct: 95 }],
  tyre_wear: [{ wheel: 'rear_left', pct: 40 }],
  tyre_wear_critical: [{ wheel: 'front_right', pct: 75 }],
  tyre_blistering: [{ wheel: 'rear_right', pct: 30 }],
  tyre_puncture: [{ wheel: 'rear_left' }],
  tyre_pressure_high: [{ wheel: 'front_left' }, { axle: 'rear' }],
  tyre_crossover: [{ compound: 'inter' }],
  tyre_crossover_inter: [{ compound: 'inter' }],
  tyre_crossover_wet: [{ compound: 'wet' }],
  tyre_set_advisory: [{ compound: 'hard' }],
  weather_rain: [{ rain_pct: 60, minutes: 10 }, { rain_pct: 60 }],
  weather_rain_approx: [{ rain_pct: 60, minutes: 10 }, { rain_pct: 60 }],
  track_temp_up: [{ track_temp_delta_c: 7 }],
  track_temp_down: [{ track_temp_delta_c: -7 }],
  fuel_deficit: [{ fuel_delta_laps: -0.6 }],
  ers_low: [{ pct: 12 }],
  wing_damage: [{ pct: 35 }],
  floor_damage: [{ pct: 30 }],
  damage_gearbox_wear: [{ pct: 60 }],
  damage_ice_wear: [{ pct: 70 }],
  engine_wear: [{ pct: 70 }],
};

/** Calls that say nothing without their numbers: the reports. */
const NEEDS_VALUES: ReadonlySet<RadioAlertCategory> = new Set(['gap_report', 'tyre_life']);

/**
 * The calls heard most, which need at least four wordings per persona where they say the most;
 * the rest need three.
 */
const COMMON: ReadonlySet<RadioAlertCategory> = new Set<RadioAlertCategory>([
  'gap_report',
  'rival_attack',
  'rival_attack_drs',
  'rival_attack_override',
  'rival_defend',
  'rival_defend_drs',
  'rival_defend_override',
  'rival_closing',
  'rival_catching_you',
  'teammate_ahead',
  'tyre_wear',
  'tyre_wear_critical',
  'tyre_overheat',
  'tyre_cold',
  'tyre_life',
  'tyre_life_end',
  'brake_overheat',
  'brake_overheat_rear',
  'brake_cold',
  'sector_delta',
  'ers_low',
  'fuel_deficit',
  'radiator_overheat',
  'pit_plan_next_lap',
  'pit_plan_box',
  'pit_window_close',
  'pit_clean_air',
  'pit_entry_reminder',
  'safety_car',
  'vsc',
  'flags_sc_in',
  'flags_green',
  'flags_blue',
  'flags_yellow',
  'track_limits_warnings',
  'aero_straight_anticipation',
  'overtake_boost_anticipation',
  'qualy_traffic',
  'qualy_traffic_ahead',
  'qualy_clean_air',
  'inlap_traffic_behind',
  'qualy_lap_result',
  'qualy_lap_no_improvement',
]);

/** The calls the engine sends as critical or high: the callsign is always said, and they are kept short. */
const URGENT: ReadonlySet<RadioAlertCategory> = new Set<RadioAlertCategory>([
  'safety_car',
  'safety_car_box',
  'vsc',
  'vsc_box',
  'vsc_ending',
  'red_flag',
  'flags_sc_in',
  'flags_green',
  'flags_blue',
  'flags_yellow',
  'flags_drs_disabled',
  'flags_rain_live',
  'wrong_way',
  'track_limits_warnings',
  'penalties_incurred',
  'penalty_drive_through',
  'penalty_stop_go',
  'car_collision',
  'car_collision_light',
  'car_collision_heavy',
  'wing_damage',
  'aero_fault',
  'ers_fault',
  'terminal_engine',
  'radiator_overheat_critical',
  'tyre_puncture',
  'tyre_worn_out',
  'tyre_wear_critical',
  'tyre_crossover',
  'tyre_crossover_wet',
  'tyre_crossover_inter',
  'undercut_window',
  'overcut_window',
  'pit_entry_reminder',
  'pit_plan_box',
  'pit_window_close',
  'pit_limiter_overspeed',
  'pit_limiter_exit',
  'pit_serve_penalty',
  'teammate_doublestack',
  'qualy_deleted_lap',
  'qualy_traffic',
  'qualy_traffic_ahead',
  'inlap_traffic_behind',
  'qualy_session_time',
  'qualy_session_time_garage',
  'qualy_elimination_danger',
  'qualy_elimination_bubble',
  'qualy_lap_pole',
  'qualy_lap_result',
  'qualy_lap_no_improvement',
]);

const MAX_WORDS_URGENT = 12;
const MAX_WORDS_ROUTINE = 18;

/** Tuteo forms, which the Rioplatense radio never uses (voseo: mantené, tenés, podés, cuidá...). */
const TUTEO =
  /(?<!\p{L})(mantén|mantenlo|mantenla|mantenlas|tienes|puedes|quieres|debes|necesitas|sabes|descuentas|pierdes|cuida|cuídala|cuídalo|cuídalas|cuídalos|empuja|defiende|recupera|levanta|ten|haz|pon|sal|mira|aprieta|tráela|tráelo|prepárate|concéntrate|quédate|relájate|olvídate|acércate|apúrate|cálmate|dime|escúchame|tú|contigo)(?!\p{L})/iu;

/** Every template a category can speak in one locale, across all personas. */
function allTemplates(pool: RadioPhrasePool): string[] {
  return [...(pool.bono ?? []), ...(pool.colapinto ?? []), ...pool.standard];
}

/** The template's words, `{driver}` left out and each other placeholder one word. */
function wordCount(template: string): number {
  return template
    .replace(/,?\s*{driver},?/g, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}{]/u.test(w)).length;
}

/** The placeholders each category may use: the ones its values fill. */
function allowedPlaceholders(language: LocaleCode, category: RadioAlertCategory): Set<string> {
  const allowed = new Set(['driver']);
  for (const values of CALL_VALUES[category] ?? []) {
    for (const key of Object.keys(callFacts(values, language))) allowed.add(key);
  }
  return allowed;
}

describe('the radio phrase catalog', () => {
  describe.each(LOCALES)('in %s', (language) => {
    const catalog = RADIO_PHRASE_CATALOG[language];

    it.each(PERSONAS)('says every alert the engine sends, with its values, for the %s persona', (persona) => {
      const picker = createRadioPhrasePicker();
      for (const key of Object.keys(RADIO_ALERT_CATEGORIES) as EngineerAlertKey[]) {
        const category = RADIO_ALERT_CATEGORIES[key];
        const cases = NEEDS_VALUES.has(category)
          ? (CALL_VALUES[category] ?? [])
          : [...(CALL_VALUES[category] ?? []), undefined];
        if (category === 'gap_report') cases.push({ position: 5, ahead: { gap_sec: 1.4 } });
        for (const values of cases) {
          for (const callsign of ['Franco', '']) {
            const speech = picker.proactive(category, { language, persona, callsign, values, urgent: true });
            const label = `${key}/${persona} ${JSON.stringify(values)}`;
            expect(speech, label).not.toBe('');
            expect(speech, label).not.toMatch(/[{}]|^,|,\s*[.!?,]|\s{2,}|\s[.!?,]/);
            if (callsign) expect(speech, label).toContain(callsign);
          }
        }
      }
    });

    it('has its own pool for every persona of every call', () => {
      for (const category of CATEGORIES) {
        const pool = catalog[category];
        expect(pool, category).toBeDefined();
        expect(pool.bono?.length, `${category}/bono`).toBeGreaterThan(0);
        expect(pool.colapinto?.length, `${category}/colapinto`).toBeGreaterThan(0);
        expect(pool.standard.length, `${category}/standard`).toBeGreaterThan(0);
      }
    });

    it('has enough wordings per persona where a call says the most', () => {
      for (const category of CATEGORIES) {
        const min = COMMON.has(category) ? 4 : 3;
        for (const persona of PERSONAS) {
          const pool = radioPhrasePool(category, language, persona);
          const cases = CALL_VALUES[category] ?? [undefined];
          cases.forEach((values, i) => {
            const said = mostInformative(pool, callFacts(values, language));
            const need = i === 0 ? min : 2;
            expect(said.length, `${category}/${persona} with ${JSON.stringify(values)}`).toBeGreaterThanOrEqual(need);
          });
        }
      }
    });

    it('has a phrase without values in every pool of a call that can come without them', () => {
      for (const category of CATEGORIES) {
        if (NEEDS_VALUES.has(category)) continue;
        for (const persona of PERSONAS) {
          const plain = radioPhrasePool(category, language, persona).filter((t) => !/{(?!driver})\w+}/.test(t));
          expect(plain.length, `${category}/${persona}`).toBeGreaterThan(0);
        }
      }
    });

    it('only uses {driver} and the values its call carries', () => {
      for (const category of CATEGORIES) {
        const allowed = allowedPlaceholders(language, category);
        for (const template of allTemplates(catalog[category])) {
          for (const [, key] of template.matchAll(/{(\w+)}/g)) {
            expect(allowed.has(key), `${category}: ${template}`).toBe(true);
          }
          expect(template.replace(/{\w+}/g, ''), `${category}: ${template}`).not.toMatch(/[{}]/);
        }
      }
    });

    it('puts {driver} where it can go without leaving a gap', () => {
      for (const category of CATEGORIES) {
        for (const template of allTemplates(catalog[category])) {
          if (!template.includes('{driver}')) continue;
          // Either "{driver}, ..." at the start, or ", {driver}" before a full stop, a comma or the end.
          expect(template, `${category}`).toMatch(/^[¡¿]?{driver}, |, {driver}[.!?,]/);
        }
      }
    });

    it('starts a traffic call with the warning: no callsign and no filler before it', () => {
      for (const category of TRAFFIC_CALL_CATEGORIES) {
        for (const template of allTemplates(catalog[category])) {
          expect(template, `${category}: ${template}`).not.toContain('{driver}');
          expect(template, `${category}: ${template}`).not.toMatch(/^[¡¿]?(okay|ok|ojo|vale)\b/i);
        }
      }
    });

    it('keeps urgent calls short and routine ones under a straight', () => {
      for (const category of CATEGORIES) {
        const max = URGENT.has(category) ? MAX_WORDS_URGENT : MAX_WORDS_ROUTINE;
        for (const template of allTemplates(catalog[category])) {
          expect(wordCount(template), `${category}: ${template}`).toBeLessThanOrEqual(max);
        }
      }
    });

    it('says nothing the speech engine would read badly', () => {
      for (const category of CATEGORIES) {
        for (const template of allTemplates(catalog[category])) {
          expect(template, `${category}`).not.toMatch(/[/%()[\]&]|\d\s*[-–]\s*\d|\bMJ\b|\d+\s*°|\bkm\/h\b/);
          expect(template, `${category}`).not.toMatch(/\bdetect(ed|ado|ada|amos)\b|\bconfirm(ed|ado)\b/i);
        }
      }
    });

    it('never answers "Copy", "Roger" or "Entendido" on a proactive call', () => {
      for (const category of CATEGORIES) {
        for (const template of allTemplates(catalog[category])) {
          expect(template, category).not.toMatch(/\b(copy|roger|entendido|recibido|copiado)\b/i);
        }
      }
    });

    it('never says the same line twice in a call', () => {
      for (const category of CATEGORIES) {
        const lines = allTemplates(catalog[category]).map((t) => t.toLowerCase());
        const dupes = lines.filter((t, i) => lines.indexOf(t) !== i);
        expect(dupes, category).toEqual([]);
      }
    });

    it.runIf(language === 'es')('speaks Rioplatense Spanish (voseo)', () => {
      const pools: [string, RadioPhrasePool][] = [
        ...CATEGORIES.map((c) => [c, catalog[c]] as [string, RadioPhrasePool]),
        ...Object.entries(REPORT_PHRASES.es),
        ...Object.entries(EXCHANGE_PHRASES.es),
        ...Object.entries(BOX_TIMING_PHRASES.es.instruction).map(
          ([k, v]) => [`instruction.${k}`, v] as [string, RadioPhrasePool]
        ),
        ...Object.entries(BOX_TIMING_PHRASES.es.option).map(
          ([k, v]) => [`option.${k}`, v] as [string, RadioPhrasePool]
        ),
      ];
      for (const [name, pool] of pools) {
        for (const template of allTemplates(pool)) {
          expect(template, `${name}`).not.toMatch(TUTEO);
        }
      }
    });

    it('says the report parts with their own numbers, and leaves the callsign to the call they follow', () => {
      const numbers: Record<ReportPhrase, string[]> = {
        position: ['position'],
        leading: [],
        ahead: ['gap'],
        ahead_closing: ['gap', 'rate'],
        ahead_opening: ['gap', 'rate'],
        ahead_stable: ['gap'],
        behind: ['gap'],
        behind_closing: ['gap', 'rate'],
        behind_opening: ['gap', 'rate'],
        behind_stable: ['gap'],
        nobody_close: [],
        tyre_life_one_lap: ['wheel'],
        elimination_drop_zone: [],
        elimination_last_through: [],
      };
      for (const key of Object.keys(REPORT_PHRASES[language]) as ReportPhrase[]) {
        for (const template of allTemplates(REPORT_PHRASES[language][key])) {
          const used = [...template.matchAll(/{(\w+)}/g)].map((m) => m[1]);
          expect(
            used.every((k) => numbers[key].includes(k)),
            `report.${key}: ${template}`
          ).toBe(true);
          // The numbers a part exists to say are in every line of it.
          for (const k of numbers[key].filter((k) => k !== 'wheel')) {
            expect(used, `report.${key}: ${template}`).toContain(k);
          }
          if (/_(closing|opening)$/.test(key)) expect(template, `report.${key}`).toMatch(/{gap}.*{rate}/);
        }
      }
      for (const kind of ['instruction', 'option'] as const) {
        for (const [timing, pool] of Object.entries(BOX_TIMING_PHRASES[language][kind])) {
          for (const template of allTemplates(pool)) {
            expect(template, `${kind}.${timing}`).not.toMatch(/[{}]/);
          }
        }
      }
    });

    it('has a few ways to say when to box, the report parts and the exchange lines', () => {
      const timings: EngineerBoxTiming[] = ['this_lap', 'next_lap', 'asap'];
      for (const persona of PERSONAS) {
        for (const timing of timings) {
          const pool = BOX_TIMING_PHRASES[language].instruction[timing];
          const said = persona === 'bono' ? pool.bono : persona === 'colapinto' ? pool.colapinto : pool.standard;
          expect(said?.length ?? pool.standard.length, `instruction.${timing}/${persona}`).toBeGreaterThanOrEqual(2);
        }
      }
      for (const timing of ['this_lap', 'next_lap'] as EngineerBoxTiming[]) {
        expect(BOX_TIMING_PHRASES[language].option[timing].standard.length, `option.${timing}`).toBeGreaterThanOrEqual(
          2
        );
      }
      for (const key of Object.keys(REPORT_PHRASES[language]) as ReportPhrase[]) {
        expect(REPORT_PHRASES[language][key].standard.length, `report.${key}`).toBeGreaterThanOrEqual(2);
      }
      for (const line of Object.keys(EXCHANGE_PHRASES[language]) as ExchangeLine[]) {
        const pool = EXCHANGE_PHRASES[language][line];
        expect(pool.standard.length, `exchange.${line}`).toBeGreaterThanOrEqual(2);
        expect(pool.bono?.length, `exchange.${line}/bono`).toBeGreaterThanOrEqual(2);
        expect(pool.colapinto?.length, `exchange.${line}/colapinto`).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // Every phrase in the pool must say this: the call's fact, whichever line comes up.
  it.each<[LocaleCode, RadioPersona, RadioAlertCategory, RegExp]>([
    ['en', 'bono', 'safety_car', /safety car/i],
    ['es', 'colapinto', 'safety_car', /safety car|auto de seguridad/i],
    ['en', 'bono', 'vsc', /vsc|virtual safety car/i],
    ['es', 'bono', 'red_flag', /bandera roja/i],
    ['en', 'bono', 'red_flag', /red flag/i],
    ['en', 'bono', 'tyre_puncture', /puncture/i],
    ['es', 'colapinto', 'tyre_puncture', /pinchadura|pinchazo|pinchaste|pinchada/i],
    ['en', 'bono', 'flags_sc_in', /safety car/i],
    ['en', 'bono', 'flags_sc_in', /in this lap|comes in|coming in|in at the end/i],
    ['es', 'colapinto', 'flags_green', /verde/i],
    ['en', 'bono', 'flags_blue', /blue flag/i],
    ['es', 'colapinto', 'flags_yellow', /amarilla/i],
    ['en', 'bono', 'pit_window_close', /clos|last lap|last chance/i],
    ['es', 'colapinto', 'teammate_doublestack', /doble/i],
    ['en', 'bono', 'terminal_engine', /engine/i],
    ['es', 'colapinto', 'brake_bias', /balance|reparto|freno/i],
    ['en', 'bono', 'wrong_way', /wrong way/i],
    ['en', 'colapinto', 'wrong_way', /wrong way/i],
    ['en', 'custom', 'wrong_way', /wrong way/i],
    ['en', 'bono', 'tyre_crossover_wet', /wet/i],
    ['es', 'colapinto', 'tyre_crossover_inter', /intermedi/i],
    ['en', 'bono', 'brake_bias_ok', /balance|even|equal|bias/i],
    ['es', 'colapinto', 'fuel_mix_neutralized', /mezcla|mapa/i],
    ['en', 'bono', 'fuel_mix_restart', /standard|race mix|mix/i],
    ['es', 'colapinto', 'fuel_mix_restart', /mezcla|mapa/i],
    ['en', 'bono', 'tyre_crossover', /inter/i],
    ['es', 'colapinto', 'tyre_crossover', /intermedi/i],
    ['en', 'bono', 'tyre_crossover_slicks', /slick/i],
    ['en', 'bono', 'brake_overheat', /rearward|back|rear/i],
    ['en', 'bono', 'brake_overheat_rear', /forward/i],
    ['es', 'colapinto', 'brake_overheat_rear', /adelante/i],
    ['en', 'bono', 'brake_bias', /rearward|back|rear/i],
    ['es', 'bono', 'brake_bias_forward', /adelante/i],
    ['es', 'colapinto', 'ers_clipping', /clipping|batería|despliegue/i],
    ['en', 'bono', 'tyre_set_advisory', /set|tyres|fresh|new/i],
    ['en', 'bono', 'race_finish', /parc ferm|flag/i],
    ['es', 'colapinto', 'race_finish', /parque cerrado|bandera/i],
    ['es', 'colapinto', 'inlap_traffic_behind', /lanzad|rápida/i],
    ['en', 'bono', 'inlap_cooldown', /cool/i],
    ['es', 'colapinto', 'sector_delta', /sector|parcial/i],
    ['es', 'colapinto', 'aero_straight_anticipation', /recta|aerodinámica|straight mode|alerón/i],
    ['en', 'bono', 'overtake_boost_anticipation', /override|boost/i],
    ['es', 'colapinto', 'pit_limiter_overspeed', /limitador|velocidad/i],
    ['en', 'bono', 'tyre_blistering', /blister/i],
    ['es', 'colapinto', 'tyre_pressure_high', /presión|presiones/i],
    ['es', 'colapinto', 'damage_gearbox_wear', /caja/i],
    ['en', 'bono', 'damage_ice_wear', /engine|ice|power/i],
    ['en', 'bono', 'overcut_window', /ahead|in front/i],
    ['es', 'colapinto', 'overcut_window', /adelante/i],
    ['en', 'colapinto', 'race_final_lap', /last lap|final lap/i],
    ['es', 'bono', 'race_final_lap_lead', /última/i],
    ['en', 'bono', 'rival_penalty_ahead', /penalt/i],
    ['es', 'colapinto', 'rival_penalty_ahead', /penaliz|sanci/i],
    ['en', 'bono', 'rival_penalty_behind', /penalt/i],
    ['es', 'colapinto', 'rival_penalty_behind', /penaliz|sanci/i],
    ['en', 'bono', 'leader_pitted', /leader/i],
    ['es', 'colapinto', 'leader_pitted', /líder|punter/i],
    ['en', 'bono', 'nearby_pitted_ahead', /ahead|in front|up the road/i],
    ['es', 'colapinto', 'nearby_pitted_ahead', /adelante/i],
    ['en', 'bono', 'nearby_pitted_behind', /behind/i],
    ['es', 'colapinto', 'nearby_pitted_behind', /atrás|detrás/i],
    ['en', 'bono', 'pit_plan_next_lap_traffic', /behind|traffic/i],
    ['es', 'colapinto', 'pit_plan_next_lap_traffic', /detrás|atrás|tráfico/i],
    ['en', 'bono', 'penalty_served', /served|done/i],
    ['es', 'colapinto', 'penalty_served', /cumpl/i],
    ['en', 'bono', 'weather_rain_approx', /rain/i],
    ['es', 'colapinto', 'weather_rain_approx', /lluvia|llover|llueva/i],
    ['en', 'bono', 'rain_heavier', /rain/i],
    ['es', 'colapinto', 'rain_heavier', /lluvia|llueve|llover/i],
    ['en', 'bono', 'rain_easing', /rain/i],
    ['es', 'colapinto', 'rain_easing', /lluvia|llueve|llover/i],
    ['en', 'bono', 'track_drying', /dry|drying/i],
    ['es', 'colapinto', 'track_drying', /sec/i],
    ['en', 'bono', 'track_temp_up', /track|asphalt/i],
    ['es', 'colapinto', 'track_temp_down', /pista|asfalto/i],
  ])('%s/%s %s speaks about it, in every persona', (language, _persona, category, pattern) => {
    for (const persona of PERSONAS) {
      for (const template of radioPhrasePool(category, language, persona)) {
        expect(template, `${persona}`).toMatch(pattern);
      }
    }
  });

  // F1 2026 has no DRS: the engine sends the override alerts itself, and their phrases say so.
  it.each(LOCALES)('speaks the 2026 override alerts without DRS in %s', (language) => {
    for (const category of ['rival_attack_override', 'rival_defend_override'] as const) {
      for (const template of allTemplates(RADIO_PHRASE_CATALOG[language][category])) {
        expect(template, `${language}/${category}`).not.toContain('DRS');
      }
    }
  });

  it.each(LOCALES)('says DRS only on the calls that have it, in %s', (language) => {
    for (const category of ['rival_defend', 'rival_attack'] as RadioAlertCategory[]) {
      for (const template of allTemplates(RADIO_PHRASE_CATALOG[language][category])) {
        expect(template).not.toContain('DRS');
      }
    }
    for (const category of ['rival_defend_drs', 'rival_attack_drs'] as RadioAlertCategory[]) {
      for (const template of allTemplates(RADIO_PHRASE_CATALOG[language][category])) {
        expect(template).toContain('DRS');
      }
    }
  });

  it.each(LOCALES)('says a gap is closing only when it is, in %s', (language) => {
    const battles: RadioAlertCategory[] = [
      'rival_attack',
      'rival_attack_drs',
      'rival_attack_override',
      'rival_defend',
      'rival_defend_drs',
      'rival_defend_override',
    ];
    for (const category of battles) {
      for (const template of allTemplates(RADIO_PHRASE_CATALOG[language][category])) {
        if (template.includes('{rate}')) continue;
        expect(template, `${language}/${category}`).not.toMatch(
          /catching|closing|gaining|reeling|coming at|acerc|descont|viene más rápido|lo estás alcanzando/i
        );
      }
    }
  });

  it.each(LOCALES)('says how hard a contact was only when the game rates it, in %s', (language) => {
    const catalog = RADIO_PHRASE_CATALOG[language];
    for (const template of allTemplates(catalog.car_collision)) {
      expect(template).not.toMatch(/\b(heavy|big|hard|fuerte|leve|light|minor|suave)\b/i);
    }
    for (const template of allTemplates(catalog.car_collision_light)) {
      expect(template).toMatch(/light|touch|minor|leve|roce|toque|suave/i);
    }
    for (const template of allTemplates(catalog.car_collision_heavy)) {
      expect(template).toMatch(/\b(heavy|big|hard|fuerte|duro)\b/i);
    }
  });

  it.each(LOCALES)("never calls a lapping car the leader or another car's lap purple, in %s", (language) => {
    const catalog = RADIO_PHRASE_CATALOG[language];
    for (const template of allTemplates(catalog.flags_blue)) expect(template).not.toMatch(/leader|líder|punter/i);
    for (const template of allTemplates(catalog.race_fastest_lap))
      expect(template).not.toMatch(/purple|morado|violeta/i);
  });

  it.each(LOCALES)('only praises a fast launch or a fast stop, in %s', (language) => {
    for (const category of ['start_reaction_slow', 'pit_stop_slow'] as RadioAlertCategory[]) {
      for (const template of allTemplates(RADIO_PHRASE_CATALOG[language][category])) {
        expect(template, category).not.toMatch(
          /(?<!\p{L})(great|brilliant|excellent|mega|good|nice|gran|qué|bien|buena|bárbar\p{L}*|genial)(?!\p{L})/iu
        );
      }
    }
  });

  it.each(LOCALES)('never says when a penalty is served, in %s', (language) => {
    for (const category of ['penalties_incurred', 'penalty_drive_through', 'penalty_stop_go'] as RadioAlertCategory[]) {
      for (const template of allTemplates(RADIO_PHRASE_CATALOG[language][category])) {
        expect(template, category).not.toMatch(/next stop|próxima parada|at the stop|en la parada/i);
      }
    }
  });

  // The calls the engine sends with a box timing: their phrases leave the timing to it.
  it.each(LOCALES)('leaves out when to box on calls that come with a timing, in %s', (language) => {
    const BOX_CATEGORIES: RadioAlertCategory[] = [
      'tyre_puncture',
      'tyre_worn_out',
      'tyre_crossover_slicks',
      'wing_damage',
      'tyre_crossover',
      'tyre_crossover_inter',
      'tyre_crossover_wet',
      'pit_plan_box',
      'pit_window_close',
      'pit_clean_air',
      'safety_car',
      'safety_car_box',
      'vsc',
      'vsc_box',
    ];
    const timingWords =
      language === 'es'
        ? /esta vuelta|pr[oó]xima vuelta|ya mismo|inmediatamente|\bahora\b.*box|box,? box/i
        : /this lap|next lap|immediately|box now|box,? box/i;
    for (const category of BOX_CATEGORIES) {
      for (const template of allTemplates(RADIO_PHRASE_CATALOG[language][category])) {
        expect(template, `${language}/${category}`).not.toMatch(timingWords);
      }
    }
  });
  it.each(LOCALES)('hedges an approximate forecast and nothing else, in %s', (language) => {
    const hedge =
      language === 'es'
        ? /aproximad|más o menos|no es segur|capaz|quizás|tal vez|puede que|parece|dice|calcula/i
        : /approximate|rough|about|around|maybe|might|could|not sure|reckon|looks like|says|suggests/i;
    for (const template of allTemplates(RADIO_PHRASE_CATALOG[language].weather_rain_approx)) {
      expect(template).toMatch(hedge);
    }
  });

  it.each(LOCALES)('says a track temperature change in degrees, whatever the unit, in %s', (language) => {
    const catalog = RADIO_PHRASE_CATALOG[language];
    for (const category of ['track_temp_up', 'track_temp_down'] as const) {
      for (const template of allTemplates(catalog[category])) {
        expect(template, category).not.toMatch(/celsius|fahrenheit|centígrad/i);
        if (template.includes('{temp_delta}')) expect(template, category).toMatch(/{temp_delta} (degrees|grados)/);
      }
    }
    for (const template of allTemplates(catalog.track_temp_up)) expect(template).not.toMatch(/cool|cold|fr[ií]|baj/i);
    for (const template of allTemplates(catalog.track_temp_down)) expect(template).not.toMatch(/hot|warm|calor|subi/i);
  });

  it.each(LOCALES)('says a car closing in only as fast as it closes, in %s', (language) => {
    const catalog = RADIO_PHRASE_CATALOG[language];
    for (const category of ['rival_closing', 'rival_catching_you'] as const) {
      for (const template of allTemplates(catalog[category])) {
        // No claim the engine doesn't make: DRS, the rival's tyres or name, an order to pass.
        expect(template, category).not.toMatch(
          /\b(DRS|override|softs?|mediums?|hards?|blandas?|medios?|duros?|pass|overtake|pasalo|superalo)\b/i
        );
        if (template.includes('{laps}')) expect(template, category).toMatch(/{laps} (laps|vueltas)/);
      }
    }
  });
});
