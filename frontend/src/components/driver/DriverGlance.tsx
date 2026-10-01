import React from 'react';
import { ArrowDown, ArrowUp, Minus, MonitorSmartphone } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionStatusStore } from '../../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../../store/useTelemetryDataStore';
import { useScreenWakeLock } from '../../hooks/useScreenWakeLock';
import { parseDriverName } from '../../store/useTelemetryStore';
import {
  TIME_CONSTANTS,
  WHEELS_FRONT_FIRST,
  getErsModeName,
  isRaceSession,
  type LiveViewMode,
} from '../../constants/f1';
import {
  driverFlag,
  driverWarnings,
  ersPercent,
  formatGlanceGap,
  formatSignedDelta,
  playerGaps,
  tyreWearLevel,
  type GapReading,
} from '../../utils/driverGlance';
import { driverCode } from '../../utils/player';
import { formatDuration, formatLapTime } from '../../utils/formatters';
import { styleVars } from '../../styles/theme';
import { LiveStatusIndicator } from '../common/LiveStatusIndicator';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { LiveViewModeSwitch } from '../LiveViewModeSwitch';
import { Button } from '../ui/Button';
import styles from './DriverGlance.module.css';
import { useUnits } from '../../hooks/useUnits';

interface DriverGlanceProps {
  viewMode: LiveViewMode;
  onViewModeChange: (mode: LiveViewMode) => void;
}

const TREND_ICONS = { closing: ArrowDown, opening: ArrowUp, stable: Minus } as const;

/**
 * The Driver view: a phone on the rig, read at a glance. Big solid numbers with no blur or
 * animation: position, gaps with their trends, last vs best lap, tyres, fuel, ERS, flags and
 * warnings. Keeps the screen on while it shows.
 */
export const DriverGlance: React.FC<DriverGlanceProps> = ({ viewMode, onViewModeChange }) => {
  const { t } = useI18n();
  const units = useUnits();
  const session = useSessionStatusStore((s) => s.session);
  const participants = useSessionStatusStore((s) => s.participants);
  const playerIdx = useTelemetryDataStore((s) => s.playerCarIndex);
  const laps = useTelemetryDataStore((s) => s.allLaps);
  const lap = laps[playerIdx];
  const status = useTelemetryDataStore((s) => s.allCarStatus[s.playerCarIndex]);
  const damage = useTelemetryDataStore((s) => s.allCarDamage[s.playerCarIndex]);
  const telemetry = useTelemetryDataStore((s) => s.allTelemetry[s.playerCarIndex]);
  const bestLapTimes = useTelemetryDataStore((s) => s.bestLapTimes);
  const aheadTrend = useTelemetryDataStore((s) => s.gapAheadTrend);
  const behindTrend = useTelemetryDataStore((s) => s.gapBehindTrend);
  const wakeLock = useScreenWakeLock(true);

  const isRace = isRaceSession(session?.SessionType);
  const flag = driverFlag(session, status);
  const warnings = driverWarnings(lap, damage);
  const gaps = playerGaps(laps, playerIdx, aheadTrend, behindTrend);
  const carCount = laps.filter((l) => l?.CarPosition > 0).length;

  const carName = (idx: number) => {
    const p = participants[idx];
    return driverCode(parseDriverName(p?.Name, '', p?.DriverId), p?.RaceNumber);
  };

  const lastMs = lap?.LastLapTimeInMS ?? 0;
  const bestMs = bestLapTimes[playerIdx] ?? 0;
  const leaderIdx = laps.findIndex((l) => l?.CarPosition === 1);
  const leaderBestMs = leaderIdx >= 0 ? (bestLapTimes[leaderIdx] ?? 0) : 0;
  const ers = ersPercent(status);

  return (
    <div className={styles.driver} data-flag={flag ?? undefined} data-testid="driver-glance">
      <h1 className="sr-only">{t('live.driver.title')}</h1>

      <div className={styles.toolbar}>
        <LiveStatusIndicator />
        <span className={styles.session}>
          {isRace
            ? t('live.driver.lapOf', { lap: lap?.CurrentLapNum || '–', total: session?.TotalLaps || '–' })
            : t('live.driver.timeLeft', {
                time: formatDuration((session?.SessionTimeLeft ?? 0) * TIME_CONSTANTS.MS_PER_SECOND),
              })}
        </span>
        <span
          className={styles.wake}
          data-mode={wakeLock.mode}
          title={t(`live.driver.wakeLock.${wakeLock.mode}`)}
          aria-label={t(`live.driver.wakeLock.${wakeLock.mode}`)}
          role="img"
        >
          <MonitorSmartphone size={16} aria-hidden="true" />
        </span>
        <LiveViewModeSwitch value={viewMode} onChange={onViewModeChange} compact />
      </div>

      {flag && (
        <p className={styles.flag} role="status" data-testid="driver-flag">
          {t(`live.driver.flags.${flag}`)}
        </p>
      )}

      {wakeLock.mode === 'blocked' && (
        <div className={styles.wakeTip} role="note">
          <span>{t('live.driver.wakeLock.tip')}</span>
          <Button size="sm" variant="secondary" onClick={wakeLock.retry}>
            {t('live.driver.wakeLock.retry')}
          </Button>
        </div>
      )}

      <dl className={styles.grid}>
        <div className={styles.position}>
          <dt className={styles.label}>{t('live.driver.position')}</dt>
          <dd className={styles.positionValue} data-testid="driver-position">
            P{lap?.CarPosition || '–'}
            {carCount > 0 && <span className={styles.positionOf}>/{carCount}</span>}
          </dd>
        </div>

        {isRace ? (
          <>
            <GapRow side="ahead" gap={gaps.ahead} name={gaps.ahead && carName(gaps.ahead.carIndex)} />
            <GapRow side="behind" gap={gaps.behind} name={gaps.behind && carName(gaps.behind.carIndex)} />
          </>
        ) : (
          <div className={styles.gapRow} data-side="leader">
            <dt className={styles.label}>{t('live.driver.gapToP1')}</dt>
            <dd className={styles.gapValue}>
              {bestMs > 0 && leaderBestMs > 0 && leaderIdx !== playerIdx
                ? formatSignedDelta(bestMs - leaderBestMs)
                : '–'}
            </dd>
          </div>
        )}

        <div className={styles.lastLap}>
          <dt className={styles.label}>{t('live.driver.lastLap')}</dt>
          <dd className={styles.lapValue}>{formatLapTime(lastMs)}</dd>
          {lastMs > 0 && bestMs > 0 && (
            <dd className={styles.lapDelta} data-best={lastMs === bestMs || undefined}>
              {lastMs === bestMs ? t('live.driver.personalBest') : formatSignedDelta(lastMs - bestMs)}
            </dd>
          )}
        </div>
        <div className={styles.bestLap}>
          <dt className={styles.label}>{t('live.driver.bestLap')}</dt>
          <dd className={styles.lapValue}>{formatLapTime(bestMs)}</dd>
        </div>

        <div className={styles.tyres}>
          <dt className={styles.label}>
            {t('live.driver.tyres')}
            {status && (
              <span className={styles.compound}>
                <TyreCompoundBadge compound={status.VisualTyreCompound} size="sm" />
                {t('live.driver.tyreAge', { laps: status.TyresAgeLaps })}
              </span>
            )}
          </dt>
          <dd className={styles.corners}>
            {WHEELS_FRONT_FIRST.map(({ key, index }) => {
              const wear = Math.round(damage?.TyresWear[index] ?? 0);
              return (
                <span key={key} className={styles.corner} data-level={tyreWearLevel(wear)}>
                  <span className={styles.cornerName}>{t(`live.driver.corners.${key}`)}</span>
                  <span className={styles.cornerWear}>{damage ? `${wear}%` : '–'}</span>
                  <span className={styles.cornerTemp}>
                    {telemetry?.TyresSurfaceTemperature[index] ? units.degrees(telemetry.TyresSurfaceTemperature[index]) : ''}
                  </span>
                </span>
              );
            })}
          </dd>
        </div>

        <div className={styles.fuel}>
          <dt className={styles.label}>{t('live.driver.fuel')}</dt>
          <dd className={styles.bigValue} data-level={status && status.FuelRemainingLaps < 0 ? 'critical' : undefined}>
            {status ? (
              <>
                {signed(status.FuelRemainingLaps)}
                <span className={styles.unit}>{t('live.driver.lapsUnit')}</span>
              </>
            ) : (
              '–'
            )}
          </dd>
          {status && <dd className={styles.detail}>{t('live.driver.fuelKg', { kg: status.FuelInTank.toFixed(1) })}</dd>}
        </div>

        <div className={styles.ers}>
          <dt className={styles.label}>{t('live.driver.ers')}</dt>
          <dd className={styles.bigValue}>{ers === null ? '–' : `${ers}%`}</dd>
          {ers !== null && (
            <dd className={styles.ersBar} style={styleVars({ '--ers-pct': `${ers}%` })} aria-hidden="true" />
          )}
          {status && <dd className={styles.detail}>{getErsModeName(status.ERSDeployMode, session?.PacketFormat)}</dd>}
        </div>

        <div className={styles.warnings}>
          <dt className={styles.label}>{t('live.driver.warningsTitle')}</dt>
          {warnings.length === 0 ? (
            <dd className={styles.noWarnings}>{t('live.driver.noWarnings')}</dd>
          ) : (
            warnings.map((w) => (
              <dd key={w.key} className={styles.warning} data-severity={w.severity}>
                {t(`live.driver.warnings.${w.key}`, { count: w.count ?? 0 })}
              </dd>
            ))
          )}
        </div>
      </dl>
    </div>
  );
};

const signed = (value: number): string => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}`;

interface GapRowProps {
  side: 'ahead' | 'behind';
  gap: GapReading | null;
  name: string | null;
}

/** The gap to the car ahead or behind, its driver code and how it's trending. */
const GapRow: React.FC<GapRowProps> = ({ side, gap, name }) => {
  const { t } = useI18n();
  const trend = gap?.trend;
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;
  return (
    <div className={styles.gapRow} data-side={side}>
      <dt className={styles.label}>
        {t(`live.driver.gap.${side}`)}
        {name && <span className={styles.gapName}>{name}</span>}
      </dt>
      <dd className={styles.gapValue} data-testid={`driver-gap-${side}`}>
        {gap ? `${side === 'ahead' ? '−' : '+'}${formatGlanceGap(gap.ms)}` : t(`live.driver.gap.none.${side}`)}
      </dd>
      {trend && TrendIcon && (
        <dd className={styles.gapTrend} data-good={trend.good} data-direction={trend.direction}>
          <TrendIcon size={16} aria-hidden="true" />
          {trend.direction === 'stable'
            ? t('live.driver.trend.stable')
            : t(`live.driver.trend.${trend.direction}`, {
                value: (trend.perLapMs / TIME_CONSTANTS.MS_PER_SECOND).toFixed(2),
              })}
        </dd>
      )}
    </div>
  );
};
