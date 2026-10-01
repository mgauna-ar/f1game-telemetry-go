import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sun, CloudSun, Cloud, CloudDrizzle, CloudRain, CloudLightning, Droplets, Thermometer } from 'lucide-react';
import type { Session, WeatherForecastSample } from '../../types/session';
import { WEATHER_CODES, WEATHER_TYPES, getSessionTypeCode } from '../../constants/f1';
import { useI18n } from '../../context/I18nContext';
import { cssVar } from '../../styles/theme';
import { cx } from '../ui/cx';
import styles from './WeatherBadgeWithForecast.module.css';
import { useUnits } from '../../hooks/useUnits';

interface WeatherBadgeWithForecastProps {
  session: Session;
  compact?: boolean;
  className?: string;
}

const WEATHER_STRING_TO_CODE: Record<string, number> = {
  clear: WEATHER_CODES.CLEAR,
  despejado: WEATHER_CODES.CLEAR,
  sunny: WEATHER_CODES.CLEAR,
  soleado: WEATHER_CODES.CLEAR,
  light_cloud: WEATHER_CODES.LIGHT_CLOUD,
  'light cloud': WEATHER_CODES.LIGHT_CLOUD,
  'ligeramente nublado': WEATHER_CODES.LIGHT_CLOUD,
  partly: WEATHER_CODES.LIGHT_CLOUD,
  overcast: WEATHER_CODES.OVERCAST,
  cloudy: WEATHER_CODES.OVERCAST,
  nublado: WEATHER_CODES.OVERCAST,
  light_rain: WEATHER_CODES.LIGHT_RAIN,
  'light rain': WEATHER_CODES.LIGHT_RAIN,
  drizzle: WEATHER_CODES.LIGHT_RAIN,
  'lluvia ligera': WEATHER_CODES.LIGHT_RAIN,
  heavy_rain: WEATHER_CODES.HEAVY_RAIN,
  'heavy rain': WEATHER_CODES.HEAVY_RAIN,
  rain: WEATHER_CODES.HEAVY_RAIN,
  'lluvia intensa': WEATHER_CODES.HEAVY_RAIN,
  storm: WEATHER_CODES.STORM,
  thunder: WEATHER_CODES.STORM,
  tormenta: WEATHER_CODES.STORM,
};

const parseWeatherCode = (val?: string | number): number => {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val >= WEATHER_CODES.CLEAR && val <= WEATHER_CODES.STORM ? val : WEATHER_CODES.CLEAR;
  }
  if (!val || typeof val !== 'string') {
    return WEATHER_CODES.CLEAR;
  }
  const trimmed = val.trim().toLowerCase();
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && numeric >= WEATHER_CODES.CLEAR && numeric <= WEATHER_CODES.STORM) {
    return numeric;
  }
  return WEATHER_STRING_TO_CODE[trimmed] ?? WEATHER_CODES.CLEAR;
};

const getWeatherIcon = (weatherNameOrCode?: string | number, size = 14) => {
  const code = parseWeatherCode(weatherNameOrCode);

  switch (code) {
    case WEATHER_CODES.CLEAR:
      return <Sun size={size} color={cssVar('--weather-sun')} aria-hidden="true" />;
    case WEATHER_CODES.LIGHT_CLOUD:
      return <CloudSun size={size} color={cssVar('--weather-cloud-light')} aria-hidden="true" />;
    case WEATHER_CODES.OVERCAST:
      return <Cloud size={size} color={cssVar('--weather-cloud')} aria-hidden="true" />;
    case WEATHER_CODES.LIGHT_RAIN:
      return <CloudDrizzle size={size} color={cssVar('--weather-rain')} aria-hidden="true" />;
    case WEATHER_CODES.HEAVY_RAIN:
      return <CloudRain size={size} color={cssVar('--weather-rain-heavy')} aria-hidden="true" />;
    case WEATHER_CODES.STORM:
      return <CloudLightning size={size} color={cssVar('--weather-storm')} aria-hidden="true" />;
    default:
      return <CloudSun size={size} color={cssVar('--text-secondary')} aria-hidden="true" />;
  }
};

const getWeatherLabel = (
  weatherNameOrCode?: string | number,
  t?: (key: string, params?: Record<string, string | number>) => string
): string => {
  const code = parseWeatherCode(weatherNameOrCode);

  if (t) {
    switch (code) {
      case WEATHER_CODES.CLEAR:
        return t('common.clearWeather');
      case WEATHER_CODES.LIGHT_CLOUD:
        return t('live.weatherLightCloud');
      case WEATHER_CODES.OVERCAST:
        return t('live.weatherOvercast');
      case WEATHER_CODES.LIGHT_RAIN:
        return t('live.weatherLightRain');
      case WEATHER_CODES.HEAVY_RAIN:
        return t('live.weatherHeavyRain');
      case WEATHER_CODES.STORM:
        return t('live.weatherStorm');
    }
  }
  return WEATHER_TYPES[code] || 'Clear';
};

/** How likely rain is, which colours the percentage and its bar. */
const getRainLevel = (pct: number): 'heavy' | 'likely' | 'possible' | 'none' => {
  if (pct >= 70) return 'heavy';
  if (pct >= 30) return 'likely';
  if (pct >= 10) return 'possible';
  return 'none';
};

export const WeatherBadgeWithForecast: React.FC<WeatherBadgeWithForecastProps> = ({
  session,
  compact = false,
  className,
}) => {
  const { t } = useI18n();
  const units = useUnits();
  const triggerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    placement: 'top' | 'bottom';
  } | null>(null);

  const forecastSamples = useMemo<WeatherForecastSample[]>(() => {
    if (!session.weather_forecast) return [];
    const raw: WeatherForecastSample[] = Array.isArray(session.weather_forecast) ? session.weather_forecast : [];
    if (raw.length === 0) return [];

    // Filter samples for this session's specific type if available
    const sessionCode = getSessionTypeCode(session.session_type);
    if (sessionCode > 0) {
      const matched = raw.filter((s) => s.SessionType === sessionCode);
      if (matched.length > 0) {
        return matched;
      }
    }

    // Fallback: If no session type match or SessionType is not populated,
    // take the first group of samples before TimeOffset resets to 0 (avoiding concatenated weekend samples)
    const firstGroup: WeatherForecastSample[] = [];
    for (let i = 0; i < raw.length; i++) {
      const s = raw[i];
      const offset = s.TimeOffset ?? 0;
      if (i > 0 && offset === 0) {
        break; // Next session in the weekend starts
      }
      firstGroup.push(s);
    }
    return firstGroup.length > 0 ? firstGroup : raw;
  }, [session.weather_forecast, session.session_type]);

  const initialWeatherLabel = session.weather
    ? getWeatherLabel(session.weather, t)
    : forecastSamples.length > 0
      ? getWeatherLabel(forecastSamples[0].Weather, t)
      : t('common.clearWeather');

  const hasMultipleConditions = useMemo(() => {
    if (forecastSamples.length < 2) return false;
    const first = forecastSamples[0].Weather;
    return forecastSamples.some((s) => s.Weather !== first);
  }, [forecastSamples]);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 340;
    const popoverHeight = 52 + forecastSamples.length * 36 + 16;

    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    const placeAbove = spaceAbove >= popoverHeight + 12 || (spaceAbove > spaceBelow && spaceAbove > 180);

    let posTop: number | undefined;
    let posBottom: number | undefined;
    let placement: 'top' | 'bottom';

    if (placeAbove) {
      posBottom = window.innerHeight - rect.top + 8;
      placement = 'top';
    } else {
      posTop = rect.bottom + 8;
      placement = 'bottom';
    }

    let posLeft = rect.left;
    if (posLeft + popoverWidth > window.innerWidth - 12) {
      posLeft = Math.max(12, window.innerWidth - popoverWidth - 12);
    }
    if (posLeft < 12) {
      posLeft = 12;
    }

    setPopoverPos({
      top: posTop,
      bottom: posBottom,
      left: posLeft,
      placement,
    });
  }, [forecastSamples.length]);

  const handleMouseEnter = () => {
    if (forecastSamples.length > 0) {
      calculatePosition();
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  useEffect(() => {
    if (!isHovered) return;

    const handleScrollOrResize = () => {
      calculatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isHovered, calculatePosition]);

  return (
    <div
      ref={triggerRef}
      className={cx(styles.container, className)}
      data-weather-badge
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={cx(styles.trigger, compact && styles.compact, forecastSamples.length > 0 && styles.hasForecast)}
        data-open={(isHovered && forecastSamples.length > 0) || undefined}
      >
        {getWeatherIcon(session.weather || forecastSamples[0]?.Weather, compact ? 13 : 14)}
        <span className={styles.label}>{initialWeatherLabel}</span>
        {hasMultipleConditions && <span className={styles.changeDot} title={t('history.forecast.title')} />}
      </div>

      {/* Floating forecast popover */}
      {isHovered &&
        popoverPos &&
        forecastSamples.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles.popover}
            style={{
              top: popoverPos.top !== undefined ? `${popoverPos.top}px` : undefined,
              bottom: popoverPos.bottom !== undefined ? `${popoverPos.bottom}px` : undefined,
              left: `${popoverPos.left}px`,
            }}
          >
            <div className={styles.popoverHead}>
              <div className={styles.popoverTitle}>
                <CloudRain size={14} color={cssVar('--weather-rain')} aria-hidden="true" />
                <span>{t('history.forecast.title')}</span>
              </div>
              <span className={styles.sampleCount}>
                {forecastSamples.length} {t('history.forecast.timeline')}
              </span>
            </div>

            <ol className={styles.samples}>
              {forecastSamples.map((sample, idx) => {
                const weatherVal = sample.Weather ?? 0;
                const timeOffset = sample.TimeOffset ?? idx * 5;
                const rainPercent = sample.RainPercentage ?? 0;
                const trackTemp = sample.TrackTemperature;
                const airTemp = sample.AirTemperature;

                return (
                  <li key={idx} className={cx(styles.sample, idx === 0 && styles.current)}>
                    <div className={styles.when}>
                      <span className={styles.offset}>
                        {timeOffset === 0
                          ? t('history.forecast.current')
                          : t('history.forecast.minutesOffset', { mins: timeOffset })}
                      </span>
                      {getWeatherIcon(weatherVal, 13)}
                    </div>

                    <span className={styles.condition}>{getWeatherLabel(weatherVal, t)}</span>

                    <div className={styles.rain} data-rain={getRainLevel(rainPercent)}>
                      <Droplets size={11} aria-hidden="true" />
                      <span className={styles.rainPercent}>{rainPercent}%</span>
                      <div className={styles.rainTrack} aria-hidden="true">
                        <div
                          className={styles.rainFill}
                          style={{ width: `${Math.min(100, Math.max(0, rainPercent))}%` }}
                        />
                      </div>
                    </div>

                    {(trackTemp !== undefined || airTemp !== undefined) && (
                      <div
                        className={styles.temps}
                        title={`${t('common.airTemp')}: ${units.temperature(airTemp, 0, '-')} | ${t('common.trackTemp')}: ${units.temperature(trackTemp, 0, '-')}`}
                      >
                        <Thermometer size={10} color={cssVar('--accent-primary')} aria-hidden="true" />
                        <span>
                          {airTemp !== undefined ? Math.round(units.temperatureValue(airTemp)) : '-'}/
                          {units.temperature(trackTemp, 0, '-')}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>,
          document.body
        )}
    </div>
  );
};
