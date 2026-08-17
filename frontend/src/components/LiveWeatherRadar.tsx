import React from 'react';
import { Cloud, Sun, CloudRain, CloudLightning, CloudDrizzle, Thermometer, Droplets, TrendingUp, TrendingDown, Minus, Wind } from 'lucide-react';
import type { SessionData, WeatherForecastSample } from '../hooks/useTelemetry';

interface LiveWeatherRadarProps {
  session: SessionData | null;
}

export const LiveWeatherRadar: React.FC<LiveWeatherRadarProps> = ({ session }) => {
  const weatherCode = session?.Weather ?? 0;
  const trackTemp = session?.TrackTemperature ?? 28;
  const airTemp = session?.AirTemperature ?? 22;

  const getWeatherMeta = (wCode: number) => {
    switch (wCode) {
      case 0:
        return { name: 'Clear / Sunny', icon: <Sun size={18} color="#FFD700" />, rainLikelihood: '0%', dry: true };
      case 1:
        return { name: 'Light Cloud', icon: <Sun size={18} color="#FFE680" />, rainLikelihood: '5%', dry: true };
      case 2:
        return { name: 'Overcast', icon: <Cloud size={18} color="#B0C4DE" />, rainLikelihood: '20%', dry: true };
      case 3:
        return { name: 'Light Rain', icon: <CloudDrizzle size={18} color="#33CCFF" />, rainLikelihood: '60%', inter: true };
      case 4:
        return { name: 'Heavy Rain', icon: <CloudRain size={18} color="#0099FF" />, rainLikelihood: '90%', wet: true };
      case 5:
        return { name: 'Storm', icon: <CloudLightning size={18} color="#FF3366" />, rainLikelihood: '100%', wet: true };
      default:
        return { name: 'Clear', icon: <Sun size={18} color="#FFD700" />, rainLikelihood: '0%', dry: true };
    }
  };

  const getTempTrendIcon = (trend?: number) => {
    if (trend === 0 || trend === 1) {
      // 0 = up
      if (trend === 0) return <TrendingUp size={12} color="#ff6b6b" title="Rising" />;
      // 1 = down
      if (trend === 1) return <TrendingDown size={12} color="#33ccff" title="Falling" />;
    }
    return <Minus size={12} color="var(--text-muted)" title="Stable" />;
  };

  // Build forecast list
  const forecastSamples: WeatherForecastSample[] = React.useMemo(() => {
    if (session?.WeatherForecastSamples && session.WeatherForecastSamples.length > 0) {
      return session.WeatherForecastSamples;
    }
    // Fallback default timeline if no samples emitted by game yet
    return [
      {
        SessionType: session?.SessionType ?? 15,
        TimeOffset: 0,
        Weather: weatherCode,
        TrackTemperature: trackTemp,
        TrackTemperatureChange: 2,
        AirTemperature: airTemp,
        AirTemperatureChange: 2,
        RainPercentage: weatherCode >= 3 ? (weatherCode === 3 ? 55 : 90) : 0,
      },
      {
        SessionType: session?.SessionType ?? 15,
        TimeOffset: 5,
        Weather: weatherCode,
        TrackTemperature: trackTemp,
        TrackTemperatureChange: 2,
        AirTemperature: airTemp,
        AirTemperatureChange: 2,
        RainPercentage: weatherCode >= 3 ? (weatherCode === 3 ? 60 : 90) : 5,
      },
      {
        SessionType: session?.SessionType ?? 15,
        TimeOffset: 15,
        Weather: weatherCode,
        TrackTemperature: trackTemp,
        TrackTemperatureChange: 2,
        AirTemperature: airTemp,
        AirTemperatureChange: 2,
        RainPercentage: weatherCode >= 3 ? (weatherCode === 3 ? 65 : 95) : 10,
      },
      {
        SessionType: session?.SessionType ?? 15,
        TimeOffset: 30,
        Weather: weatherCode,
        TrackTemperature: trackTemp,
        TrackTemperatureChange: 2,
        AirTemperature: airTemp,
        AirTemperatureChange: 2,
        RainPercentage: weatherCode >= 3 ? (weatherCode === 3 ? 70 : 95) : 15,
      },
    ];
  }, [session, weatherCode, trackTemp, airTemp]);

  const currentWeather = getWeatherMeta(weatherCode);

  const getRainBarColor = (rainPct: number) => {
    if (rainPct >= 65) return 'var(--color-wet, #0099ff)';
    if (rainPct >= 35) return 'var(--color-inter, #33ff99)';
    if (rainPct >= 15) return 'var(--color-warning, #ffd700)';
    return 'var(--accent-primary, #33ffcc)';
  };

  const getRecommendedTyre = (rainPct: number, wCode: number) => {
    if (rainPct >= 70 || wCode >= 4) {
      return { label: 'FULL WET', color: '#0099FF', bg: 'rgba(0, 153, 255, 0.15)' };
    }
    if (rainPct >= 35 || wCode === 3) {
      return { label: 'INTERMEDIATE', color: '#33FF66', bg: 'rgba(51, 255, 102, 0.15)' };
    }
    return { label: 'SLICK (DRY)', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.12)' };
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
            <h3 className="race-hub-title">Weather Radar & Track Evolution</h3>
            <div className="race-hub-subtitle mono">Session Meteorological Forecast</div>
          </div>
        </div>

        <div className="race-hub-header-actions">
          <div
            className="weather-tyre-advice-badge mono"
            style={{ color: tyreAdv.color, background: tyreAdv.bg, border: `1px solid ${tyreAdv.color}40` }}
          >
            STRATEGY: {tyreAdv.label}
          </div>
        </div>
      </div>

      {/* Current Conditions Quick Strip */}
      <div className="weather-current-strip">
        <div className="weather-current-item">
          <div className="weather-curr-icon-box">{currentWeather.icon}</div>
          <div>
            <div className="readout-label">CURRENT SKY</div>
            <div className="mono font-semibold" style={{ fontSize: '0.92rem' }}>
              {currentWeather.name}
            </div>
          </div>
        </div>

        <div className="weather-current-item">
          <Thermometer size={16} color="#FF6B6B" />
          <div>
            <div className="readout-label">TRACK TEMP</div>
            <div className="mono font-semibold" style={{ fontSize: '0.92rem' }}>
              {trackTemp}°C
            </div>
          </div>
        </div>

        <div className="weather-current-item">
          <Wind size={16} color="#33CCFF" />
          <div>
            <div className="readout-label">AIR TEMP</div>
            <div className="mono font-semibold" style={{ fontSize: '0.92rem' }}>
              {airTemp}°C
            </div>
          </div>
        </div>

        <div className="weather-current-item">
          <Droplets size={16} color={highestRainInWindow > 30 ? '#33CCFF' : 'var(--text-muted)'} />
          <div>
            <div className="readout-label">PEAK RAIN RISK</div>
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
          const meta = getWeatherMeta(sample.Weather);
          const offsetLabel = sample.TimeOffset === 0 ? 'NOW' : `+${sample.TimeOffset} MIN`;
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
                  <span>Rain</span>
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
                <span title="Track Temp">
                  T: {sample.TrackTemperature}°C {getTempTrendIcon(sample.TrackTemperatureChange)}
                </span>
                <span title="Air Temp">
                  A: {sample.AirTemperature}°C {getTempTrendIcon(sample.AirTemperatureChange)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
