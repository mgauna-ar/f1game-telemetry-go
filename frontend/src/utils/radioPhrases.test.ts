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

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: DRS enabled, DRS is now active.]')
      ).toBe('flags_drs_enabled');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: DRS disabled due to Safety Car.]')
      ).toBe('flags_drs_disabled');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Contact reported! Check steering and front wing balance.]')
      ).toBe('car_collision');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Teammate Car 5 has retired from the race.]')
      ).toBe('car_retirement');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Fastest lap of the session! Purple in all sectors, lap time 84.120.]')
      ).toBe('race_fastest_lap');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Formation lap. Weave to put heat into the tyre carcasses and warm the front brakes.]')
      ).toBe('formation_lap_start');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Approaching the grid. Line up carefully in your box and find the clutch bite point.]')
      ).toBe('grid_approach');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Great launch! Reaction time 0.21s, excellent start.]')
      ).toBe('start_reaction_time');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Hold for 5-second penalty before tyres are changed.]')
      ).toBe('pit_serve_penalty');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Rapid stop! Stationary time was 2.4s, brilliant work by the crew.]')
      ).toBe('pit_stop_duration');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Pit limiter off. Mind the white line on exit and push now.]')
      ).toBe('pit_limiter_exit');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Track is saturated with standing water, aquaplaning risk! Box this lap for Full Wets.]')
      ).toBe('tyre_crossover_wet');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Rain has eased up and standing water is clearing. Intermediate tyre is much faster now, box for Inters.]')
      ).toBe('tyre_crossover_inter');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Brake temperatures are equalized, axle thermal balance is restored.]')
      ).toBe('brake_bias_ok');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Safety car deployed. Switch fuel mix to Lean / Mix 1 to conserve fuel and manage engine temperatures.]')
      ).toBe('fuel_mix_neutralized');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Track is green! Restore fuel mix to Race Mix 2.]')
      ).toBe('fuel_mix_restart');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Clipping, clipping! Maximum per-lap ERS deployment reached. Battery boost is depleted until the finish line.]')
      ).toBe('ers_clipping');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Pit window approaching. Available fresh set: HARD tyres (0% wear).]')
      ).toBe('tyre_set_advisory');

      // Phase 6: Active Aero & Override Anticipation, Pit Limiter Overspeed, Blisters & Pressures, Differentiated Damage
      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Straight Mode zone in 100 metres! Prepare to activate low-drag aero on corner exit.]')
      ).toBe('aero_straight_anticipation');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Override zone ahead in 100 metres! Ready on the boost button.]')
      ).toBe('overtake_boost_anticipation');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Speed limiter! Drop speed, pit limiter line approaching! Pit limit is 80 km/h!]')
      ).toBe('pit_limiter_overspeed');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Tyre blistering detected on the Front Left tyre (42% blister)! Back off lateral loads and avoid aggressive curb strikes.]')
      ).toBe('tyre_blistering');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Front Left tyre pressure is spiking (26.2 PSI)! Manage corner entry scrub to prevent crowning the contact patch.]')
      ).toBe('tyre_pressure_high');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Front axle tyre pressure disparity is high (26.0 vs 24.1 PSI). Balance cornering load.]')
      ).toBe('tyre_pressure_high');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Gearbox damage reached 74%! Expect delayed gear shifts and torque sync dropouts.]')
      ).toBe('damage_gearbox_wear');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Internal Combustion Engine (ICE) wear at 78%! Expect top-end power loss on the straights.]')
      ).toBe('damage_ice_wear');
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

      // Ensure every phrase template in wrong_way contains expected keywords regardless of random choice
      for (const phrase of RADIO_PHRASE_CATALOG.en.wrong_way.bono) {
        expect(phrase.toLowerCase()).toContain('wrong way');
      }
      for (const phrase of RADIO_PHRASE_CATALOG.en.wrong_way.colapinto) {
        expect(phrase.toLowerCase()).toContain('wrong way');
      }
      for (const phrase of RADIO_PHRASE_CATALOG.en.wrong_way.standard) {
        expect(phrase.toLowerCase()).toContain('wrong way');
      }
    });

    it('formats Phase 5 cockpit dials, crossovers, and tyre advisories', () => {
      const speechWet = getProactiveRadioSpeech(
        { category: 'tyre_crossover_wet' },
        'en',
        'bono',
        'Lewis'
      );
      expect(speechWet.toLowerCase()).toContain('full wets');

      const speechInter = getProactiveRadioSpeech(
        { category: 'tyre_crossover_inter' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(speechInter.toLowerCase()).toContain('intermedio');

      const speechBrakeOk = getProactiveRadioSpeech(
        { category: 'brake_bias_ok' },
        'en',
        'bono',
        'Lewis'
      );
      expect(speechBrakeOk.toLowerCase()).toContain('balance');

      const speechFuelSC = getProactiveRadioSpeech(
        { category: 'fuel_mix_neutralized' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(speechFuelSC.toLowerCase()).toContain('mezcla');

      const speechFuelRestart = getProactiveRadioSpeech(
        { category: 'fuel_mix_restart' },
        'en',
        'bono',
        'Lewis'
      );
      expect(speechFuelRestart.toLowerCase()).toContain('mix 2');

      const speechClipping = getProactiveRadioSpeech(
        { category: 'ers_clipping' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(speechClipping.toLowerCase()).toMatch(/clipping|derating/);

      const speechTyreSet = getProactiveRadioSpeech(
        { category: 'tyre_set_advisory' },
        'en',
        'bono',
        'Lewis'
      );
      expect(speechTyreSet.toLowerCase()).toMatch(/fresh|rubber|pit/);
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
      expect(speech.toLowerCase()).toContain('pinchadura');
      expect(speech).not.toContain('{driver}');
    });

    it('formats sector delta coaching authentically', () => {
      const directive = '[PROACTIVE PIT WALL CALL: Sector 1 Delta — Time lost in Sector 1 (+0.42s). Focus on apex speed. You are initiating this call — do NOT say "Entendido" or "Copy".]';
      const speech = getProactiveRadioSpeech(directive, 'es', 'colapinto', 'Franco');
      expect(speech).toContain('Franco');
      expect(speech.toLowerCase()).toMatch(/sector|parcial|tiempo/i);
      expect(speech).not.toContain('You are initiating this call');
    });

    it('formats Phase 6 Active Aero, Pit Overspeed, Blistering, and Powertrain categories', () => {
      const aeroSpeech = getProactiveRadioSpeech(
        { category: 'aero_straight_anticipation', message: 'Straight Mode zone in 100 metres!' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(aeroSpeech.toLowerCase()).toMatch(/recta|aerodinámica/);
      expect(aeroSpeech).toContain('Franco');

      const overtakeSpeech = getProactiveRadioSpeech(
        { category: 'overtake_boost_anticipation', message: 'Override zone ahead in 100 metres!' },
        'en',
        'bono',
        'Lewis'
      );
      expect(overtakeSpeech.toLowerCase()).toMatch(/override|boost/);
      expect(overtakeSpeech).toContain('Lewis');

      const pitSpeedSpeech = getProactiveRadioSpeech(
        { category: 'pit_limiter_overspeed', message: 'Speed limiter! Drop speed, pit limiter line approaching!' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(pitSpeedSpeech.toLowerCase()).toMatch(/limitador|velocidad/);

      const blisterSpeech = getProactiveRadioSpeech(
        { category: 'tyre_blistering', message: 'Tyre blistering detected on the Front Left tyre!' },
        'en',
        'bono',
        'George'
      );
      expect(blisterSpeech.toLowerCase()).toMatch(/blister/);
      expect(blisterSpeech).toContain('George');

      const pressureSpeech = getProactiveRadioSpeech(
        { category: 'tyre_pressure_high', message: 'High tyre pressure detected.' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(pressureSpeech.toLowerCase()).toMatch(/presión|gomas|neumáticos/);

      const gearboxSpeech = getProactiveRadioSpeech(
        { category: 'damage_gearbox_wear', message: 'Gearbox damage reached 74%!' },
        'es',
        'colapinto',
        'Franco'
      );
      expect(gearboxSpeech.toLowerCase()).toMatch(/caja/);

      const iceSpeech = getProactiveRadioSpeech(
        { category: 'damage_ice_wear', message: 'Internal Combustion Engine (ICE) wear at 78%!' },
        'en',
        'bono',
        'Lewis'
      );
      expect(iceSpeech.toLowerCase()).toMatch(/ice|combustion engine|power/);
      expect(iceSpeech).toContain('Lewis');
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
