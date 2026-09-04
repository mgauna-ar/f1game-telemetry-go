import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudLightning,
  Droplets,
  Thermometer,
} from 'lucide-react';
import type { Session, WeatherForecastSample } from '../../types/session';
import { WEATHER_CODES, WEATHER_TYPES, getSessionTypeCode } from '../../constants/f1';
import { useI18n } from '../../context/I18nContext';

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
      return <Sun size={size} color="#f59e0b" />;
    case WEATHER_CODES.LIGHT_CLOUD:
      return <CloudSun size={size} color="#38bdf8" />;
    case WEATHER_CODES.OVERCAST:
      return <Cloud size={size} color="#94a3b8" />;
    case WEATHER_CODES.LIGHT_RAIN:
      return <CloudDrizzle size={size} color="#06b6d4" />;
    case WEATHER_CODES.HEAVY_RAIN:
      return <CloudRain size={size} color="#3b82f6" />;
    case WEATHER_CODES.STORM:
      return <CloudLightning size={size} color="#a855f7" />;
    default:
      return <CloudSun size={size} color="var(--text-secondary)" />;
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

const getRainColor = (pct: number): string => {
  if (pct >= 70) return '#3b82f6';
  if (pct >= 30) return '#06b6d4';
  if (pct >= 10) return '#eab308';
  return 'var(--text-muted)';
};

export const WeatherBadgeWithForecast: React.FC<WeatherBadgeWithForecastProps> = ({
  session,
  compact = false,
  className = '',
}) => {
  const { t } = useI18n();
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
    const raw: WeatherForecastSample[] = Array.isArray(session.weather_forecast)
      ? session.weather_forecast
      : [];
    if (raw.length === 0) return [];

    // Filter samples for this session's specific type if available
    const sessionCode = getSessionTypeCode(session.session_type);
    if (sessionCode > 0) {
      const matched = raw.filter((s) => (s.SessionType ?? s.session_type) === sessionCode);
      if (matched.length > 0) {
        return matched;
      }
    }

    // Fallback: If no session type match or SessionType is not populated,
    // take the first group of samples before TimeOffset resets to 0 (avoiding concatenated weekend samples)
    const firstGroup: WeatherForecastSample[] = [];
    for (let i = 0; i < raw.length; i++) {
      const s = raw[i];
      const offset = s.TimeOffset ?? s.time_offset ?? 0;
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
    ? getWeatherLabel(forecastSamples[0].Weather ?? forecastSamples[0].weather, t)
    : t('common.clearWeather');

  const hasMultipleConditions = useMemo(() => {
    if (forecastSamples.length < 2) return false;
    const first = forecastSamples[0].Weather ?? forecastSamples[0].weather;
    return forecastSamples.some((s) => (s.Weather ?? s.weather) !== first);
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
      className={`weather-badge-container ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <div
        className="weather-badge-trigger"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: compact ? '2px 6px' : '4px 8px',
          borderRadius: '6px',
          background: isHovered && forecastSamples.length > 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
          border: '1px solid',
          borderColor: isHovered && forecastSamples.length > 0 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)',
          cursor: forecastSamples.length > 0 ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
        }}
      >
        {getWeatherIcon(session.weather || (forecastSamples[0]?.Weather ?? forecastSamples[0]?.weather), compact ? 13 : 14)}
        <span style={{ fontSize: compact ? '0.78rem' : '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>
          {initialWeatherLabel}
        </span>
        {hasMultipleConditions && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-cyan, #06b6d4)',
              boxShadow: '0 0 6px rgba(6, 182, 212, 0.8)',
            }}
            title={t('history.forecast.title')}
          />
        )}
      </div>

      {/* Floating Portal Weather Forecast Popover */}
      {isHovered && popoverPos && forecastSamples.length > 0 && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="glass-panel weather-forecast-popover"
            style={{
              position: 'fixed',
              top: popoverPos.top !== undefined ? `${popoverPos.top}px` : undefined,
              bottom: popoverPos.bottom !== undefined ? `${popoverPos.bottom}px` : undefined,
              left: `${popoverPos.left}px`,
              zIndex: 99999,
              width: '340px',
              maxWidth: 'calc(100vw - 24px)',
              padding: '12px 14px',
              background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98) 0%, rgba(20, 30, 55, 0.98) 100%)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(0, 242, 254, 0.25)',
              borderRadius: '10px',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65), 0 0 1px rgba(0, 242, 254, 0.4)',
              animation: 'fadeIn 0.15s ease',
              pointerEvents: 'none',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CloudRain size={14} color="var(--accent-cyan, #06b6d4)" />
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: 'var(--text-primary)',
                  }}
                >
                  {t('history.forecast.title')}
                </span>
              </div>
              <span
                className="mono"
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--accent-cyan, #06b6d4)',
                  background: 'rgba(6, 182, 212, 0.12)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(6, 182, 212, 0.2)',
                }}
              >
                {forecastSamples.length} {t('history.forecast.timeline')}
              </span>
            </div>

            {/* Forecast Samples Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {forecastSamples.map((sample, idx) => {
                const weatherVal = sample.Weather ?? sample.weather ?? 0;
                const timeOffset = sample.TimeOffset ?? sample.time_offset ?? idx * 5;
                const rainPercent = sample.RainPercentage ?? sample.rain_percentage ?? 0;
                const trackTemp = sample.TrackTemperature ?? sample.track_temperature;
                const airTemp = sample.AirTemperature ?? sample.air_temperature;
                const conditionName = getWeatherLabel(weatherVal, t);
                const rainColor = getRainColor(rainPercent);

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '5px 8px',
                      background: idx === 0 ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: idx === 0 ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    {/* Time pill & Weather Icon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '85px' }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: idx === 0 ? 'var(--accent-cyan, #06b6d4)' : 'var(--text-secondary)',
                          background: idx === 0 ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        {timeOffset === 0
                          ? t('history.forecast.current')
                          : t('history.forecast.minutesOffset', { mins: timeOffset })}
                      </span>
                      {getWeatherIcon(weatherVal, 13)}
                    </div>

                    {/* Weather Label */}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-primary)',
                        flex: 1,
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        fontWeight: idx === 0 ? 600 : 400,
                      }}
                    >
                      {conditionName}
                    </span>

                    {/* Rain Chance Bar & Indicator */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        minWidth: '65px',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Droplets size={11} color={rainColor} />
                      <span
                        className="mono"
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: rainColor,
                          minWidth: '28px',
                          textAlign: 'right',
                        }}
                      >
                        {rainPercent}%
                      </span>
                      <div
                        style={{
                          width: '24px',
                          height: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, rainPercent))}%`,
                            height: '100%',
                            backgroundColor: rainColor,
                            borderRadius: '2px',
                          }}
                        />
                      </div>
                    </div>

                    {/* Temperature Chips */}
                    {(trackTemp !== undefined || airTemp !== undefined) && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          minWidth: '60px',
                          justifyContent: 'flex-end',
                        }}
                        className="mono"
                        title={`${t('common.airTemp')}: ${airTemp ?? '-'}°C | ${t('common.trackTemp')}: ${trackTemp ?? '-'}°C`}
                      >
                        <Thermometer size={10} color="var(--accent-primary, #ff3366)" />
                        <span>
                          {airTemp ?? '-'}/{trackTemp ?? '-'}°C
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
