import { cleanRadioSpeechText } from './radioAudio';
import type { RadioPersona } from '../constants/f1';
import { en, es, type LocaleCode } from '../locales';
import type { RadioAlertPayload, RadioAlertCategory } from '../types/telemetry';

export type { RadioAlertCategory };

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
    lower.includes('full safety car') ||
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
  if (
    lower.includes('surface temperature') ||
    lower.includes('overheating') ||
    (lower.includes('overheat') && lower.includes('tyre'))
  ) {
    return 'tyre_overheat';
  }
  if (lower.includes('cold') && (lower.includes('tyre') || lower.includes('tyres') || lower.includes('goma'))) {
    return 'tyre_cold';
  }
  if (lower.includes('tyre wear') || lower.includes('wear is at') || lower.includes('desgaste')) {
    return 'tyre_wear';
  }

  // 3. Damage & Mechanical Faults
  if (lower.includes('front wing') || lower.includes('wing flap') || lower.includes('wing damage') || lower.includes('alerón')) {
    return 'wing_damage';
  }
  if (lower.includes('floor') || lower.includes('diffuser') || lower.includes('fondo plano')) {
    return 'floor_damage';
  }
  if (
    lower.includes('engine component wear') ||
    lower.includes('engine internal') ||
    lower.includes('gearbox component wear') ||
    lower.includes('engine wear')
  ) {
    return 'engine_wear';
  }
  if (
    lower.includes('straight mode fault') ||
    lower.includes('straight mode failure') ||
    lower.includes('straight mode is currently offline') ||
    lower.includes('straight mode unavailable') ||
    lower.includes('active aero flap fault') ||
    lower.includes('active aero fault') ||
    lower.includes('drs flap fault') ||
    lower.includes('drs fault')
  ) {
    return 'aero_fault';
  }
  if (
    lower.includes('ers deployment failure') ||
    lower.includes('ers fault') ||
    lower.includes('electric boost offline') ||
    lower.includes('hybrid ers')
  ) {
    return 'ers_fault';
  }
  if (lower.includes('mechanical fault')) {
    return 'mechanical_fault';
  }

  // 4. Power Unit & Thermal
  if (lower.includes('ers battery') || lower.includes('low battery reserve') || lower.includes('low battery') || lower.includes('batería')) {
    return 'ers_low';
  }
  if (lower.includes('radiator') || lower.includes('water/oil temperature') || lower.includes('engine core water') || lower.includes('radiador')) {
    return 'radiator_overheat';
  }
  if (
    lower.includes('brake disc') ||
    lower.includes('brake fade') ||
    (lower.includes('brake') && (lower.includes('hot') || lower.includes('high'))) ||
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
  if (lower.includes('clean air pit window') || lower.includes('clean air on rejoin')) {
    return 'pit_clean_air';
  }
  if (
    lower.includes('pit stop window') ||
    lower.includes('pit window') ||
    lower.includes('ventana de parada')
  ) {
    return 'pit_window_open';
  }

  // 6. Rivals & DRS / Attack / Defend
  if (
    lower.includes('defend') ||
    lower.includes('defiende') ||
    (lower.includes('behind') && (lower.includes('drs') || lower.includes('boost') || lower.includes('threat')))
  ) {
    return 'rival_defend';
  }
  if (
    lower.includes('catching car ahead') ||
    lower.includes('prepare overtake') ||
    lower.includes('overtake / deployment') ||
    lower.includes('override boost is available') ||
    (lower.includes('ahead') && (lower.includes('attack') || lower.includes('overtake') || lower.includes('modo ataque')))
  ) {
    return 'rival_attack';
  }

  // 7. Coaching & Teammate (Backend Directives)
  if (
    lower.includes('sector 1 delta') ||
    lower.includes('sector 2 delta') ||
    lower.includes('sector 3 delta') ||
    lower.includes('time lost in sector') ||
    lower.includes('personal best')
  ) {
    return 'sector_delta';
  }
  if (lower.includes('teammate is pitting') || (lower.includes('teammate in p') && lower.includes('pitting'))) {
    return 'teammate_pitting';
  }
  if (lower.includes('teammate is p') || lower.includes('teammate ahead') || lower.includes('teammate is ahead') || lower.includes('teammate is directly ahead')) {
    return 'teammate_ahead';
  }

  // 8. Qualifying, Practice, In-Lap & Race Finish
  if (lower.includes('chequered flag') || lower.includes('bandera a cuadros') || lower.includes('parc fermé') || lower.includes('parque cerrado') || lower.includes('race completed')) {
    return 'race_finish';
  }
  if (lower.includes('fast car approaching on flying lap behind') || lower.includes('auto rápido en vuelta lanzada') || lower.includes('fast car behind')) {
    return 'inlap_traffic_behind';
  }
  if (lower.includes('cool down car') || lower.includes('flying lap completed, box this lap') || lower.includes('vuelta rápida completada')) {
    return 'inlap_cooldown';
  }
  if (lower.includes('traffic ahead before starting hot lap') || (lower.includes('traffic ahead') && lower.includes('out-lap')) || (lower.includes('traffic ahead') && lower.includes('clean air'))) {
    return 'qualy_traffic';
  }
  if (lower.includes('track is clear ahead with clean air') || lower.includes('track is clear ahead') || lower.includes('clean air gap')) {
    return 'qualy_clean_air';
  }
  if (lower.includes('deleted for track limits') || lower.includes('lap is invalid') || lower.includes('vuelta anulada')) {
    return 'qualy_deleted_lap';
  }
  if (lower.includes('under 3 minutes remaining') || lower.includes('minutes remaining') || lower.includes('quedan menos de 3 minutos')) {
    return 'qualy_session_time';
  }
  if (lower.includes('elimination danger zone') || lower.includes('zona de eliminación')) {
    return 'qualy_elimination_danger';
  }

  // 9. Flags & Penalties
  if (lower.includes('track limits') || lower.includes('corner cutting warnings') || lower.includes('límites de pista')) {
    return 'track_limits_warnings';
  }
  if (lower.includes('time penalty by the stewards') || lower.includes('assessed a') || lower.includes('penalización') || lower.includes('sanción')) {
    return 'penalties_incurred';
  }
  if (lower.includes('rain is now falling on track') || lower.includes('rain is falling') || lower.includes('lluvia en pista') || lower.includes('lluvia cayendo')) {
    return 'flags_rain_live';
  }
  if (lower.includes('crossover') || lower.includes('too wet for slick') || lower.includes('box box for intermediate') || lower.includes('box for slicks')) {
    return 'tyre_crossover';
  }
  if (lower.includes('weather radar') || lower.includes('radar confirms') || lower.includes('chance of rain') || lower.includes('lluvia')) {
    return 'weather_rain';
  }

  return 'directive';
}

/**
 * Returns a randomized authentic phrase tailored to the driver's persona, language, and callsign.
 * Supports both structured typed RadioAlertPayload and legacy alert strings.
 */
export function getProactiveRadioSpeech(
  input: RadioAlertPayload | string,
  language: LocaleCode = 'es',
  persona: RadioPersona = 'bono',
  driverCallsign?: string
): string {
  let category: RadioAlertCategory =
    typeof input === 'object' && input.category
      ? input.category
      : detectAlertCategory(typeof input === 'string' ? input : '');

  const rawContext = typeof input === 'object' ? (input.message || '') : input;

  const is2026 =
    (typeof input === 'object' && (input.metadata?.is_2026 === true || input.metadata?.is_2026 === 'true')) ||
    rawContext.toLowerCase().includes('override') ||
    rawContext.toLowerCase().includes('boost');
  if (is2026) {
    if (category === 'rival_defend') category = 'rival_defend_override';
    if (category === 'rival_attack') category = 'rival_attack_override';
  }

  const localeDict = language === 'en' ? en.radio_phrases : es.radio_phrases;
  const catPool = (localeDict as Record<string, { bono?: string[]; colapinto?: string[]; standard: string[] }>)[category];

  if (!catPool) {
    return formatGenericDirective(rawContext, driverCallsign);
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
  return interpolateCallsign(selectedTemplate, driverCallsign, rawContext);
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
  const cleaned = cleanRadioSpeechText(alertContext);
  return `${callsignPrefix}${cleaned}`;
}
