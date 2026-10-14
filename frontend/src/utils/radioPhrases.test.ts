import { describe, it, expect } from 'vitest';
import {
  addressDriver,
  boxTimingPool,
  callFacts,
  createRadioPhrasePicker,
  formatHundredths,
  formatTenths,
  formatThousandths,
  EXCHANGE_PHRASES,
  mostInformative,
  radioPhrasePool,
  REPORT_PHRASES,
  type ProactiveSpeechOptions,
} from './radioPhrases';
import { RADIO_PHRASE_CONSTANTS, type RadioPersona } from '../constants/f1';
import type { LocaleCode } from '../locales';
import type { DirectiveValues, RadioAlertCategory, ReportPhrase } from '../types/telemetry';

/** A repeatable stand-in for Math.random. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** Every line `category` can say with these values, filled, before any box timing. */
function lines(category: RadioAlertCategory, language: LocaleCode, persona: RadioPersona, values?: DirectiveValues) {
  const facts = callFacts(values, language);
  return mostInformative(radioPhrasePool(category, language, persona), facts).map((template) =>
    addressDriver(template.replace(/{(\w+)}/g, (m, key: string) => (key === 'driver' ? m : (facts[key] ?? m))))
  );
}

const reportLines = (key: ReportPhrase, language: LocaleCode, numbers: Record<string, string> = {}) =>
  REPORT_PHRASES[language][key].standard.map((t) => t.replace(/{(\w+)}/g, (m, k: string) => numbers[k] ?? m));

describe('the radio phrase picker', () => {
  const quiet: ProactiveSpeechOptions = { language: 'en', persona: 'custom', urgent: true };

  it('goes round every line before saying one again, and never says one twice in a row', () => {
    const picker = createRadioPhrasePicker(seeded(7));
    const pool = lines('tyre_cold', 'en', 'custom');
    expect(pool.length).toBeGreaterThan(2);

    const said = Array.from({ length: pool.length * 4 }, () => picker.proactive('tyre_cold', quiet));
    for (let round = 0; round < 4; round++) {
      const lap = said.slice(round * pool.length, (round + 1) * pool.length);
      expect([...lap].sort(), `round ${round}`).toEqual([...pool].sort());
    }
    said.slice(1).forEach((line, i) => expect(line, `call ${i + 1}`).not.toBe(said[i]));
  });

  it('draws its order from the randomness it is given', () => {
    const run = (seed: number) => {
      const picker = createRadioPhrasePicker(seeded(seed));
      return Array.from({ length: 8 }, () => picker.proactive('flags_blue', quiet));
    };
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(11));
  });

  it('keeps a bag per language, persona and call', () => {
    const picker = createRadioPhrasePicker(seeded(5));
    const en = lines('tyre_overheat', 'en', 'bono');
    const said = new Set<string>();
    for (let i = 0; i < en.length; i++) {
      said.add(picker.proactive('tyre_overheat', { ...quiet, persona: 'bono' }));
      // Other calls in between don't touch this call's round.
      picker.proactive('tyre_overheat', { ...quiet, language: 'es', persona: 'bono' });
      picker.proactive('tyre_overheat', { ...quiet, persona: 'colapinto' });
      picker.proactive('brake_cold', { ...quiet, persona: 'bono' });
    }
    expect([...said].sort()).toEqual([...en].sort());
  });

  describe("says the call's values", () => {
    it('in the lines that say the most of them', () => {
      const picker = createRadioPhrasePicker(seeded(1));
      const closing: DirectiveValues = { ahead: { gap_sec: 0.9, trend: 'closing', per_lap_sec: 0.3 } };
      const opening: DirectiveValues = { ahead: { gap_sec: 0.9, trend: 'opening', per_lap_sec: 0.2 } };
      for (let i = 0; i < 6; i++) {
        const catching = picker.proactive('rival_attack', { ...quiet, values: closing });
        expect(lines('rival_attack', 'en', 'custom', closing)).toContain(catching);
        expect(catching).toMatch(/0\.9.*0\.3|0\.3.*0\.9/);
        const holding = picker.proactive('rival_attack', { ...quiet, values: opening });
        expect(lines('rival_attack', 'en', 'custom', opening)).toContain(holding);
        expect(holding).toContain('0.9');
        expect(holding).not.toContain('0.2');
      }
    });

    it("with the wheel, axle and tyre in the listener's words", () => {
      const picker = createRadioPhrasePicker(seeded(2));
      const wear: DirectiveValues = { wheel: 'rear_left', pct: 52 };
      expect(picker.proactive('tyre_wear', { ...quiet, values: wear })).toMatch(/rear left.*52|52.*rear left/);
      expect(picker.proactive('tyre_wear', { ...quiet, language: 'es', values: wear })).toMatch(
        /trasera izquierda.*52|52.*trasera izquierda/
      );
      expect(picker.proactive('tyre_pressure_high', { ...quiet, values: { axle: 'rear' } })).toContain('rear');
      expect(picker.proactive('tyre_pressure_high', { ...quiet, language: 'es', values: { axle: 'front' } })).toContain(
        'eje delantero'
      );
      expect(
        picker.proactive('tyre_set_advisory', { ...quiet, language: 'es', values: { compound: 'hard' } })
      ).toContain('duras');
      expect(picker.proactive('sector_delta', { ...quiet, values: { sector: 2, delta_sec: 0.42 } })).toMatch(
        /2.*0\.4|0\.4.*2/
      );
    });

    it('falls back to a line without values when the call comes without them', () => {
      const picker = createRadioPhrasePicker(seeded(3));
      const speech = picker.proactive('tyre_wear', quiet);
      expect(lines('tyre_wear', 'en', 'custom')).toContain(speech);
      expect(speech).not.toMatch(/[{}]/);
    });

    it("writes them the listener's way", () => {
      expect(formatTenths(1.4, 'en')).toBe('1.4');
      expect(formatTenths(1.4, 'es')).toBe('1,4');
      expect(formatTenths(12, 'es')).toBe('12,0');
      expect(formatHundredths(0.214, 'es')).toBe('0,21');
      expect(formatThousandths(0.088, 'en')).toBe('0.088');
      expect(formatThousandths(0.345, 'es')).toBe('0,345');
      expect(
        callFacts(
          {
            fuel_delta_laps: -0.64,
            reaction_sec: 0.2,
            minutes: 1,
            rain_pct: 60,
            wheel: 'front_right',
            compound: 'wet',
          },
          'es'
        )
      ).toEqual({
        fuel_laps: '0,6',
        reaction: '0,20',
        rain_pct: '60',
        wheel: 'delantera derecha',
        compound: 'de lluvia',
      });
      // A fuel delta that rounds to nothing, and a gap that isn't closing, aren't said.
      expect(callFacts({ fuel_delta_laps: -0.04, behind: { gap_sec: 0.7, trend: 'stable' } }, 'en')).toEqual({
        gap: '0.7',
      });
    });
  });

  describe("the driver's callsign", () => {
    it('is said on every urgent call', () => {
      const picker = createRadioPhrasePicker(seeded(4));
      for (let i = 0; i < 6; i++) {
        expect(picker.proactive('safety_car', { ...quiet, callsign: 'Franco' })).toContain('Franco');
      }
    });

    it(`is said once every ${RADIO_PHRASE_CONSTANTS.CALLSIGN_ROUTINE_EVERY} routine calls, urgent ones apart`, () => {
      const picker = createRadioPhrasePicker(seeded(4));
      const routine = { language: 'en', persona: 'custom', callsign: 'Franco' } as const;
      const said = [
        picker.proactive('tyre_cold', routine),
        picker.proactive('flags_blue', { ...routine, urgent: true }),
        ...Array.from({ length: 8 }, () => picker.proactive('brake_cold', routine)),
      ].map((speech) => speech.includes('Franco'));
      // Routine calls 1, 5 and 9; the urgent one in between doesn't count.
      expect(said).toEqual([true, true, false, false, false, true, false, false, false, true]);
    });

    it('goes away cleanly when it is not said', () => {
      expect(addressDriver('{driver}, the car behind is close.')).toBe('The car behind is close.');
      expect(addressDriver('¡{driver}, dale que se puede!')).toBe('¡Dale que se puede!');
      expect(addressDriver('Push now, {driver}.')).toBe('Push now.');
      expect(addressDriver('{driver}, the car behind is close.', 'Franco')).toBe('Franco, the car behind is close.');
      expect(addressDriver('Box now.', ' Franco ')).toBe('Franco, box now.');
      expect(addressDriver('¡Modo recta en camino!', 'Franco')).toBe('Franco, ¡modo recta en camino!');
      expect(addressDriver('El radar marca lluvia.', 'Franco')).toBe('Franco, el radar marca lluvia.');
      // Names and acronyms keep their capitals.
      expect(addressDriver('Safety Car deployed.', 'Franco')).toBe('Franco, Safety Car deployed.');
      expect(addressDriver('VSC, VSC.', 'Franco')).toBe('Franco, VSC, VSC.');
      expect(addressDriver('P5 at the flag.', 'Franco')).toBe('Franco, P5 at the flag.');
      expect(addressDriver('Override zone ahead.', 'Franco')).toBe('Franco, Override zone ahead.');
      expect(addressDriver('I see it.', 'Franco')).toBe('Franco, I see it.');
      expect(addressDriver('A car has retired.', 'Franco')).toBe('Franco, a car has retired.');
    });

    it('leaves no trace when it is not said', () => {
      const picker = createRadioPhrasePicker(seeded(9));
      for (let i = 0; i < 12; i++) {
        const speech = picker.proactive('tyre_cold', { language: 'es', persona: 'colapinto', callsign: 'Franco' });
        expect(speech).not.toMatch(/{driver}|^,|,\s*[.!?]|\s{2,}/);
      }
    });
  });

  describe('calls to pit', () => {
    it('end an order to pit with when to box', () => {
      const picker = createRadioPhrasePicker(seeded(6));
      for (const box of ['this_lap', 'next_lap', 'asap'] as const) {
        const values: DirectiveValues = { wheel: 'rear_left' };
        const speech = picker.proactive('tyre_puncture', { ...quiet, box, values });
        const head = lines('tyre_puncture', 'en', 'custom', values).find((line) => speech.startsWith(`${line} `));
        expect(head, speech).toBeDefined();
        expect(boxTimingPool('tyre_puncture', box, 'en', 'custom')).toContain(speech.slice(head!.length + 1));
      }
    });

    it('offer a Safety Car stop instead of ordering it, and say nothing more when it can be any time', () => {
      const picker = createRadioPhrasePicker(seeded(6));
      const speech = picker.proactive('safety_car', { ...quiet, box: 'this_lap' });
      const head = lines('safety_car', 'en', 'custom').find((line) => speech.startsWith(`${line} `));
      expect(boxTimingPool('safety_car', 'this_lap', 'en', 'custom')).toContain(speech.slice(head!.length + 1));
      expect(boxTimingPool('safety_car', 'this_lap', 'en', 'custom')).not.toEqual(
        boxTimingPool('tyre_puncture', 'this_lap', 'en', 'custom')
      );
      expect(lines('safety_car', 'en', 'custom')).toContain(picker.proactive('safety_car', { ...quiet, box: 'asap' }));
    });

    it("say the game's planned stop with where we rejoin", () => {
      const picker = createRadioPhrasePicker(seeded(8));
      expect(picker.proactive('pit_plan_next_lap', { ...quiet, values: { position: 9 } })).toContain('P9');
    });
  });

  describe('reports', () => {
    it('say the position and the gaps with how they move', () => {
      const picker = createRadioPhrasePicker(seeded(10));
      const values: DirectiveValues = {
        position: 5,
        ahead: { gap_sec: 1.4, trend: 'closing', per_lap_sec: 0.2 },
        behind: { gap_sec: 2, trend: 'stable' },
      };
      const speech = picker.proactive('gap_report', { ...quiet, language: 'es', values });
      const opener = radioPhrasePool('gap_report', 'es', 'custom').find((t) =>
        speech.startsWith(`${addressDriver(t)} `)
      );
      expect(opener, speech).toBeDefined();
      const body = speech.slice(addressDriver(opener!).length + 1);
      const parts = [
        reportLines('position', 'es', { position: '5' }),
        reportLines('ahead_closing', 'es', { gap: '1,4', rate: '0,2' }),
        reportLines('behind_stable', 'es', { gap: '2,0' }),
      ];
      expect(
        parts[0].some((p) => body.startsWith(p)),
        body
      ).toBe(true);
      expect(
        parts[1].some((p) => body.includes(p)),
        body
      ).toBe(true);
      expect(
        parts[2].some((p) => body.endsWith(p)),
        body
      ).toBe(true);
    });

    it('say the leader and when nobody is close', () => {
      const picker = createRadioPhrasePicker(seeded(10));
      const leading = picker.proactive('gap_report', { ...quiet, values: { position: 1 } });
      expect(
        reportLines('leading', 'en').some((p) => leading.includes(p)),
        leading
      ).toBe(true);
      expect(
        reportLines('nobody_close', 'en').some((p) => leading.endsWith(p)),
        leading
      ).toBe(true);
    });

    it('say how many laps the tyres have left, one lap its own way', () => {
      const picker = createRadioPhrasePicker(seeded(12));
      const values: DirectiveValues = { tyre_laps_left: 6, wheel: 'front_left' };
      expect(lines('tyre_life', 'en', 'custom', values)).toContain(picker.proactive('tyre_life', { ...quiet, values }));
      const lastLap = picker.proactive('tyre_life', { ...quiet, values: { tyre_laps_left: 1, wheel: 'front_left' } });
      expect(reportLines('tyre_life_one_lap', 'en', { wheel: 'front left' })).toContain(lastLap);
      expect(lastLap).toContain('front left');
    });

    it('end a lap result with where it stands against the cut line', () => {
      const picker = createRadioPhrasePicker(seeded(13));
      const speech = picker.proactive('qualy_lap_result', {
        ...quiet,
        values: { position: 17, pole_gap_sec: 1.234, elimination: 'drop_zone' },
      });
      expect(speech).toMatch(/17.*1\.234/);
      expect(
        reportLines('elimination_drop_zone', 'en').some((p) => speech.endsWith(` ${p}`)),
        speech
      ).toBe(true);
    });

    it('say nothing without their numbers', () => {
      const picker = createRadioPhrasePicker();
      expect(picker.proactive('gap_report', quiet)).toBe('');
      expect(picker.proactive('tyre_life', { ...quiet, values: {} })).toBe('');
    });
  });

  describe("the engineer's own lines in a push-to-talk exchange", () => {
    it('always address the driver, in the radio language, without repeating', () => {
      const picker = createRadioPhrasePicker(seeded(14));
      for (const language of ['en', 'es'] as const) {
        const pool = EXCHANGE_PHRASES[language].say_again.colapinto!.map((t) => addressDriver(t, 'Franco'));
        const said = Array.from({ length: 6 }, () => picker.exchange('say_again', language, 'colapinto', 'Franco'));
        said.forEach((line) => expect(pool).toContain(line));
        said.slice(1).forEach((line, i) => expect(line).not.toBe(said[i]));
      }
      expect(picker.exchange('stand_by', 'en', 'bono', '')).not.toMatch(/[{}]|^,/);
    });
  });
});
