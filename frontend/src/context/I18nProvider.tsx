import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { availableLocales, getTranslation } from '../locales';
import type { LocaleCode, TranslationKey } from '../locales';
import { I18nContext } from './I18nContext';

const STORAGE_KEY = 'f1_telemetry_language';

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
