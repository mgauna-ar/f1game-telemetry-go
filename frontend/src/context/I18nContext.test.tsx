import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { I18nProvider, useI18n } from './I18nContext';

const TestComponent = () => {
  const { locale, setLocale, t, currentLocaleInfo } = useI18n();

  return (
    <div>
      <div data-testid="current-locale">{locale}</div>
      <div data-testid="current-flag">{currentLocaleInfo.flag}</div>
      <div data-testid="current-name">{currentLocaleInfo.name}</div>
      <div data-testid="nav-history">{t('nav.tabs.history')}</div>
      <div data-testid="nav-comparator">{t('nav.tabs.comparator')}</div>
      <div data-testid="nav-live">{t('nav.tabs.live')}</div>
      <div data-testid="common-drivers-interpolated">{t('common.driversCount', { count: 20 })}</div>
      <div data-testid="common-laps-interpolated">{t('common.lapsCount', { count: 53 })}</div>
      
      <button data-testid="switch-es" onClick={() => setLocale('es')}>
        Switch to Spanish
      </button>
      <button data-testid="switch-en" onClick={() => setLocale('en')}>
        Switch to English
      </button>
    </div>
  );
};

describe('I18nContext and useI18n Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('provides default English locale and translations', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('current-locale')).toHaveTextContent('en');
    expect(screen.getByTestId('current-flag')).toHaveTextContent('🇬🇧');
    expect(screen.getByTestId('nav-history')).toHaveTextContent('Session History');
    expect(screen.getByTestId('nav-comparator')).toHaveTextContent('Lap Comparator');
    expect(screen.getByTestId('nav-live')).toHaveTextContent('Live Session');
    expect(screen.getByTestId('common-drivers-interpolated')).toHaveTextContent('20 Drivers');
    expect(screen.getByTestId('common-laps-interpolated')).toHaveTextContent('53 Laps');
  });

  it('switches to Latin American Spanish with Argentina flag when setLocale is called', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    fireEvent.click(screen.getByTestId('switch-es'));

    expect(screen.getByTestId('current-locale')).toHaveTextContent('es');
    expect(screen.getByTestId('current-flag')).toHaveTextContent('🇦🇷');
    expect(screen.getByTestId('current-name')).toHaveTextContent('Español (Latinoamérica)');
    expect(screen.getByTestId('nav-history')).toHaveTextContent('Historial de Sesiones');
    expect(screen.getByTestId('nav-comparator')).toHaveTextContent('Comparador de Vueltas');
    expect(screen.getByTestId('nav-live')).toHaveTextContent('Sesión en Vivo');
    expect(screen.getByTestId('common-drivers-interpolated')).toHaveTextContent('20 Pilotos');
    expect(screen.getByTestId('common-laps-interpolated')).toHaveTextContent('53 Vueltas');
    expect(localStorage.getItem('f1_telemetry_language')).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('initializes from saved localStorage language preference', () => {
    localStorage.setItem('f1_telemetry_language', 'es');

    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('current-locale')).toHaveTextContent('es');
    expect(screen.getByTestId('current-flag')).toHaveTextContent('🇦🇷');
    expect(screen.getByTestId('nav-history')).toHaveTextContent('Historial de Sesiones');
  });
});
