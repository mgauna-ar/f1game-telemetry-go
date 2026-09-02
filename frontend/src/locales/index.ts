import { common as enCommon } from './en/common';
import { nav as enNav } from './en/nav';
import { history as enHistory } from './en/history';
import { comparator as enComparator } from './en/comparator';
import { live as enLive } from './en/live';
import { ai_engineer as enAiEngineer } from './en/ai_engineer';
import { radio_phrases as enRadioPhrases } from './en/radio_phrases';

import { common as esCommon } from './es/common';
import { nav as esNav } from './es/nav';
import { history as esHistory } from './es/history';
import { comparator as esComparator } from './es/comparator';
import { live as esLive } from './es/live';
import { ai_engineer as esAiEngineer } from './es/ai_engineer';
import { radio_phrases as esRadioPhrases } from './es/radio_phrases';

export const en = {
  common: enCommon,
  nav: enNav,
  history: enHistory,
  comparator: enComparator,
  live: enLive,
  ai_engineer: enAiEngineer,
  radio_phrases: enRadioPhrases,
};

export const es = {
  common: esCommon,
  nav: esNav,
  history: esHistory,
  comparator: esComparator,
  live: esLive,
  ai_engineer: esAiEngineer,
  radio_phrases: esRadioPhrases,
};

export type LocaleCode = 'en' | 'es';

export type LocaleDictionary = typeof en;

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

export const dictionaries: Record<LocaleCode, LocaleDictionary> = {
  en,
  es,
};

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
  const dict = dictionaries[locale] || dictionaries.en;
  const fallbackDict = dictionaries.en;

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
