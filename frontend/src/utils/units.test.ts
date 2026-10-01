import { describe, it, expect } from 'vitest';
import { convertSpeed, convertTemperature, defaultUnitsForLocale, normalizeUnits } from './units';
import { createUnitFormatter } from '../hooks/useUnits';

const t = (key: string) =>
  ({ 'common.units.kmh': 'km/h', 'common.units.mph': 'mph', 'common.units.degC': '°C', 'common.units.degF': '°F' })[
    key
  ] ?? key;

describe('units', () => {
  it('converts speeds and temperatures', () => {
    expect(convertSpeed(321.869, 'mph')).toBeCloseTo(200, 2);
    expect(convertSpeed(300, 'kmh')).toBe(300);
    expect(convertTemperature(100, 'f')).toBe(212);
    expect(convertTemperature(-40, 'f')).toBe(-40);
    expect(convertTemperature(28, 'c')).toBe(28);
  });

  it('starts from what the browser locale expects', () => {
    expect(defaultUnitsForLocale('en-US')).toEqual({ speed: 'mph', temperature: 'f', clock: '12h' });
    expect(defaultUnitsForLocale('en-GB')).toEqual({ speed: 'mph', temperature: 'c', clock: '24h' });
    expect(defaultUnitsForLocale('es-ES')).toEqual({ speed: 'kmh', temperature: 'c', clock: '24h' });
    expect(defaultUnitsForLocale('de')).toEqual({ speed: 'kmh', temperature: 'c', clock: '24h' });
    expect(defaultUnitsForLocale('not a locale')).toMatchObject({ speed: 'kmh', temperature: 'c' });
  });

  it('keeps the known saved values and fills the rest', () => {
    const fallback = { speed: 'kmh', temperature: 'c', clock: '24h' } as const;
    expect(normalizeUnits({ speed: 'mph', temperature: 'kelvin' }, fallback)).toEqual({
      speed: 'mph',
      temperature: 'c',
      clock: '24h',
    });
    expect(normalizeUnits('junk', fallback)).toEqual(fallback);
  });

  it('formats speeds, temperatures and clock times in the chosen units', () => {
    const metric = createUnitFormatter({ speed: 'kmh', temperature: 'c', clock: '24h' }, t, 'en');
    const imperial = createUnitFormatter({ speed: 'mph', temperature: 'f', clock: '12h' }, t, 'en');
    expect(metric.speed(312.4)).toBe('312 km/h');
    expect(imperial.speed(321.869)).toBe('200 mph');
    expect(imperial.speed(null)).toBe('--');
    expect(metric.temperature(28)).toBe('28°C');
    expect(imperial.temperature(28)).toBe('82°F');
    expect(imperial.degrees(100)).toBe('212°');

    const afternoon = new Date(2026, 9, 1, 14, 5, 9);
    expect(metric.time(afternoon)).toBe('14:05');
    expect(metric.time(afternoon, true)).toBe('14:05:09');
    expect(imperial.time(afternoon)).toMatch(/^02:05\s?pm$/i);
    expect(metric.time('not a date')).toBe('');
  });
});
