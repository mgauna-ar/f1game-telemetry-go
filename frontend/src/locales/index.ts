import { en } from './en';
import type { LocaleDictionary } from './types';

export { en };
export type { LocaleDictionary };

export type LocaleCode = 'en' | 'es';

export interface LocaleInfo {
  code: LocaleCode;
  name: string;
  label: string;
  countryCode: string;
  flag: string;
}

export const availableLocales: LocaleInfo[] = [
  { code: 'en', name: 'English', label: 'English', countryCode: 'gb', flag: '🇬🇧' },
  { code: 'es', name: 'Español (Latinoamérica)', label: 'Español (Latinoamérica)', countryCode: 'ar', flag: '🇦🇷' },
];

/**
 * Each language's dictionary, loaded on demand so a browser only downloads the one on screen.
 * English is always here: it is the default and the fallback for a key a dictionary lacks.
 */
const loaders: Record<LocaleCode, () => Promise<LocaleDictionary>> = {
  en: async () => en,
  es: () => import('./es').then((m) => m.es),
};

const loaded: Partial<Record<LocaleCode, LocaleDictionary>> = { en };

/** Whether `locale`'s dictionary is loaded, so `getTranslation` can use it. */
export const isLocaleLoaded = (locale: LocaleCode): boolean => loaded[locale] !== undefined;

/** Loads `locale`'s dictionary; later calls reuse it. */
export async function loadLocale(locale: LocaleCode): Promise<void> {
  if (!loaded[locale]) loaded[locale] = await loaders[locale]();
}

// Recursive path extraction for strongly-typed dot-notation keys
type Prev = [never, 0, 1, 2, 3, 4, ...0[]];

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

type Leaves<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends object
  ? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T]
  : '';

export type TranslationKey = Leaves<LocaleDictionary>;

export function getTranslation(
  locale: LocaleCode,
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = loaded[locale] ?? en;
  const fallbackDict = en;

  const getNested = (obj: Record<string, unknown> | undefined, path: string): unknown => {
    return path.split('.').reduce<unknown>((prev, curr) => {
      if (prev && typeof prev === 'object' && curr in prev) {
        return (prev as Record<string, unknown>)[curr];
      }
      return undefined;
    }, obj);
  };

  let value = getNested(dict, key);
  if (value === undefined || value === null) {
    value = getNested(fallbackDict, key);
  }

  if (typeof value !== 'string') {
    return key;
  }

  if (!params) {
    return value;
  }

  return Object.entries(params).reduce((acc, [k, v]) => {
    return acc
      .replaceAll(`{{${k}}}`, String(v))
      .replaceAll(`{${k}}`, String(v));
  }, value);
}
