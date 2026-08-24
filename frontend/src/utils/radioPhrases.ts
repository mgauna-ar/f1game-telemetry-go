import { cleanRadioSpeechText } from './radioAudio';
import type { RadioPersona } from '../constants/f1';
import { en, es, type LocaleCode } from '../locales';

export type RadioAlertCategory = keyof typeof en.radio_phrases;

export const RADIO_PHRASE_CATALOG = {
  get es() {
    return es.radio_phrases;
  },
  get en() {
    return en.radio_phrases;
  },
};

/**
 * Detects the relevant alert category from the proactive alert context string.
 */
export function detectAlertCategory(alertContext: string): RadioAlertCategory {
  const lower = (alertContext || '').toLowerCase();

  // 1. SC / VSC / Red Flag
  if (
    lower.includes('full safety car deployed') ||
    lower.includes('safety car in pista') ||
    (lower.includes('safety car') && !lower.includes('virtual'))
  ) {
    return 'safety_car';
  }
  if (lower.includes('virtual safety car') || lower.includes('vsc deployed') || lower.includes('vsc')) {
    return 'vsc';
  }
  if (lower.includes('red flag deployed') || lower.includes('red flag')) {
    return 'red_flag';
  }

  // 2. Tyres
  if (lower.includes('puncture') || lower.includes('tyre failure') || lower.includes('pinchazo')) {
    return 'tyre_puncture';
  }
  if (lower.includes('surface temperature is critically high') || (lower.includes('overheat') && lower.includes('tyre'))) {
    return 'tyre_overheat';
  }
  if (lower.includes('cold') && (lower.includes('tyre') || lower.includes('tyres') || lower.includes('goma'))) {
    return 'tyre_cold';
  }
  if (lower.includes('tyre wear') || lower.includes('wear is at') || lower.includes('desgaste')) {
    return 'tyre_wear';
  }

  // 3. Damage & Mechanical
  if (lower.includes('front wing') || lower.includes('wing flap') || lower.includes('wing damage') || lower.includes('alerón')) {
    return 'wing_damage';
  }
  if (lower.includes('floor') || lower.includes('diffuser') || lower.includes('fondo plano')) {
    return 'floor_damage';
  }
  if (lower.includes('engine component wear') || lower.includes('engine internal') || lower.includes('engine wear')) {
    return 'engine_wear';
  }
  if (lower.includes('drs fault') || lower.includes('straight mode failure') || lower.includes('mechanical fault')) {
    return 'mechanical_fault';
  }

  // 4. Power Unit & Thermal
  if (lower.includes('ers battery') || lower.includes('low battery reserve') || lower.includes('low battery') || lower.includes('batería')) {
    return 'ers_low';
  }
  if (lower.includes('radiator') || lower.includes('water/oil temperature') || lower.includes('radiador')) {
    return 'radiator_overheat';
  }
  if (
    lower.includes('brake disc') ||
    lower.includes('brake fade') ||
    (lower.includes('brake') && lower.includes('hot')) ||
    lower.includes('frenos sobrecalentados')
  ) {
    return 'brake_overheat';
  }
  if (lower.includes('brake') && (lower.includes('cold') || lower.includes('fríos'))) {
    return 'brake_cold';
  }

  // 5. Fuel & Strategy
  if (lower.includes('fuel deficit') || lower.includes('fuel target') || lower.includes('combustible')) {
    return 'fuel_deficit';
  }
  if (lower.includes('undercut')) {
    return 'undercut_window';
  }
  if (
    lower.includes('pit stop window is open') ||
    lower.includes('pit window is open') ||
    lower.includes('pit window open') ||
    lower.includes('ventana de parada')
  ) {
    return 'pit_window_open';
  }

  // 6. Rivals & DRS
  if (lower.includes('within 1.0s behind') || lower.includes('drs threat') || lower.includes('defend') || lower.includes('defiende')) {
    return 'rival_defend';
  }
  if (lower.includes('within 1.0s ahead') || lower.includes('attack') || lower.includes('mode overtake') || lower.includes('modo ataque')) {
    return 'rival_attack';
  }

  // 7. Qualifying
  if (lower.includes('traffic ahead before starting hot lap') || (lower.includes('traffic ahead') && lower.includes('out-lap'))) {
    return 'qualy_traffic';
  }
  if (lower.includes('track is clear ahead with clean air') || lower.includes('track is clear ahead')) {
    return 'qualy_clean_air';
  }
  if (lower.includes('deleted for track limits') || lower.includes('lap is invalid') || lower.includes('vuelta anulada')) {
    return 'qualy_deleted_lap';
  }
  if (lower.includes('under 3 minutes remaining') || lower.includes('quedan menos de 3 minutos')) {
    return 'qualy_session_time';
  }
  if (lower.includes('elimination danger zone') || lower.includes('zona de eliminación')) {
    return 'qualy_elimination_danger';
  }

  // 8. Flags & Penalties
  if (lower.includes('track limits / corner cutting warnings') || lower.includes('corner cutting warnings') || lower.includes('límites de pista')) {
    return 'track_limits_warnings';
  }
  if (lower.includes('time penalty by the stewards') || lower.includes('assessed a') || lower.includes('penalización') || lower.includes('sanción')) {
    return 'penalties_incurred';
  }
  if (lower.includes('weather radar') || lower.includes('chance of rain') || lower.includes('lluvia')) {
    return 'weather_rain';
  }

  return 'directive';
}

/**
 * Returns a randomized authentic phrase tailored to the driver's persona, language, and callsign.
 */
export function getProactiveRadioSpeech(
  alertContext: string,
  language: LocaleCode = 'es',
  persona: RadioPersona = 'bono',
  driverCallsign?: string
): string {
  const category = detectAlertCategory(alertContext);
  const localeDict = language === 'en' ? en.radio_phrases : es.radio_phrases;
  const catPool = (localeDict as Record<string, { bono?: string[]; colapinto?: string[]; standard: string[] }>)[category];

  if (!catPool) {
    return formatGenericDirective(alertContext, driverCallsign);
  }

  // Pick persona pool, falling back to standard
  let pool: string[] = [];
  if (persona === 'bono' && catPool.bono && catPool.bono.length > 0) {
    pool = catPool.bono;
  } else if (persona === 'colapinto' && catPool.colapinto && catPool.colapinto.length > 0) {
    pool = catPool.colapinto;
  }

  if (pool.length === 0) {
    pool = catPool.standard;
  }

  // Select random phrase from pool
  const randomIndex = Math.floor(Math.random() * pool.length);
  const selectedTemplate = pool[randomIndex] || pool[0];

  // Interpolate call-sign
  return interpolateCallsign(selectedTemplate, driverCallsign, alertContext);
}

function interpolateCallsign(template: string, driverCallsign?: string, rawContext?: string): string {
  const callsign = driverCallsign?.trim() || '';

  if (template.includes('{clean_text}')) {
    const cleaned = cleanRadioSpeechText(rawContext || '');
    return callsign ? `${callsign}, ${cleaned}` : cleaned;
  }

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

function formatGenericDirective(alertContext: string, driverCallsign?: string): string {
  const callsignPrefix = driverCallsign?.trim() ? `${driverCallsign.trim()}, ` : '';
  let cleaned = cleanRadioSpeechText(alertContext);
  cleaned = cleaned.replace(/\s*You are initiating this call.*$/i, '').trim();
  return `${callsignPrefix}${cleaned}`;
}
