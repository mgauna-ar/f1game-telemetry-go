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
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Rival behind within 1.0s behind with DRS active.]')
      ).toBe('rival_defend');

      expect(
        detectAlertCategory('[PROACTIVE PIT WALL CALL: Rival within 1.0s ahead in DRS range. Attack now.]')
      ).toBe('rival_attack');
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
    });
  });

  describe('getProactiveRadioSpeech', () => {
    it('formats safety car with Bono persona and English callsign', () => {
      const prompt = '[PROACTIVE PIT WALL CALL: Full Safety Car deployed! Maintain delta positive.]';
      const speech = getProactiveRadioSpeech(prompt, 'en', 'bono', 'Lewis');
      expect(speech).toContain('Safety Car');
      expect(speech).toContain('Lewis');
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

    it('handles generic server-side directives cleanly', () => {
      const directive = '[PROACTIVE PIT WALL CALL: Sector 1 Delta — Time lost in Sector 1 (+0.42s). Focus on apex speed.]';
      const speech = getProactiveRadioSpeech(directive, 'es', 'bono', 'Driver');
      expect(speech).toContain('Driver, Sector 1 Delta — Time lost in Sector 1 (+0.42s). Focus on apex speed.');
    });
  });

  describe('RADIO_PHRASE_CATALOG completeness', () => {
    it('has standard phrase pools for all categories in Spanish and English locales', () => {
      const esCategories = Object.keys(RADIO_PHRASE_CATALOG.es) as (keyof typeof RADIO_PHRASE_CATALOG.es)[];
      const enCategories = Object.keys(RADIO_PHRASE_CATALOG.en) as (keyof typeof RADIO_PHRASE_CATALOG.en)[];
      expect(esCategories.length).toBeGreaterThanOrEqual(28);
      expect(enCategories.length).toBeGreaterThanOrEqual(28);

      for (const cat of esCategories) {
        expect(RADIO_PHRASE_CATALOG.es[cat].standard.length).toBeGreaterThan(0);
      }
      for (const cat of enCategories) {
        expect(RADIO_PHRASE_CATALOG.en[cat].standard.length).toBeGreaterThan(0);
      }
    });
  });
});
