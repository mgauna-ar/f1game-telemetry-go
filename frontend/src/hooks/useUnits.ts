import { useMemo } from 'react';
import { useI18n } from '../context/I18nContext';
import { useDevicePreferencesStore } from '../store/useDevicePreferencesStore';
import { convertSpeed, convertTemperature, type UnitPreferences } from '../utils/units';

export interface UnitFormatter {
  prefs: UnitPreferences;
  /** "km/h" or "mph". */
  speedUnit: string;
  /** "°C" or "°F". */
  temperatureUnit: string;
  /** A speed in km/h, in the chosen unit. */
  speedValue: (kmh: number) => number;
  /** "312 km/h"; `fallback` for a missing value. */
  speed: (kmh: number | null | undefined, decimals?: number, fallback?: string) => string;
  /** A temperature in °C, in the chosen unit. */
  temperatureValue: (celsius: number) => number;
  /** "28°C"; `fallback` for a missing value. */
  temperature: (celsius: number | null | undefined, decimals?: number, fallback?: string) => string;
  /** "28°": for tight spots where the unit is said nearby. */
  degrees: (celsius: number | null | undefined, decimals?: number, fallback?: string) => string;
  /** A clock time, "14:05" or "2:05 PM", with seconds when asked. */
  time: (date: Date | number | string, withSeconds?: boolean) => string;
  /** A date and time with the chosen clock; `options` as for toLocaleString. */
  dateTime: (date: Date | number | string, options: Intl.DateTimeFormatOptions) => string;
  /** When a session was recorded: "1 Oct 2026, 14:05". */
  dateAndTime: (date: Date | number | string) => string;
}

const isNumber = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

const asDate = (date: Date | number | string): Date => (date instanceof Date ? date : new Date(date));

/** The language tag dates are written in, for the page's language. */
export const dateLocale = (locale: string): string => (locale === 'es' ? 'es-AR' : 'en-GB');

/** The formatter for some unit preferences, labels from `t` and dates in `locale`. */
export function createUnitFormatter(prefs: UnitPreferences, t: (key: string) => string, locale: string): UnitFormatter {
  const speedUnit = t(prefs.speed === 'mph' ? 'common.units.mph' : 'common.units.kmh');
  const temperatureUnit = t(prefs.temperature === 'f' ? 'common.units.degF' : 'common.units.degC');
  const hour12 = prefs.clock === '12h';
  const tag = dateLocale(locale);
  const dateTime = (date: Date | number | string, options: Intl.DateTimeFormatOptions) => {
    const d = asDate(date);
    if (Number.isNaN(d.getTime())) return '';
    const showsTime = options.hour !== undefined || options.timeStyle !== undefined;
    return d.toLocaleString(tag, showsTime ? { ...options, hour12 } : options);
  };
  return {
    prefs,
    speedUnit,
    temperatureUnit,
    speedValue: (kmh) => convertSpeed(kmh, prefs.speed),
    speed: (kmh, decimals = 0, fallback = '--') =>
      isNumber(kmh) ? `${convertSpeed(kmh, prefs.speed).toFixed(decimals)} ${speedUnit}` : fallback,
    temperatureValue: (celsius) => convertTemperature(celsius, prefs.temperature),
    temperature: (celsius, decimals = 0, fallback = '--') =>
      isNumber(celsius)
        ? `${convertTemperature(celsius, prefs.temperature).toFixed(decimals)}${temperatureUnit}`
        : fallback,
    degrees: (celsius, decimals = 0, fallback = '--') =>
      isNumber(celsius) ? `${convertTemperature(celsius, prefs.temperature).toFixed(decimals)}°` : fallback,
    time: (date, withSeconds = false) =>
      dateTime(date, { hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}) }),
    dateTime,
    dateAndTime: (date) => dateTime(date, { dateStyle: 'medium', timeStyle: 'short' }),
  };
}

/**
 * Speeds, temperatures and clock times in this device's units (Settings → This device). Values
 * stay km/h and °C everywhere else; only what is shown converts.
 */
export function useUnits(): UnitFormatter {
  const { t, locale } = useI18n();
  const prefs = useDevicePreferencesStore((s) => s.units);
  return useMemo(() => createUnitFormatter(prefs, t, locale), [prefs, t, locale]);
}
