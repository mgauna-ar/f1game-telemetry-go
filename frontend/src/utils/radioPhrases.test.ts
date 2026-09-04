import { describe, it, expect } from 'vitest';
import {
  detectAlertCategory,
  getProactiveRadioSpeech,
  RADIO_PHRASE_CATALOG,
} from './radioPhrases';

describe('radioPhrases', () => {
  describe('detectAlertCategory', () => {
    it('detects safety car scenarios correctly', () => {
      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Full Safety Car deployed! Maintain delta positive.]')
      ).toBe('safety_car');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Virtual Safety Car (VSC) deployed!]')
      ).toBe('vsc');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Red Flag deployed! Session stopped.]')
      ).toBe('red_flag');
    });

    it('detects tyre wear and puncture scenarios', () => {
      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Critical tyre puncture on car! Wear is at 98%.]')
      ).toBe('tyre_puncture');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Tyre wear is at 45%. Focus on smooth traction.]')
      ).toBe('tyre_wear');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Tyre surface temperature is critically high (118°C)!]')
      ).toBe('tyre_overheat');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Tyres are cold (65°C)! Weave before restart.]')
      ).toBe('tyre_cold');
    });

    it('detects damage, powertrain, and DRS scenarios', () => {
      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Front wing flap damage detected. Expect understeer.]')
      ).toBe('wing_damage');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Floor and diffuser downforce loss (18%).]')
      ).toBe('floor_damage');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: ERS battery reserve is low (<15%).]')
      ).toBe('ers_low');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Hybrid ERS deployment failure detected on power unit! Electric boost offline.]')
      ).toBe('ers_fault');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Terminal engine failure! Pull off line into a safe area, switch off the power unit immediately.]')
      ).toBe('terminal_engine');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Front brakes are running excessively hot relative to the rears (850°C vs 400°C). Move brake bias rearward by 1-2%.]')
      ).toBe('brake_bias');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Active Aero flap fault detected! Straight mode unavailable.]')
      ).toBe('aero_fault');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Rival behind within 1.0s behind with DRS active.]')
      ).toBe('rival_defend');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Rival within 1.0s ahead in DRS range. Attack now.]')
      ).toBe('rival_attack');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: We are catching car ahead (P2), gap is 0.8s. Prepare overtake using Straight Mode and Boost deployment.]')
      ).toBe('rival_attack');
    });

    it('detects coaching, teammate, and pit strategy scenarios', () => {
      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Sector 1 Delta — Time lost in Sector 1 (+0.42s vs personal best). Focus on apex speed.]')
      ).toBe('sector_delta');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Teammate Ahead — Teammate is P2, 1.4s ahead. Free to race.]')
      ).toBe('teammate_ahead');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Teammate Pitting — Teammate in P2 is pitting now.]')
      ).toBe('teammate_pitting');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Teammate is currently in the pit box! Stand by for double-stack pit stop, expect a brief hold.]')
      ).toBe('teammate_doublestack');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Clean Air Pit Window — Pit window offers clean air on rejoin.]')
      ).toBe('pit_clean_air');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Pit stop window is now open (Lap 14). Stand by for box call.]')
      ).toBe('pit_window_open');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Box this lap, box box! Pit stop window is closing on lap 18 - box now to protect tyre performance.]')
      ).toBe('pit_window_close');
    });

    it('detects qualifying and race control scenarios', () => {
      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Lap deleted for track limits! Recharge ERS.]')
      ).toBe('qualy_deleted_lap');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Driver has accumulated 3 track limits / corner cutting warnings!]')
      ).toBe('track_limits_warnings');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Driver has been assessed a 5-second time penalty by the stewards!]')
      ).toBe('penalties_incurred');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Weather radar confirms 85% chance of rain in 2 minutes!]')
      ).toBe('weather_rain');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Weather Transition — Radar confirms 70% rain in 5 minutes.]')
      ).toBe('weather_rain');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Rain is now falling on track! Watch out for changing grip levels into braking zones.]')
      ).toBe('flags_rain_live');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Track conditions are too wet for slick tyres! Box now, box box for Intermediates.]')
      ).toBe('tyre_crossover');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Safety Car in this lap, Safety Car in this lap! Maintain delta positive, warm front tyres and prepare for restart.]')
      ).toBe('flags_sc_in');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Green flag, green flag! Race is resumed, push now.]')
      ).toBe('flags_green');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Blue flags! Leader is approaching from behind, yield position cleanly.]')
      ).toBe('flags_blue');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Yellow flag in this sector. Incident ahead, no overtaking and be prepared to lift.]')
      ).toBe('flags_yellow');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Warning! You are driving the wrong way! Turn around or stop immediately.]')
      ).toBe('wrong_way');
    });
  });

  describe('getProactiveRadioSpeech', () => {
    it('formats safety car in this lap and green flag restarts', () => {
      const speechSCIn = getProactiveRadioSpeech(
        { category: 'flags_sc_in' },
        'en',
        'bono',
        'Lewis'
      );
      expect(speechSCIn.toLowerCase()).toContain('safety car in this lap');

      const speechGreen = getProactiveRadioSpeech(
        { category: 'flags_green' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(speechGreen.toLowerCase()).toContain('bandera verde');

      const speechBlue = getProactiveRadioSpeech(
        { category: 'flags_blue' },
        'en',
        'bono',
        'Lewis'
      );
      expect(speechBlue.toLowerCase()).toContain('blue flag');

      const speechYellow = getProactiveRadioSpeech(
        { category: 'flags_yellow' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(speechYellow.toLowerCase()).toContain('bandera amarilla');

      const speechPitClose = getProactiveRadioSpeech(
        { category: 'pit_window_close' },
        'en',
        'bono',
        'Lewis'
      );
      expect(speechPitClose.toLowerCase()).toContain('closing');

      const speechDoubleStack = getProactiveRadioSpeech(
        { category: 'teammate_doublestack' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(speechDoubleStack.toLowerCase()).toContain('doble parada');

      const speechTerminal = getProactiveRadioSpeech(
        { category: 'terminal_engine' },
        'en',
        'bono',
        'Lewis'
      );
      expect(speechTerminal.toLowerCase()).toContain('terminal engine');

      const speechBrakeBias = getProactiveRadioSpeech(
        { category: 'brake_bias' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(speechBrakeBias.toLowerCase()).toContain('freno');

      const speechWrongWay = getProactiveRadioSpeech(
        { category: 'wrong_way' },
        'en',
        'bono',
        'Lewis'
      );
      expect(speechWrongWay.toLowerCase()).toContain('wrong way');
    });

    it('formats safety car with Bono persona and English callsign', () => {
      const prompt = '[PROACTIVE PIT WALL CALL: Full Safety Car deployed! Maintain delta positive.]';
      const speech = getProactiveRadioSpeech(prompt, 'en', 'bono', 'Lewis');
      expect(speech).toContain('Safety Car');
      expect(speech).toContain('Lewis');
    });

    it('handles generic server-side directives cleanly as fallback', () => {
      const prompt = '[PROACTIVE PIT WALL CALL: Track condition improving in sector 2. Push now.]';
      const speech = getProactiveRadioSpeech(prompt, 'en', 'bono', 'Lewis');
      expect(speech).toContain('Lewis');
      expect(speech).toContain('Track condition improving in sector 2. Push now.');
    });

    it('formats race finish cleanly with parc fermé instructions', () => {
      const speechEn = getProactiveRadioSpeech(
        { category: 'race_finish', message: 'Chequered flag! P3 finish.' },
        'en',
        'bono',
        'George'
      );
      expect(speechEn.toLowerCase()).toContain('parc fermé');
      expect(speechEn).toContain('George');

      const speechEs = getProactiveRadioSpeech(
        { category: 'race_finish', message: '¡Bandera a cuadros! Terminamos P2.' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(speechEs.toLowerCase()).toContain('parque cerrado');
      expect(speechEs).toContain('Franco');
    });

    it('formats in-lap cooldown and traffic behind without race tactics', () => {
      const trafficSpeech = getProactiveRadioSpeech(
        { category: 'inlap_traffic_behind', message: 'Fast car approaching on flying lap behind' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(trafficSpeech.toLowerCase()).toContain('lanzado');

      const cooldownSpeech = getProactiveRadioSpeech(
        { category: 'inlap_cooldown', message: 'Flying lap completed, box this lap.' },
        'en',
        'bono',
        'Lewis'
      );
      expect(cooldownSpeech.toLowerCase()).toContain('box');
      expect(cooldownSpeech.toLowerCase()).toContain('cool');
    });

    it('eradicates the word DRS for F1 2026 Override and Boost speech', () => {
      const defend2026 = getProactiveRadioSpeech(
        {
          category: 'rival_defend',
          message: 'Defend! Car behind (P2) is within Override/Boost attack threat (0.8s gap).',
          metadata: { is_2026: true },
        },
        'es',
        'colapinto',
        'Franco'
      );
      expect(defend2026).not.toContain('DRS');
      expect(defend2026.toLowerCase()).toContain('override');

      const attack2026 = getProactiveRadioSpeech(
        {
          category: 'rival_attack',
          message: 'We are catching car ahead. Prepare overtake using Straight Mode and Boost deployment.',
          metadata: { is_2026: true },
        },
        'en',
        'bono',
        'Lando'
      );
      expect(attack2026).not.toContain('DRS');
      expect(attack2026).toContain('Straight Mode');
    });

    it('formats safety car with Franco Colapinto persona and Spanish callsign', () => {
      const prompt = '[PROACTIVE PIT WALL CALL: Full Safety Car deployed! Maintain delta positive.]';
      const speech = getProactiveRadioSpeech(prompt, 'es', 'colapinto', 'Franco');
      expect(speech.toLowerCase()).toContain('auto de seguridad');
      expect(speech).toContain('Franco');
      expect(speech.toLowerCase()).toContain('delta');
    });

    it('formats punctures cleanly without driver callsign if not specified', () => {
      const prompt = '[PROACTIVE PIT WALL CALL: Critical tyre puncture on car! Box immediately.]';
      const speech = getProactiveRadioSpeech(prompt, 'es', 'colapinto');
      expect(speech.toLowerCase()).toContain('pinchazo');
      expect(speech).not.toContain('{driver}');
    });

    it('formats sector delta coaching authentically', () => {
      const directive = '[PROACTIVE PIT WALL CALL: Sector 1 Delta — Time lost in Sector 1 (+0.42s). Focus on apex speed. You are initiating this call — do NOT say "Entendido" or "Copy".]';
      const speech = getProactiveRadioSpeech(directive, 'es', 'colapinto', 'Franco');
      expect(speech).toContain('Franco');
      expect(speech.toLowerCase()).toMatch(/sector|parcial|tiempo/i);
      expect(speech).not.toContain('You are initiating this call');
    });

    it('processes structured RadioAlertPayload directly without regex parsing', () => {
      const payload: import('../types/telemetry').RadioAlertPayload = {
        category: 'safety_car',
        isCritical: true,
        message: 'Full Safety Car deployed! Maintain delta.',
      };
      const speech = getProactiveRadioSpeech(payload, 'es', 'colapinto', 'Franco');
      expect(speech.toLowerCase()).toContain('auto de seguridad');
      expect(speech).toContain('Franco');

      const tyrePayload: import('../types/telemetry').RadioAlertPayload = {
        category: 'tyre_puncture',
        isCritical: true,
        message: 'Critical tyre puncture!',
      };
      const tyreSpeech = getProactiveRadioSpeech(tyrePayload, 'en', 'bono', 'Lewis');
      expect(tyreSpeech.toLowerCase()).toContain('puncture');
      expect(tyreSpeech).toContain('Lewis');
    });

    it('handles generic server-side directives cleanly as fallback', () => {
      const customDirective = '[PROACTIVE PIT WALL CALL: General Pit Alert — Green green green. You are initiating this call — do NOT say "Entendido" or "Copy".]';
      const speech = getProactiveRadioSpeech(customDirective, 'es', 'bono', 'Driver');
      expect(speech).toContain('Driver, General Pit Alert — Green green green.');
      expect(speech).not.toContain('You are initiating this call');
    });
  });

  describe('RADIO_PHRASE_CATALOG completeness', () => {
    it('has standard phrase pools for all categories in Spanish and English locales', () => {
      const esCategories = Object.keys(RADIO_PHRASE_CATALOG.es) as (keyof typeof RADIO_PHRASE_CATALOG.es)[];
      const enCategories = Object.keys(RADIO_PHRASE_CATALOG.en) as (keyof typeof RADIO_PHRASE_CATALOG.en)[];
      expect(esCategories.length).toBeGreaterThanOrEqual(30);
      expect(enCategories.length).toBeGreaterThanOrEqual(30);

      for (const cat of esCategories) {
        expect(RADIO_PHRASE_CATALOG.es[cat].standard.length).toBeGreaterThan(0);
      }
      for (const cat of enCategories) {
        expect(RADIO_PHRASE_CATALOG.en[cat].standard.length).toBeGreaterThan(0);
      }
    });
  });
});
