/**
 * Units the dashboard shows: speed, temperature and the clock. The game sends km/h and °C; the
 * conversion happens only where a value is shown, so stored and computed values stay metric.
 */

export type SpeedUnit = 'kmh' | 'mph';
export type TemperatureUnit = 'c' | 'f';
export type ClockFormat = '24h' | '12h';

export interface UnitPreferences {
  speed: SpeedUnit;
  temperature: TemperatureUnit;
  clock: ClockFormat;
}

export const SPEED_UNITS: readonly SpeedUnit[] = ['kmh', 'mph'];
export const TEMPERATURE_UNITS: readonly TemperatureUnit[] = ['c', 'f'];
export const CLOCK_FORMATS: readonly ClockFormat[] = ['24h', '12h'];

/** What the game sends: km/h, °C and a 24-hour clock. */
export const METRIC_UNITS: UnitPreferences = { speed: 'kmh', temperature: 'c', clock: '24h' };

/** Kilometres in a mile. */
export const KM_PER_MILE = 1.609344;
const FAHRENHEIT_PER_CELSIUS = 9 / 5;
const FAHRENHEIT_AT_ZERO_CELSIUS = 32;

/** Countries that drive in miles per hour, and those that read the weather in Fahrenheit. */
const MPH_REGIONS = new Set(['US', 'GB', 'LR', 'MM', 'PR', 'VI', 'GU', 'AS', 'MP', 'BS', 'BZ', 'KY', 'IM', 'JE', 'GG']);
const FAHRENHEIT_REGIONS = new Set([
  'US',
  'LR',
  'MM',
  'PR',
  'VI',
  'GU',
  'AS',
  'MP',
  'BS',
  'BZ',
  'KY',
  'PW',
  'FM',
  'MH',
]);

/** The region of a BCP 47 tag ("en-US" → "US"), or '' when it names none. */
const regionOf = (locale: string): string => {
  try {
    return new Intl.Locale(locale).maximize().region ?? '';
  } catch {
    return '';
  }
};

const usesTwelveHourClock = (locale: string): boolean => {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle;
    return cycle === 'h11' || cycle === 'h12';
  } catch {
    return false;
  }
};

/** The units people in a locale expect: mph in the US and UK, °F in the US, its own clock. */
export function defaultUnitsForLocale(locale: string): UnitPreferences {
  const region = regionOf(locale);
  return {
    speed: MPH_REGIONS.has(region) ? 'mph' : 'kmh',
    temperature: FAHRENHEIT_REGIONS.has(region) ? 'f' : 'c',
    clock: usesTwelveHourClock(locale) ? '12h' : '24h',
  };
}

/** The browser's locale, for the first defaults. */
export const browserLocale = (): string => (typeof navigator !== 'undefined' && navigator.language) || 'en-GB';

/** Keeps the known values of a saved object, filling the rest from `fallback`. */
export function normalizeUnits(saved: unknown, fallback: UnitPreferences): UnitPreferences {
  const s = (typeof saved === 'object' && saved !== null ? saved : {}) as Partial<
    Record<keyof UnitPreferences, unknown>
  >;
  const pick = <T extends string>(value: unknown, allowed: readonly T[], def: T): T =>
    allowed.includes(value as T) ? (value as T) : def;
  return {
    speed: pick(s.speed, SPEED_UNITS, fallback.speed),
    temperature: pick(s.temperature, TEMPERATURE_UNITS, fallback.temperature),
    clock: pick(s.clock, CLOCK_FORMATS, fallback.clock),
  };
}

export const convertSpeed = (kmh: number, unit: SpeedUnit): number => (unit === 'mph' ? kmh / KM_PER_MILE : kmh);

export const convertTemperature = (celsius: number, unit: TemperatureUnit): number =>
  unit === 'f' ? celsius * FAHRENHEIT_PER_CELSIUS + FAHRENHEIT_AT_ZERO_CELSIUS : celsius;

type SpeedPoint = { speedA?: number | null; speedB?: number | null };

const convertMaybe = (v: number | null | undefined, unit: SpeedUnit) =>
  typeof v === 'number' ? convertSpeed(v, unit) : v;

/** Comparator points with both laps' speeds in `unit`, so a chart's axis ticks fall on round values. */
export function pointsInSpeedUnit<T extends SpeedPoint>(points: T[], unit: SpeedUnit): T[] {
  if (unit === 'kmh') return points;
  return points.map((p) => ({ ...p, speedA: convertMaybe(p.speedA, unit), speedB: convertMaybe(p.speedB, unit) }));
}
