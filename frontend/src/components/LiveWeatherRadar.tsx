import React from 'react';
import { Cloud, Sun, CloudRain, CloudLightning, CloudDrizzle, Thermometer, Droplets, TrendingUp, TrendingDown, Minus, Wind } from 'lucide-react';
import type { SessionData, WeatherForecastSample } from '../hooks/useTelemetry';
import { WEATHER_CODES, SESSION_TYPES } from '../constants/f1';
import { useI18n } from '../context/I18nContext';

import { useTelemetryStore } from '../store/useTelemetryStore';

interface LiveWeatherRadarProps {
  session?: SessionData | null;
}

export const LiveWeatherRadar: React.FC<LiveWeatherRadarProps> = React.memo((props) => {
  const storeSession = useTelemetryStore((s) => s.session);
  const session = props.session !== undefined ? props.session : storeSession;

  const { t } = useI18n();
  const weatherCode = session?.Weather ?? WEATHER_CODES.CLEAR;
  const trackTemp = session?.TrackTemperature ?? 28;
  const airTemp = session?.AirTemperature ?? 22;

  const getWeatherMeta = (wCode: number) => {
    switch (wCode) {
      case WEATHER_CODES.CLEAR:
        return {
          name: t('live.weatherClearSunny'),
          icon: <Sun size={18} color="#FFD700" />,
          rainLikelihood: '0%',
          dry: true,
        };
      case WEATHER_CODES.LIGHT_CLOUD:
        return {
          name: t('live.weatherLightCloud'),
          icon: <Sun size={18} color="#FFE680" />,
          rainLikelihood: '5%',
          dry: true,
        };
      case WEATHER_CODES.OVERCAST:
        return {
          name: t('live.weatherOvercast'),
          icon: <Cloud size={18} color="#B0C4DE" />,
          rainLikelihood: '20%',
          dry: true,
        };
      case WEATHER_CODES.LIGHT_RAIN:
        return {
          name: t('live.weatherLightRain'),
          icon: <CloudDrizzle size={18} color="#33CCFF" />,
          rainLikelihood: '60%',
          inter: true,
        };
      case WEATHER_CODES.HEAVY_RAIN:
        return {
          name: t('live.weatherHeavyRain'),
          icon: <CloudRain size={18} color="#0099FF" />,
          rainLikelihood: '90%',
          wet: true,
        };
      case WEATHER_CODES.STORM:
        return {
          name: t('live.weatherStorm'),
          icon: <CloudLightning size={18} color="#FF3366" />,
          rainLikelihood: '100%',
          wet: true,
        };
      default:
        return {
          name: t('common.clearWeather'),
          icon: <Sun size={18} color="#FFD700" />,
          rainLikelihood: '0%',
          dry: true,
        };
    }
  };

  const getRainBarColor = (pct: number) => {
    if (pct >= 70) return '#0099FF';
    if (pct >= 35) return '#33FF66';
    if (pct >= 10) return '#FFD700';
    return '#A0A0A0';
  };

  const getTempTrendIcon = (change: number) => {
    if (change === 1) return <TrendingUp size={11} color="#FF4757" />;
    if (change === 2) return <TrendingDown size={11} color="#33CCFF" />;
    return <Minus size={11} color="var(--text-muted)" />;
  };

  const forecastSamples: WeatherForecastSample[] = React.useMemo(() => {
    if (session?.WeatherForecastSamples && session.WeatherForecastSamples.length > 0) {
      const raw = session.WeatherForecastSamples;
      if (session.SessionType !== undefined && session.SessionType > 0) {
        const matched = raw.filter((s) => s.SessionType === session.SessionType);
        if (matched.length > 0) return matched;
      }
      const firstGroup: WeatherForecastSample[] = [];
      for (let i = 0; i < raw.length; i++) {
        if (i > 0 && raw[i].TimeOffset === 0) break;
        firstGroup.push(raw[i]);
      }
      return firstGroup.length > 0 ? firstGroup : raw;
    }
    return [
          {
            SessionType: session?.SessionType ?? SESSION_TYPES.SPRINT_Q1,
            TimeOffset: 0,
            Weather: weatherCode,
            TrackTemperature: trackTemp,
            TrackTemperatureChange: 0,
            AirTemperature: airTemp,
            AirTemperatureChange: 0,
            RainPercentage: weatherCode >= WEATHER_CODES.HEAVY_RAIN ? 85 : weatherCode === WEATHER_CODES.LIGHT_RAIN ? 45 : 0,
          },
          {
            SessionType: session?.SessionType ?? SESSION_TYPES.SPRINT_Q1,
            TimeOffset: 5,
            Weather: weatherCode,
            TrackTemperature: trackTemp,
            TrackTemperatureChange: 0,
            AirTemperature: airTemp,
            AirTemperatureChange: 0,
            RainPercentage: weatherCode >= WEATHER_CODES.HEAVY_RAIN ? 90 : weatherCode === WEATHER_CODES.LIGHT_RAIN ? 55 : 5,
          },
          {
            SessionType: session?.SessionType ?? SESSION_TYPES.SPRINT_Q1,
            TimeOffset: 10,
            Weather: weatherCode,
            TrackTemperature: trackTemp,
            TrackTemperatureChange: 1,
            AirTemperature: airTemp,
            AirTemperatureChange: 0,
            RainPercentage: weatherCode >= WEATHER_CODES.HEAVY_RAIN ? 95 : weatherCode === WEATHER_CODES.LIGHT_RAIN ? 65 : 10,
          },
          {
            SessionType: session?.SessionType ?? SESSION_TYPES.SPRINT_Q1,
            TimeOffset: 15,
            Weather: weatherCode,
            TrackTemperature: trackTemp,
            TrackTemperatureChange: 1,
            AirTemperature: airTemp,
            AirTemperatureChange: 1,
            RainPercentage: weatherCode >= WEATHER_CODES.HEAVY_RAIN ? 80 : weatherCode === WEATHER_CODES.LIGHT_RAIN ? 40 : 15,
          },
        ];
  }, [session?.WeatherForecastSamples, session?.SessionType, weatherCode, trackTemp, airTemp]);

  const currentWeather = getWeatherMeta(weatherCode);

  const getRecommendedTyre = (rainPct: number, wCode: number) => {
    if (rainPct >= 70 || wCode >= WEATHER_CODES.HEAVY_RAIN) {
      return { label: t('live.fullWet'), color: '#0099FF', bg: 'rgba(0, 153, 255, 0.15)' };
    }
    if (rainPct >= 35 || wCode === WEATHER_CODES.LIGHT_RAIN) {
      return { label: t('live.intermediate'), color: '#33FF66', bg: 'rgba(51, 255, 102, 0.15)' };
    }
    return { label: t('live.slickDry'), color: '#FFD700', bg: 'rgba(255, 215, 0, 0.12)' };
  };

  const highestRainInWindow = Math.max(...forecastSamples.map((s) => s.RainPercentage || 0));
  const tyreAdv = getRecommendedTyre(highestRainInWindow, weatherCode);

  return (
    <div className="glass-panel race-hub-card live-weather-radar-panel">
      {/* Panel Header */}
      <div className="race-hub-header">
        <div className="race-hub-title-group">
          <div className="race-hub-icon-wrap">
            <Droplets size={16} color="#33CCFF" />
          </div>
          <div>
            <h3 className="race-hub-title">
              {t('live.weatherRadarTitle')}
            </h3>
            <div className="race-hub-subtitle mono">
              {t('live.sessionForecast')}
            </div>
          </div>
        </div>

        <div className="race-hub-header-actions">
          <div
            className="weather-tyre-advice-badge mono"
            style={{ color: tyreAdv.color, background: tyreAdv.bg, border: `1px solid ${tyreAdv.color}40` }}
          >
            {t('live.strategyLabel')} {tyreAdv.label}
          </div>
        </div>
      </div>

      {/* Current Conditions Quick Strip */}
      <div className="weather-current-strip">
        <div className="weather-current-item">
          <div className="weather-curr-icon-box">{currentWeather.icon}</div>
          <div>
            <div className="readout-label">{t('live.currentSky')}</div>
            <div className="mono font-semibold" style={{ fontSize: '0.92rem' }}>
              {currentWeather.name}
            </div>
          </div>
        </div>

        <div className="weather-current-item">
          <Thermometer size={16} color="#FF6B6B" />
          <div>
            <div className="readout-label">{t('live.trackTemp')}</div>
            <div className="mono font-semibold" style={{ fontSize: '0.92rem' }}>
              {trackTemp}°C
            </div>
          </div>
        </div>

        <div className="weather-current-item">
          <Wind size={16} color="#33CCFF" />
          <div>
            <div className="readout-label">{t('live.airTemp')}</div>
            <div className="mono font-semibold" style={{ fontSize: '0.92rem' }}>
              {airTemp}°C
            </div>
          </div>
        </div>

        <div className="weather-current-item">
          <Droplets size={16} color={highestRainInWindow > 30 ? '#33CCFF' : 'var(--text-muted)'} />
          <div>
            <div className="readout-label">{t('live.peakRainRisk')}</div>
            <div
              className="mono font-semibold"
              style={{
                fontSize: '0.92rem',
                color: highestRainInWindow > 50 ? '#33CCFF' : highestRainInWindow > 20 ? '#FFD700' : 'var(--accent-primary)',
              }}
            >
              {highestRainInWindow}%
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Forecast Grid */}
      <div className="weather-forecast-grid">
        {forecastSamples.slice(0, 4).map((sample, idx) => {
          const meta = getWeatherMeta(sample.Weather ?? 0);
          const offsetLabel = sample.TimeOffset === 0 ? t('live.now') : `+${sample.TimeOffset ?? idx * 5} MIN`;
          const rain = sample.RainPercentage || 0;
          const barColor = getRainBarColor(rain);

          return (
            <div key={idx} className="weather-forecast-col">
              <div className="forecast-time-badge mono">{offsetLabel}</div>
              <div className="forecast-icon-wrap">{meta.icon}</div>
              <div className="forecast-condition-name">{meta.name}</div>

              {/* Rain Probability Bar */}
              <div className="forecast-rain-wrap">
                <div className="forecast-rain-header mono">
                  <span>{t('common.rain')}</span>
                  <span style={{ color: barColor, fontWeight: 700 }}>{rain}%</span>
                </div>
                <div className="forecast-bar-track">
                  <div
                    className="forecast-bar-fill"
                    style={{
                      width: `${Math.max(4, rain)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>

              {/* Temp Trends */}
              <div className="forecast-temp-row mono">
                <span title={t('common.trackTemp')}>
                  T: {sample.TrackTemperature ?? '-'}°C {getTempTrendIcon(sample.TrackTemperatureChange ?? 0)}
                </span>
                <span title={t('common.airTemp')}>
                  A: {sample.AirTemperature ?? '-'}°C {getTempTrendIcon(sample.AirTemperatureChange ?? 0)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

LiveWeatherRadar.displayName = 'LiveWeatherRadar';

