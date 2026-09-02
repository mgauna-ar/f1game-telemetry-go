import { render, screen, fireEvent } from '@testing-library/react';
import { useI18n } from './I18nContext';
import { I18nProvider } from './I18nProvider';
import { getTranslation, en, es } from '../locales';

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

  it('resolves all AI engineer proactive alert and PTT keys without returning raw translation keys', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );

    // Test in English
    const alertKeys = [
      'ai_engineer.proactiveAlerts.tyreWearWarnThreshold',
      'ai_engineer.proactiveAlerts.tyreWearCritThreshold',
      'ai_engineer.proactiveAlerts.tyreOverheatTemp',
      'ai_engineer.proactiveAlerts.tyreColdTemp',
      'ai_engineer.proactiveAlerts.wingDamage',
      'ai_engineer.proactiveAlerts.floorDamage',
      'ai_engineer.proactiveAlerts.engineWear',
      'ai_engineer.proactiveAlerts.mechanicalFaults',
      'ai_engineer.proactiveAlerts.engineOverheat',
      'ai_engineer.proactiveAlerts.wingDamageThreshold',
      'ai_engineer.proactiveAlerts.floorDamageThreshold',
      'ai_engineer.proactiveAlerts.engineWearThreshold',
      'ai_engineer.proactiveAlerts.engineOverheatTemp',
      'ai_engineer.proactiveAlerts.ersLowReserve',
      'ai_engineer.proactiveAlerts.ersLowThreshold',
      'ai_engineer.proactiveAlerts.brakeOverheatFade',
      'ai_engineer.proactiveAlerts.brakeCold',
      'ai_engineer.proactiveAlerts.brakeOverheatTemp',
      'ai_engineer.proactiveAlerts.brakeColdTemp',
      'ai_engineer.proactiveAlerts.fuelDeficitLiftCoast',
      'ai_engineer.proactiveAlerts.fuelDeltaThreshold',
      'ai_engineer.proactiveAlerts.undercutThreat',
      'ai_engineer.proactiveAlerts.pitWindowOpen',
      'ai_engineer.proactiveAlerts.rivalDefend',
      'ai_engineer.proactiveAlerts.rivalAttack',
      'ai_engineer.proactiveAlerts.undercutGapThreshold',
      'ai_engineer.proactiveAlerts.rivalDefendGap',
      'ai_engineer.proactiveAlerts.rivalAttackGap',
      'ai_engineer.proactiveAlerts.qualyTraffic',
      'ai_engineer.proactiveAlerts.qualyDeletedLap',
      'ai_engineer.proactiveAlerts.qualySessionTime',
      'ai_engineer.proactiveAlerts.qualyElimDanger',
      'ai_engineer.proactiveAlerts.qualyCleanAirGap',
      'ai_engineer.proactiveAlerts.safetyCarAlert',
      'ai_engineer.proactiveAlerts.redFlagAlert',
      'ai_engineer.proactiveAlerts.dynamicRainAlert',
      'ai_engineer.proactiveAlerts.trackLimitsWarning',
      'ai_engineer.proactiveAlerts.penaltiesIncurred',
      'ai_engineer.proactiveAlerts.cornerCutLimit',
      'ai_engineer.proactiveAlerts.rainHorizon',
      'ai_engineer.proactiveAlerts.rainProbability',
      'ai_engineer.ptt.gamepadNotDetected',
      'ai_engineer.ptt.btnMapped',
      'ai_engineer.ptt.mapGamepadBtn',
      'ai_engineer.ptt.clearGamepad',
    ];

    for (const key of alertKeys) {
      const enVal = getTranslation('en', key);
      expect(enVal).not.toBe(key);
      expect(typeof enVal).toBe('string');
      expect(enVal.length).toBeGreaterThan(0);

      const esVal = getTranslation('es', key);
      expect(esVal).not.toBe(key);
      expect(typeof esVal).toBe('string');
      expect(esVal.length).toBeGreaterThan(0);
    }
  });

  it('verifies deep parity of keys between en and es dictionaries', () => {
    const extractKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
      let keys: string[] = [];
      for (const k of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        const val = obj[k];
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          keys = keys.concat(extractKeys(val as Record<string, unknown>, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    };

    const enKeys = extractKeys(en).sort();
    const esKeys = extractKeys(es).sort();

    const missingInEs = enKeys.filter((k) => !esKeys.includes(k));
    const missingInEn = esKeys.filter((k) => !enKeys.includes(k));

    expect(missingInEs).toEqual([]);
    expect(missingInEn).toEqual([]);
  });
});
