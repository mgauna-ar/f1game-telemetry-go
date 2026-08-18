import React, { useState, useMemo } from 'react';
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
import { useI18n } from '../../context/I18nContext';

interface WeatherBadgeWithForecastProps {
  session: Session;
  compact?: boolean;
  className?: string;
}

const getWeatherIcon = (weatherNameOrCode?: string | number, size = 14) => {
  const code = typeof weatherNameOrCode === 'number' ? weatherNameOrCode : -1;
  const str = typeof weatherNameOrCode === 'string' ? weatherNameOrCode.toLowerCase() : '';

  if (code === 0 || str === 'clear') {
    return <Sun size={size} color="#f59e0b" />;
  }
  if (code === 1 || str.includes('light cloud') || str === 'partly cloudy') {
    return <CloudSun size={size} color="#38bdf8" />;
  }
  if (code === 2 || str.includes('overcast') || str === 'cloudy') {
    return <Cloud size={size} color="#94a3b8" />;
  }
  if (code === 3 || str.includes('light rain') || str === 'drizzle') {
    return <CloudDrizzle size={size} color="#06b6d4" />;
  }
  if (code === 4 || str.includes('heavy rain') || str === 'rain') {
    return <CloudRain size={size} color="#3b82f6" />;
  }
  if (code === 5 || str.includes('storm') || str.includes('thunder')) {
    return <CloudLightning size={size} color="#a855f7" />;
  }
  return <CloudSun size={size} color="var(--text-secondary)" />;
};

const getWeatherLabel = (weatherNameOrCode?: string | number): string => {
  if (typeof weatherNameOrCode === 'string' && weatherNameOrCode && weatherNameOrCode !== 'Unknown') {
    return weatherNameOrCode;
  }
  const code = typeof weatherNameOrCode === 'number' ? weatherNameOrCode : 0;
  switch (code) {
    case 0:
      return 'Clear';
    case 1:
      return 'Light Cloud';
    case 2:
      return 'Overcast';
    case 3:
      return 'Light Rain';
    case 4:
      return 'Heavy Rain';
    case 5:
      return 'Storm';
    default:
      return 'Clear';
  }
};

export const WeatherBadgeWithForecast: React.FC<WeatherBadgeWithForecastProps> = ({
  session,
  compact = false,
  className = '',
}) => {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);

  const forecastSamples = useMemo<WeatherForecastSample[]>(() => {
    if (!session.weather_forecast) return [];
    if (Array.isArray(session.weather_forecast)) {
      return session.weather_forecast;
    }
    if (typeof session.weather_forecast === 'string' && session.weather_forecast.trim()) {
      try {
        const parsed = JSON.parse(session.weather_forecast);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  }, [session.weather_forecast]);

  const initialWeather = session.weather || (forecastSamples.length > 0 ? getWeatherLabel(forecastSamples[0].Weather ?? forecastSamples[0].weather) : t('common.clearWeather'));

  const hasMultipleConditions = useMemo(() => {
    if (forecastSamples.length < 2) return false;
    const first = forecastSamples[0].Weather ?? forecastSamples[0].weather;
    return forecastSamples.some((s) => (s.Weather ?? s.weather) !== first);
  }, [forecastSamples]);

  return (
    <div
      className={`weather-badge-container ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
        {getWeatherIcon(initialWeather, compact ? 13 : 14)}
        <span style={{ fontSize: compact ? '0.78rem' : '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>
          {initialWeather}
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

      {/* Floating Glassmorphic Forecast Popover */}
      {isHovered && forecastSamples.length > 0 && (
        <div
          className="glass-panel weather-forecast-popover"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            zIndex: 1000,
            width: '320px',
            padding: '12px 14px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            animation: 'fadeIn 0.15s ease',
            pointerEvents: 'none',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CloudRain size={14} color="var(--accent-cyan, #06b6d4)" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                {t('history.forecast.title')}
              </span>
            </div>
            <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {forecastSamples.length} {t('history.forecast.timeline')}
            </span>
          </div>

          {/* Forecast Samples Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {forecastSamples.map((sample, idx) => {
              const weatherVal = sample.Weather ?? sample.weather ?? 0;
              const timeOffset = sample.TimeOffset ?? sample.time_offset ?? idx * 5;
              const rainPercent = sample.RainPercentage ?? sample.rain_percentage ?? 0;
              const trackTemp = sample.TrackTemperature ?? sample.track_temperature;
              const airTemp = sample.AirTemperature ?? sample.air_temperature;
              const conditionName = getWeatherLabel(weatherVal);

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '4px 6px',
                    background: idx === 0 ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    borderRadius: '6px',
                  }}
                >
                  {/* Time pill & Weather Icon */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '95px' }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: idx === 0 ? 'var(--accent-cyan, #06b6d4)' : 'var(--text-secondary)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                      }}
                    >
                      {timeOffset === 0 ? t('history.forecast.current') : t('history.forecast.minutesOffset', { mins: timeOffset })}
                    </span>
                    {getWeatherIcon(weatherVal, 13)}
                  </div>

                  {/* Weather Label */}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {conditionName}
                  </span>

                  {/* Rain Chance Bar & Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: '65px', justifyContent: 'flex-end' }}>
                    <Droplets size={11} color={rainPercent > 30 ? '#38bdf8' : 'var(--text-muted)'} />
                    <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 600, color: rainPercent > 30 ? '#38bdf8' : 'var(--text-secondary)' }}>
                      {rainPercent}%
                    </span>
                  </div>

                  {/* Temperature Chips */}
                  {(trackTemp !== undefined || airTemp !== undefined) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-muted)' }} className="mono">
                      <Thermometer size={10} />
                      <span>{airTemp ?? '-'}/{trackTemp ?? '-'}°C</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
