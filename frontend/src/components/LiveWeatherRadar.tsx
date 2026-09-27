import React from 'react';
import {
  Cloud,
  Sun,
  CloudRain,
  CloudLightning,
  CloudDrizzle,
  Thermometer,
  Droplets,
  TrendingUp,
  TrendingDown,
  Minus,
  Wind,
} from 'lucide-react';
import type { SessionData, WeatherForecastSample } from '../hooks/useTelemetry';
import { WEATHER_CODES, SESSION_TYPES, DEFAULT_WEATHER_DEFAULTS } from '../constants/f1';
import { useI18n } from '../context/I18nContext';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { cssVar, styleVars } from '../styles/theme';
import { Badge } from './ui/Badge';
import { Panel, PanelHeader } from './ui/Panel';
import { Stat } from './ui/Stat';
import styles from './LiveWeatherRadar.module.css';

const SUN = cssVar('--weather-sun');
const RAIN = cssVar('--weather-rain');
const WET = cssVar('--f1-compound-wet');
const INTER = cssVar('--f1-compound-inter');

interface LiveWeatherRadarProps {
  className?: string;
  session?: SessionData | null;
}

export const LiveWeatherRadar: React.FC<LiveWeatherRadarProps> = React.memo((props) => {
  const storeSession = useSessionStatusStore((s) => s.session);
  const session = props.session !== undefined ? props.session : storeSession;

  const { t } = useI18n();
  const weatherCode = session?.Weather ?? WEATHER_CODES.CLEAR;
  const trackTemp = session?.TrackTemperature ?? DEFAULT_WEATHER_DEFAULTS.TRACK_TEMP;
  const airTemp = session?.AirTemperature ?? DEFAULT_WEATHER_DEFAULTS.AIR_TEMP;

  const getWeatherMeta = (wCode: number) => {
    switch (wCode) {
      case WEATHER_CODES.CLEAR:
        return {
          name: t('live.weatherClearSunny'),
          icon: <Sun size={18} color={SUN} />,
          rainLikelihood: '0%',
          dry: true,
        };
      case WEATHER_CODES.LIGHT_CLOUD:
        return {
          name: t('live.weatherLightCloud'),
          icon: <Sun size={18} color={cssVar('--weather-cloud-light')} />,
          rainLikelihood: '5%',
          dry: true,
        };
      case WEATHER_CODES.OVERCAST:
        return {
          name: t('live.weatherOvercast'),
          icon: <Cloud size={18} color={cssVar('--weather-cloud')} />,
          rainLikelihood: '20%',
          dry: true,
        };
      case WEATHER_CODES.LIGHT_RAIN:
        return {
          name: t('live.weatherLightRain'),
          icon: <CloudDrizzle size={18} color={RAIN} />,
          rainLikelihood: '60%',
          inter: true,
        };
      case WEATHER_CODES.HEAVY_RAIN:
        return {
          name: t('live.weatherHeavyRain'),
          icon: <CloudRain size={18} color={cssVar('--weather-rain-heavy')} />,
          rainLikelihood: '90%',
          wet: true,
        };
      case WEATHER_CODES.STORM:
        return {
          name: t('live.weatherStorm'),
          icon: <CloudLightning size={18} color={cssVar('--weather-storm')} />,
          rainLikelihood: '100%',
          wet: true,
        };
      default:
        return {
          name: t('common.clearWeather'),
          icon: <Sun size={18} color={SUN} />,
          rainLikelihood: '0%',
          dry: true,
        };
    }
  };

  const getRainBarColor = (pct: number) => {
    if (pct >= 70) return WET;
    if (pct >= 35) return INTER;
    if (pct >= 10) return cssVar('--status-warning');
    return cssVar('--text-muted');
  };

  const getTempTrendIcon = (change: number) => {
    if (change === 1) return <TrendingUp size={11} color={cssVar('--weather-warm')} />;
    if (change === 2) return <TrendingDown size={11} color={cssVar('--weather-cool')} />;
    return <Minus size={11} color={cssVar('--text-muted')} />;
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
        RainPercentage:
          weatherCode >= WEATHER_CODES.HEAVY_RAIN ? 85 : weatherCode === WEATHER_CODES.LIGHT_RAIN ? 45 : 0,
      },
      {
        SessionType: session?.SessionType ?? SESSION_TYPES.SPRINT_Q1,
        TimeOffset: 5,
        Weather: weatherCode,
        TrackTemperature: trackTemp,
        TrackTemperatureChange: 0,
        AirTemperature: airTemp,
        AirTemperatureChange: 0,
        RainPercentage:
          weatherCode >= WEATHER_CODES.HEAVY_RAIN ? 90 : weatherCode === WEATHER_CODES.LIGHT_RAIN ? 55 : 5,
      },
      {
        SessionType: session?.SessionType ?? SESSION_TYPES.SPRINT_Q1,
        TimeOffset: 10,
        Weather: weatherCode,
        TrackTemperature: trackTemp,
        TrackTemperatureChange: 1,
        AirTemperature: airTemp,
        AirTemperatureChange: 0,
        RainPercentage:
          weatherCode >= WEATHER_CODES.HEAVY_RAIN ? 95 : weatherCode === WEATHER_CODES.LIGHT_RAIN ? 65 : 10,
      },
      {
        SessionType: session?.SessionType ?? SESSION_TYPES.SPRINT_Q1,
        TimeOffset: 15,
        Weather: weatherCode,
        TrackTemperature: trackTemp,
        TrackTemperatureChange: 1,
        AirTemperature: airTemp,
        AirTemperatureChange: 1,
        RainPercentage:
          weatherCode >= WEATHER_CODES.HEAVY_RAIN ? 80 : weatherCode === WEATHER_CODES.LIGHT_RAIN ? 40 : 15,
      },
    ];
  }, [session?.WeatherForecastSamples, session?.SessionType, weatherCode, trackTemp, airTemp]);

  const currentWeather = getWeatherMeta(weatherCode);

  const getRecommendedTyre = (rainPct: number, wCode: number) => {
    if (rainPct >= 70 || wCode >= WEATHER_CODES.HEAVY_RAIN) {
      return { label: t('live.fullWet'), color: WET };
    }
    if (rainPct >= 35 || wCode === WEATHER_CODES.LIGHT_RAIN) {
      return { label: t('live.intermediate'), color: INTER };
    }
    return { label: t('live.slickDry'), color: SUN };
  };

  const highestRainInWindow = Math.max(...forecastSamples.map((s) => s.RainPercentage || 0));
  const tyreAdv = getRecommendedTyre(highestRainInWindow, weatherCode);

  return (
    <Panel className={props.className}>
      <PanelHeader
        icon={<Droplets size={16} color={RAIN} />}
        title={t('live.weatherRadarTitle')}
        subtitle={t('live.sessionForecast')}
        actions={
          <Badge color={tyreAdv.color} size="md">
            {t('live.strategyLabel')} {tyreAdv.label}
          </Badge>
        }
      />

      {/* Current conditions */}
      <div className={styles.current}>
        <Stat icon={currentWeather.icon} label={t('live.currentSky')} value={currentWeather.name} mono={false} />
        <Stat
          icon={<Thermometer size={16} color={cssVar('--weather-warm')} />}
          label={t('live.trackTemp')}
          value={`${trackTemp}°C`}
        />
        <Stat icon={<Wind size={16} color={RAIN} />} label={t('live.airTemp')} value={`${airTemp}°C`} />
        <Stat
          icon={<Droplets size={16} color={highestRainInWindow > 30 ? RAIN : cssVar('--text-muted')} />}
          label={t('live.peakRainRisk')}
          value={`${highestRainInWindow}%`}
          valueClassName={
            highestRainInWindow > 50 ? styles.rainHigh : highestRainInWindow > 20 ? styles.rainMedium : undefined
          }
        />
      </div>

      {/* Forecast timeline */}
      <ol className={styles.forecast} aria-label={t('live.sessionForecast')}>
        {forecastSamples.slice(0, 4).map((sample, idx) => {
          const meta = getWeatherMeta(sample.Weather ?? 0);
          const offsetLabel =
            sample.TimeOffset === 0
              ? t('live.now')
              : t('live.forecastOffset', { minutes: sample.TimeOffset ?? idx * 5 });
          const rain = sample.RainPercentage || 0;

          return (
            <li key={idx} className={styles.column}>
              <div className={`mono ${styles.offset}`}>{offsetLabel}</div>
              <div className={styles.icon} aria-hidden="true">
                {meta.icon}
              </div>
              <div className={styles.condition}>{meta.name}</div>

              {/* Rain probability bar */}
              <div
                className={styles.rain}
                style={styleVars({ '--bar-color': getRainBarColor(rain), '--bar-width': `${Math.max(4, rain)}%` })}
              >
                <div className={`mono ${styles.rainHeader}`}>
                  <span>{t('common.rain')}</span>
                  <span className={styles.rainValue}>{rain}%</span>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} />
                </div>
              </div>

              {/* Temperature trends */}
              <div className={`mono ${styles.temps}`}>
                <span title={t('common.trackTemp')}>
                  T: {sample.TrackTemperature ?? '-'}°C {getTempTrendIcon(sample.TrackTemperatureChange ?? 0)}
                </span>
                <span title={t('common.airTemp')}>
                  A: {sample.AirTemperature ?? '-'}°C {getTempTrendIcon(sample.AirTemperatureChange ?? 0)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
});

LiveWeatherRadar.displayName = 'LiveWeatherRadar';
