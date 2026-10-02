import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BOX_TIMING_PHRASES,
  boxTimingPhrase,
  formatTenths,
  formatThousandths,
  getProactiveRadioSpeech,
  radioPhrasePool,
  RADIO_PHRASE_CATALOG,
  REPORT_PHRASES,
} from './radioPhrases';
import { RADIO_ALERT_CATEGORIES } from '../constants/radioAlertCategories';
import type { RadioPersona } from '../constants/f1';
import type { LocaleCode } from '../locales';
import type {
  DirectiveValues,
  EngineerAlertKey,
  EngineerBoxTiming,
  RadioAlertCategory,
  ReportPhrase,
} from '../types/telemetry';

const LOCALES: LocaleCode[] = ['en', 'es'];
const PERSONAS: RadioPersona[] = ['bono', 'colapinto', 'custom'];
const ALERT_KEYS = Object.keys(RADIO_ALERT_CATEGORIES) as EngineerAlertKey[];

/** The reports' numbers, as the engine sends them; a report says nothing without them. */
const REPORT_VALUES: Partial<Record<RadioAlertCategory, DirectiveValues>> = {
  gap_report: {
    position: 5,
    ahead: { gap_sec: 1.4, trend: 'closing', per_lap_sec: 0.2 },
    behind: { gap_sec: 2, trend: 'stable' },
  },
  tyre_life: { tyre_laps_left: 6 },
  qualy_lap_pole: { position: 1, pole_gap_sec: 0.088 },
  qualy_lap_result: { position: 6, pole_gap_sec: 0.345 },
  qualy_lap_no_improvement: { position: 7 },
};

/** The numbers each category's phrases may say; every other phrase only says `{driver}`. */
const CATEGORY_NUMBERS: Partial<Record<RadioAlertCategory, string[]>> = {
  tyre_life: ['laps'],
  inlap_traffic_behind: ['gap'],
  qualy_traffic: ['gap'],
  qualy_traffic_ahead: ['gap'],
  qualy_session_time: ['minutes'],
  qualy_session_time_garage: ['minutes'],
  qualy_elimination_danger: ['position'],
  qualy_elimination_bubble: ['position'],
  qualy_lap_pole: ['pole_gap'],
  qualy_lap_result: ['position', 'pole_gap'],
  qualy_lap_no_improvement: ['position'],
};

/** Every template a category can speak in one locale, across all personas. */
function allTemplates(language: LocaleCode, category: RadioAlertCategory): string[] {
  const pool = RADIO_PHRASE_CATALOG[language][category];
  return [...(pool.bono ?? []), ...(pool.colapinto ?? []), ...pool.standard];
}

describe('radioPhrases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.each(LOCALES)('every alert the engine sends, in %s', (language) => {
    it.each(PERSONAS)('speaks a catalog phrase for the %s persona', (persona) => {
      for (const key of ALERT_KEYS) {
        const category = RADIO_ALERT_CATEGORIES[key];
        const pool = radioPhrasePool(category, language, persona);
        expect(pool.length, `${language}/${persona}/${key}`).toBeGreaterThan(0);
        if (REPORT_VALUES[category]) continue; // reports add their numbers: see 'reports'

        const speech = getProactiveRadioSpeech(category, language, persona, 'Lewis');
        const expected = pool.map((template) =>
          template.includes('{driver}') ? template.replace(/{driver}/g, 'Lewis') : `Lewis, ${template}`
        );
        expect(expected, `${language}/${persona}/${key}`).toContain(speech);
      }
    });

    it('uses the persona pool when it has phrases, and the standard pool otherwise', () => {
      for (const category of Object.keys(RADIO_PHRASE_CATALOG[language]) as RadioAlertCategory[]) {
        const pool = RADIO_PHRASE_CATALOG[language][category];
        expect(radioPhrasePool(category, language, 'bono')).toEqual(pool.bono?.length ? pool.bono : pool.standard);
        expect(radioPhrasePool(category, language, 'colapinto')).toEqual(
          pool.colapinto?.length ? pool.colapinto : pool.standard
        );
        expect(radioPhrasePool(category, language, 'custom')).toEqual(pool.standard);
      }
    });

    it('never answers "Copy", "Roger" or "Entendido" on a proactive call', () => {
      for (const category of Object.keys(RADIO_PHRASE_CATALOG[language]) as RadioAlertCategory[]) {
        for (const template of allTemplates(language, category)) {
          expect(template, `${language}/${category}`).not.toMatch(/\b(copy|roger|entendido|recibido)\b/i);
        }
      }
    });

    it('only uses {driver} and the numbers its call carries', () => {
      for (const category of Object.keys(RADIO_PHRASE_CATALOG[language]) as RadioAlertCategory[]) {
        const allowed = CATEGORY_NUMBERS[category] ?? [];
        for (const template of allTemplates(language, category)) {
          const rest = allowed.reduce((t, key) => t.replaceAll(`{${key}}`, ''), template.replace(/{driver}/g, ''));
          expect(rest, `${language}/${category}`).not.toMatch(/[{}]/);
          if (category === 'tyre_life') expect(template, `${language}/${category}`).toContain('{laps}');
        }
      }
    });

    it('has a phrase without numbers in every pool of a call that can come without them', () => {
      for (const category of Object.keys(RADIO_PHRASE_CATALOG[language]) as RadioAlertCategory[]) {
        if (REPORT_VALUES[category] || category === 'tyre_life') continue;
        for (const persona of PERSONAS) {
          const plain = radioPhrasePool(category, language, persona).filter((t) => !/{(?!driver})\w+}/.test(t));
          expect(plain.length, `${language}/${persona}/${category}`).toBeGreaterThan(0);
        }
      }
    });

    it('drops {driver} cleanly when there is no callsign', () => {
      for (const key of ALERT_KEYS) {
        const category = RADIO_ALERT_CATEGORIES[key];
        for (let i = 0; i < radioPhrasePool(category, language, 'bono').length; i++) {
          vi.spyOn(Math, 'random').mockReturnValueOnce(i / radioPhrasePool(category, language, 'bono').length);
          const speech = getProactiveRadioSpeech(category, language, 'bono', '', undefined, REPORT_VALUES[category]);
          expect(speech, `${language}/${key}`).not.toBe('');
          expect(speech, `${language}/${key}`).not.toContain('{driver}');
          expect(speech, `${language}/${key}`).not.toMatch(/^,|,\s*[.!?]|\s{2,}/);
        }
      }
    });
  });

  // Every phrase in the pool must say this, whichever one the random pick lands on.
  it.each<[LocaleCode, RadioPersona, RadioAlertCategory, RegExp]>([
    ['en', 'bono', 'safety_car', /safety car/i],
    ['es', 'colapinto', 'safety_car', /auto de seguridad/i],
    ['en', 'bono', 'vsc', /vsc|virtual safety car/i],
    ['es', 'bono', 'red_flag', /bandera roja/i],
    ['en', 'bono', 'red_flag', /red flag/i],
    ['en', 'bono', 'tyre_puncture', /puncture/i],
    ['es', 'colapinto', 'tyre_puncture', /pinchadura/i],
    ['en', 'bono', 'flags_sc_in', /safety car in this lap/i],
    ['es', 'colapinto', 'flags_green', /bandera verde/i],
    ['en', 'bono', 'flags_blue', /blue flag/i],
    ['es', 'colapinto', 'flags_yellow', /bandera amarilla/i],
    ['en', 'bono', 'pit_window_close', /closing/i],
    ['es', 'colapinto', 'teammate_doublestack', /doble parada/i],
    ['en', 'bono', 'terminal_engine', /terminal engine/i],
    ['es', 'colapinto', 'brake_bias', /freno/i],
    ['en', 'bono', 'wrong_way', /wrong way/i],
    ['en', 'colapinto', 'wrong_way', /wrong way/i],
    ['en', 'custom', 'wrong_way', /wrong way/i],
    ['en', 'bono', 'tyre_crossover_wet', /full wets/i],
    ['es', 'colapinto', 'tyre_crossover_inter', /intermedio/i],
    ['en', 'bono', 'brake_bias_ok', /balance/i],
    ['es', 'colapinto', 'fuel_mix_neutralized', /mezcla/i],
    ['en', 'bono', 'fuel_mix_restart', /mix 2/i],
    ['es', 'colapinto', 'ers_clipping', /clipping|derating/i],
    ['en', 'bono', 'tyre_set_advisory', /fresh|rubber|pit/i],
    ['en', 'bono', 'race_finish', /parc fermé/i],
    ['es', 'colapinto', 'race_finish', /parque cerrado/i],
    ['es', 'colapinto', 'inlap_traffic_behind', /lanzad/i],
    ['en', 'bono', 'inlap_cooldown', /cool/i],
    ['es', 'colapinto', 'sector_delta', /sector|parcial|tiempo/i],
    ['es', 'colapinto', 'aero_straight_anticipation', /recta|aerodinámica/i],
    ['en', 'bono', 'overtake_boost_anticipation', /override|boost/i],
    ['es', 'colapinto', 'pit_limiter_overspeed', /limitador|velocidad/i],
    ['en', 'bono', 'tyre_blistering', /blister/i],
    ['es', 'colapinto', 'tyre_pressure_high', /presión|gomas|neumáticos/i],
    ['es', 'colapinto', 'damage_gearbox_wear', /caja/i],
    ['en', 'bono', 'damage_ice_wear', /ice|combustion engine|power/i],
  ])('%s/%s %s speaks about it', (language, persona, category, pattern) => {
    for (const template of radioPhrasePool(category, language, persona)) {
      expect(template).toMatch(pattern);
    }
  });

  // F1 2026 has no DRS: the engine sends the override alerts itself, and their phrases say so.
  it.each(LOCALES)('speaks the 2026 override alerts without DRS in %s', (language) => {
    for (const key of ['rival_attack_override', 'rival_defend_override'] as const) {
      const category = RADIO_ALERT_CATEGORIES[key];
      expect(category).toBe(key);
      for (const persona of PERSONAS) {
        for (const template of radioPhrasePool(category, language, persona)) {
          expect(template, `${language}/${persona}/${key}`).not.toContain('DRS');
        }
      }
    }
  });

  describe('calls to pit', () => {
    // Calls the engine sends with a box timing: their phrases leave the timing to it.
    const BOX_CATEGORIES: RadioAlertCategory[] = [
      'tyre_puncture',
      'wing_damage',
      'tyre_crossover',
      'tyre_crossover_inter',
      'tyre_crossover_wet',
      'pit_window_open',
      'pit_window_close',
      'pit_clean_air',
      'safety_car',
      'vsc',
    ];
    const TIMINGS: EngineerBoxTiming[] = ['this_lap', 'next_lap', 'asap'];

    it.each(LOCALES)('leave out when to box in %s, so it never contradicts the timing', (language) => {
      const timingWords =
        language === 'es'
          ? /esta vuelta|pr[oó]xima vuelta|ya mismo|inmediatamente|\bahora\b.*box/i
          : /this lap|next lap|immediately|box now/i;
      for (const category of BOX_CATEGORIES) {
        for (const template of allTemplates(language, category)) {
          expect(template, `${language}/${category}`).not.toMatch(timingWords);
        }
      }
    });

    it.each(LOCALES)('have something to say for every timing and persona in %s', (language) => {
      for (const timing of TIMINGS) {
        for (const persona of PERSONAS) {
          expect(
            boxTimingPhrase('tyre_puncture', timing, language, persona),
            `${language}/${persona}/${timing}`
          ).not.toBe('');
        }
        expect(BOX_TIMING_PHRASES[language].option[timing]).toBeDefined();
      }
    });

    it('ends an order to pit with when to box', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(getProactiveRadioSpeech('tyre_puncture', 'en', 'custom', '', 'this_lap')).toBe(
        'Puncture, puncture! Bring it in carefully. Box this lap, box box.'
      );
      expect(getProactiveRadioSpeech('tyre_puncture', 'en', 'custom', '', 'next_lap')).toBe(
        'Puncture, puncture! Bring it in carefully. Too late for this pit entry. Box next lap.'
      );
      expect(getProactiveRadioSpeech('tyre_puncture', 'es', 'colapinto', '', 'asap')).toBe(
        '¡Pinchadura, pinchadura! Entrá despacito. ¡Entrá a boxes en cuanto puedas!'
      );
    });

    it('offers a Safety Car stop instead of ordering it', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(getProactiveRadioSpeech('safety_car', 'en', 'custom', '', 'this_lap')).toBe(
        'Safety Car deployed, Safety Car. Keep delta positive, stand by for the pit call. Pit entry is still on this lap.'
      );
      expect(getProactiveRadioSpeech('safety_car', 'en', 'custom', '', 'asap')).toBe(
        'Safety Car deployed, Safety Car. Keep delta positive, stand by for the pit call.'
      );
    });

    it('says nothing about timing on a call without one', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(getProactiveRadioSpeech('wing_damage', 'en', 'custom')).toBe(
        'Front wing damage detected. Downforce loss on the front axle.'
      );
    });
  });

  describe('reports', () => {
    const REPORT_KEYS = Object.keys(REPORT_PHRASES.en) as ReportPhrase[];

    it.each(LOCALES)('has every report part in %s, with only its own numbers', (language) => {
      const numbers: Partial<Record<ReportPhrase, RegExp>> = {
        position: /^[^{}]*{position}[^{}]*$/,
        ahead: /{gap}/,
        behind: /{gap}/,
      };
      for (const key of REPORT_KEYS) {
        const pool = REPORT_PHRASES[language][key];
        expect(pool.standard.length, `${language}/${key}`).toBeGreaterThan(0);
        for (const template of pool.standard) {
          const rest = template.replace(/{(position|gap|rate)}/g, '');
          expect(rest, `${language}/${key}`).not.toMatch(/[{}]/);
          if (/_(closing|opening)$/.test(key)) expect(template, `${language}/${key}`).toMatch(/{gap}.*{rate}/);
          if (/_stable$/.test(key)) expect(template, `${language}/${key}`).toContain('{gap}');
          const pattern = numbers[key];
          if (pattern) expect(template, `${language}/${key}`).toMatch(pattern);
        }
      }
    });

    it('says the position and the gaps with how they move', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(getProactiveRadioSpeech('gap_report', 'en', 'custom', '', undefined, REPORT_VALUES.gap_report)).toBe(
        'Gap report. You are P5. Gap ahead 1.4 seconds, you are gaining 0.2 a lap. Car behind at 2.0, gap is stable.'
      );
      expect(getProactiveRadioSpeech('gap_report', 'es', 'custom', '', undefined, REPORT_VALUES.gap_report)).toBe(
        'Informe de diferencias. Vas P5. Diferencia adelante 1,4 segundos, le descuentas 0,2 por vuelta. ' +
          'Auto de atrás a 2,0, la diferencia se mantiene.'
      );
    });

    it('says a gap opening, a gap without a trend yet, and the leader', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const values: DirectiveValues = {
        position: 1,
        behind: { gap_sec: 3.25, trend: 'opening', per_lap_sec: 0.4 },
      };
      expect(getProactiveRadioSpeech('gap_report', 'en', 'custom', 'Franco', undefined, values)).toBe(
        'Franco, Gap report. You are leading. Car behind at 3.3, you are pulling away 0.4 a lap.'
      );
      expect(
        getProactiveRadioSpeech('gap_report', 'en', 'custom', '', undefined, {
          position: 4,
          ahead: { gap_sec: 0.9 },
        })
      ).toBe('Gap report. You are P4. Gap ahead 0.9 seconds.');
    });

    it('says when nobody is close', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(getProactiveRadioSpeech('gap_report', 'es', 'bono', '', undefined, { position: 7 })).toBe(
        'Te paso las diferencias. Vas P7. Nadie a menos de diez segundos.'
      );
    });

    it('says how many laps the tyres have left', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(getProactiveRadioSpeech('tyre_life', 'en', 'custom', '', undefined, { tyre_laps_left: 6 })).toBe(
        'About 6 laps left on these tyres.'
      );
      expect(getProactiveRadioSpeech('tyre_life', 'es', 'bono', 'Franco', undefined, { tyre_laps_left: 3 })).toBe(
        'Quedan unas 3 vueltas en estos neumáticos, Franco.'
      );
      expect(getProactiveRadioSpeech('tyre_life', 'en', 'bono', '', undefined, { tyre_laps_left: 1 })).toBe(
        'About one lap left on these tyres.'
      );
      expect(getProactiveRadioSpeech('tyre_life_end', 'en', 'custom')).toBe(
        'These tyres will make the end of the race. Keep managing them.'
      );
    });

    it('says nothing without its numbers', () => {
      expect(getProactiveRadioSpeech('gap_report', 'en', 'custom')).toBe('');
      expect(getProactiveRadioSpeech('tyre_life', 'en', 'custom', 'Franco', undefined, {})).toBe('');
    });

    it("writes numbers the listener's way", () => {
      expect(formatTenths(1.4, 'en')).toBe('1.4');
      expect(formatTenths(1.4, 'es')).toBe('1,4');
      expect(formatTenths(12, 'es')).toBe('12,0');
      expect(formatThousandths(0.088, 'en')).toBe('0.088');
      expect(formatThousandths(0.345, 'es')).toBe('0,345');
    });
  });

  describe('qualifying', () => {
    it('says the gap to a car on a push lap behind, and to traffic ahead', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(
        getProactiveRadioSpeech('inlap_traffic_behind', 'en', 'custom', '', undefined, { behind: { gap_sec: 2.3 } })
      ).toBe('Car behind on a push lap, 2.3 seconds. Give way.');
      expect(
        getProactiveRadioSpeech('qualy_traffic_ahead', 'es', 'custom', '', undefined, { ahead: { gap_sec: 3.1 } })
      ).toBe('Auto lento por delante a 3,1 segundos. No está en vuelta rápida.');
    });

    it('says a phrase without the number when the call has none', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(getProactiveRadioSpeech('inlap_traffic_behind', 'en', 'custom', 'Franco')).toBe(
        'Car behind on a push lap, Franco. Give way safely.'
      );
    });

    it('says the minutes left, but not "1 minutes"', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(getProactiveRadioSpeech('qualy_session_time_garage', 'en', 'custom', '', undefined, { minutes: 3 })).toBe(
        'Under 3 minutes left. Time to go out for the final run.'
      );
      expect(getProactiveRadioSpeech('qualy_session_time', 'en', 'custom', '', undefined, { minutes: 1 })).toBe(
        'Clock is running down. Make sure you cross the line before the flag.'
      );
    });

    it('says the lap result with the gap to P1 and the cut line', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(
        getProactiveRadioSpeech('qualy_lap_result', 'en', 'custom', '', undefined, {
          position: 17,
          pole_gap_sec: 1.234,
          elimination: 'drop_zone',
        })
      ).toBe('P17, 1.234 off P1. That is in the drop zone.');
      expect(getProactiveRadioSpeech('qualy_lap_result', 'es', 'custom', '', undefined, { position: 6 })).toBe(
        'Eso te pone P6.'
      );
      expect(
        getProactiveRadioSpeech('qualy_lap_pole', 'es', 'colapinto', 'Franco', undefined, {
          position: 1,
          pole_gap_sec: 0.088,
        })
      ).toBe('¡Pole provisional, Franco! P1 por 0,088.');
      expect(
        getProactiveRadioSpeech('qualy_lap_no_improvement', 'en', 'bono', '', undefined, {
          position: 16,
          elimination: 'last_through',
        })
      ).toBe('No improvement on that one. Still P16. Last car through, not safe yet.');
    });
  });

  it('addresses the driver by callsign', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const speech = getProactiveRadioSpeech('safety_car', 'es', 'colapinto', ' Franco ');
    expect(speech).toContain('Franco');
    expect(speech).not.toContain('{driver}');
  });
});
