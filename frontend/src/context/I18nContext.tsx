import { createContext, useContext } from 'react';
import {
  availableLocales,
  getTranslation,
} from '../locales';
import type {
  LocaleCode,
  TranslationKey,
  LocaleInfo,
} from '../locales';

export interface I18nContextType {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
  availableLocales: LocaleInfo[];
  currentLocaleInfo: LocaleInfo;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

const defaultFallbackContext: I18nContextType = {
  locale: 'en',
  setLocale: () => {},
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => getTranslation('en', key, params),
  availableLocales,
  currentLocaleInfo: availableLocales[0],
};

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  return context || defaultFallbackContext;
}
