import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  availableLocales,
  getTranslation,
} from '../locales';
import type {
  LocaleCode,
  TranslationKey,
  LocaleInfo,
} from '../locales';

interface I18nContextType {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
  availableLocales: LocaleInfo[];
  currentLocaleInfo: LocaleInfo;
}

const STORAGE_KEY = 'f1_telemetry_language';

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function detectDefaultLocale(): LocaleCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') {
      return saved;
    }

    if (typeof navigator !== 'undefined' && navigator.language) {
      const navLang = navigator.language.toLowerCase();
      if (navLang.startsWith('es')) {
        return 'es';
      }
    }
  } catch {
    // Ignore localStorage / navigator access issues in restrictive environments
  }
  return 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(detectDefaultLocale);

  const setLocale = useCallback((newLocale: LocaleCode) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // Ignore localStorage write errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey | string, params?: Record<string, string | number>) => {
      return getTranslation(locale, key, params);
    },
    [locale]
  );

  const currentLocaleInfo = useMemo(() => {
    return availableLocales.find((l) => l.code === locale) || availableLocales[0];
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      availableLocales,
      currentLocaleInfo,
    }),
    [locale, setLocale, t, currentLocaleInfo]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

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
