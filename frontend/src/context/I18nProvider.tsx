import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { availableLocales, getTranslation, isLocaleLoaded, loadLocale } from '../locales';
import type { LocaleCode, TranslationKey } from '../locales';
import { I18nContext } from './I18nContext';
import { storage } from '../utils/storage';

const STORAGE_KEY = 'f1_telemetry_language';

function detectDefaultLocale(): LocaleCode {
  const saved = storage.get<string>(STORAGE_KEY, '');
  if (saved === 'en' || saved === 'es') {
    return saved;
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const navLang = navigator.language.toLowerCase();
      if (navLang.startsWith('es')) {
        return 'es';
      }
    }
  } catch {
    // Ignore navigator access issues in restrictive environments
  }
  return 'en';
}

/**
 * The UI language. Only the chosen language's dictionary is downloaded: until it arrives the app
 * renders nothing on first load (rather than flashing English), and on a switch it keeps the
 * current language on screen.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The language chosen, and the one on screen (the last one whose dictionary is loaded)
  const [requested, setRequested] = useState<LocaleCode>(detectDefaultLocale);
  const [locale, setLocaleState] = useState<LocaleCode | null>(() => (isLocaleLoaded(requested) ? requested : null));

  useEffect(() => {
    if (isLocaleLoaded(requested)) {
      setLocaleState(requested);
      return;
    }
    let current = true;
    loadLocale(requested)
      .then(() => current && setLocaleState(requested))
      // Offline or a failed chunk: stay in (or fall back to) English, which is always loaded
      .catch((err) => {
        console.warn(`[i18n] Loading the ${requested} dictionary failed:`, err);
        if (current) setLocaleState((shown) => shown ?? 'en');
      });
    return () => {
      current = false;
    };
  }, [requested]);

  const setLocale = useCallback((newLocale: LocaleCode) => {
    setRequested(newLocale);
    storage.set(STORAGE_KEY, newLocale);
  }, []);

  const shown = locale ?? 'en';

  useEffect(() => {
    if (locale && typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey | string, params?: Record<string, string | number>) => getTranslation(shown, key, params),
    [shown]
  );

  const currentLocaleInfo = useMemo(
    () => availableLocales.find((l) => l.code === shown) || availableLocales[0],
    [shown]
  );

  const value = useMemo(
    () => ({
      locale: shown,
      setLocale,
      t,
      availableLocales,
      currentLocaleInfo,
    }),
    [shown, setLocale, t, currentLocaleInfo]
  );

  // First load in a language not yet downloaded: a moment of nothing rather than English
  if (locale === null) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
