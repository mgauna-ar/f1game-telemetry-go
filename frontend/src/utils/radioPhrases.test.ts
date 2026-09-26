import { describe, it, expect, vi, afterEach } from 'vitest';
import { getProactiveRadioSpeech, radioPhrasePool, RADIO_PHRASE_CATALOG } from './radioPhrases';
import { RADIO_ALERT_CATEGORIES } from '../constants/radioAlertCategories';
import type { RadioPersona } from '../constants/f1';
import type { LocaleCode } from '../locales';
import type { EngineerAlertKey, RadioAlertCategory } from '../types/telemetry';

const LOCALES: LocaleCode[] = ['en', 'es'];
const PERSONAS: RadioPersona[] = ['bono', 'colapinto', 'custom'];
const ALERT_KEYS = Object.keys(RADIO_ALERT_CATEGORIES) as EngineerAlertKey[];

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

    it('only uses the {driver} placeholder', () => {
      for (const category of Object.keys(RADIO_PHRASE_CATALOG[language]) as RadioAlertCategory[]) {
        for (const template of allTemplates(language, category)) {
          expect(template.replace(/{driver}/g, ''), `${language}/${category}`).not.toMatch(/[{}]/);
        }
      }
    });

    it('drops {driver} cleanly when there is no callsign', () => {
      for (const key of ALERT_KEYS) {
        const category = RADIO_ALERT_CATEGORIES[key];
        for (let i = 0; i < radioPhrasePool(category, language, 'bono').length; i++) {
          vi.spyOn(Math, 'random').mockReturnValueOnce(i / radioPhrasePool(category, language, 'bono').length);
          const speech = getProactiveRadioSpeech(category, language, 'bono');
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

  it('addresses the driver by callsign', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const speech = getProactiveRadioSpeech('safety_car', 'es', 'colapinto', ' Franco ');
    expect(speech).toContain('Franco');
    expect(speech).not.toContain('{driver}');
  });
});
