import React from 'react';
import { Zap, Fuel, Gauge, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { DRIVER_STATUS, ACTIVE_AERO_MODES, MAX_ERS_STORE_ENERGY_J, WHEELS_FRONT_FIRST } from '../../constants/f1';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { TrackFlag } from '../TrackFlag';
import { Badge } from '../ui/Badge';
import { styleVars } from '../../styles/theme';
import styles from './VitalTelemetryStrip.module.css';
import type {
  SessionData,
  LapData,
  CarStatusData,
  CarDamageData,
  CarTelemetryData,
  CarTelemetry2Data,
} from '../../types/telemetry';
import { useUnits } from '../../hooks/useUnits';

export interface VitalTelemetryStripProps {
  session: SessionData | null;
  lap: LapData | null;
  carStatus: CarStatusData | null;
  carDamage: CarDamageData | null;
  telemetry: CarTelemetryData | null;
  telemetry2: CarTelemetry2Data | null;
  trackName: string;
  is2026: boolean;
}

interface VitalCardProps {
  title: string;
  /** A status chip on the right of the title. */
  badge?: React.ReactNode;
  children: React.ReactNode;
}

/** One card of the strip: a title, an optional status chip and its figures. */
const VitalCard: React.FC<VitalCardProps> = ({ title, badge, children }) => {
  const titleId = React.useId();
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.cardHeader}>
        <h3 id={titleId} className={styles.cardTitle}>
          {title}
        </h3>
        {badge}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
};

const getTyreWearLevel = (wear: number) => (wear >= 75 ? 'critical' : wear >= 40 ? 'warning' : 'nominal');

export const VitalTelemetryStrip: React.FC<VitalTelemetryStripProps> = ({
  session,
  lap,
  carStatus,
  carDamage,
  telemetry,
  telemetry2,
  trackName,
  is2026,
}) => {
  const { t } = useI18n();
  const units = useUnits();

  // Driver run status text
  const getRunStatusLabel = () => {
    switch (lap?.DriverStatus) {
      case DRIVER_STATUS.FLYING_LAP:
        return t('live.statusHotlap');
      case DRIVER_STATUS.OUT_LAP:
        return t('live.statusOutlap');
      case DRIVER_STATUS.IN_LAP:
        return t('live.statusPit');
      case DRIVER_STATUS.IN_GARAGE:
        return t('live.statusGarage');
      default:
        return t('live.cockpit.onTrack');
    }
  };

  // Tyre wear percentages & temperatures
  const tyresWear = carDamage?.TyresWear || [0, 0, 0, 0];
  const roundedWears = tyresWear.map((w: number) => Math.round(w || 0));
  const peakWear = Math.max(...roundedWears);
  const surfTemps = telemetry?.TyresSurfaceTemperature || [0, 0, 0, 0];

  // ERS Energy (Zero magic numbers: using MAX_ERS_STORE_ENERGY_J)
  const storeEnergy = carStatus?.ERSStoreEnergy;
  const ersPct =
    storeEnergy !== undefined
      ? Math.min(100, Math.max(0, Math.round((storeEnergy / MAX_ERS_STORE_ENERGY_J) * 100)))
      : null;

  // Fuel remaining delta laps
  const fuelDelta = carStatus && typeof carStatus.FuelRemainingLaps === 'number' ? carStatus.FuelRemainingLaps : null;

  // Aero damage
  const flWing = Math.round(carDamage?.FrontLeftWingDamage || 0);
  const frWing = Math.round(carDamage?.FrontRightWingDamage || 0);
  const floorDamage = Math.round((carDamage?.FloorDamage || 0) + (carDamage?.DiffuserDamage || 0));
  const hasAeroDamage = flWing > 0 || frWing > 0 || floorDamage > 0;

  // Active Aero / Boost (2026)
  const activeAeroMode = telemetry2?.ActiveAeroMode;
  const boostActive = telemetry2 && typeof telemetry2.OvertakeActive === 'number' && telemetry2.OvertakeActive > 0;

  const corners = WHEELS_FRONT_FIRST.map(({ label, index }) => ({
    label,
    wear: roundedWears[index],
    temp: Math.round(surfTemps[index] || 0),
  }));

  return (
    <div className={styles.grid} data-testid="voice-cockpit-vitals-grid">
      {/* Position and lap */}
      <VitalCard
        title={`${t('live.cockpit.position')} & ${t('live.cockpit.lap')}`}
        badge={
          <Badge size="xs" square uppercase>
            {getRunStatusLabel()}
          </Badge>
        }
      >
        <div className={styles.positionRow}>
          <div className={styles.position}>
            <span className={styles.positionP}>P</span>
            <span className={styles.positionValue}>{lap?.CarPosition || '—'}</span>
          </div>
          <div className={styles.lapMeta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>{t('live.cockpit.lap')}:</span>
              <span className={styles.metaValue}>
                {lap?.CurrentLapNum || 1} / {session?.TotalLaps || '—'}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>{trackName}</span>
              <TrackFlag track={session?.TrackId ?? trackName} width={18} height={12} />
            </div>
            {lap && (lap.Penalties || lap.CornerCuttingWarnings) ? (
              <div className={styles.warnings}>
                <AlertTriangle size={12} aria-hidden="true" />
                <span>
                  {t('live.cockpit.warningsCount', { count: lap.CornerCuttingWarnings ?? 0 })}
                  {lap.Penalties ? ` • +${lap.Penalties}s` : ''}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </VitalCard>

      {/* Tyre wear and surface temperature per corner */}
      <VitalCard
        title={t('live.cockpit.tyreWear')}
        badge={
          <span className={styles.tyreSummary}>
            {/* No compound yet: a grey "?" rather than a guess */}
            {carStatus?.VisualTyreCompound ? (
              <TyreCompoundBadge compound={carStatus.VisualTyreCompound} />
            ) : (
              <TyreCompoundBadge compound="?" title={t('live.badges.unknownCompoundTitle')} />
            )}
            <span className={styles.tyreAge}>{carStatus?.TyresAgeLaps || 0} L</span>
          </span>
        }
      >
        <ul className={styles.corners}>
          {corners.map((corner) => (
            <li key={corner.label} className={styles.corner} data-wear={getTyreWearLevel(corner.wear)}>
              <span className={styles.cornerLabel}>{corner.label}</span>
              <span className={styles.cornerWear}>{corner.wear}%</span>
              <span className={styles.cornerTemp}>{units.temperature(corner.temp)}</span>
            </li>
          ))}
        </ul>
        <div className={styles.peakWear}>{t('live.cockpit.peakWear', { percent: peakWear })}</div>
      </VitalCard>

      {/* Powertrain: ERS store, fuel margin and engine temperature */}
      <VitalCard
        title={t('live.cockpit.powertrain')}
        badge={
          is2026 &&
          activeAeroMode !== undefined && (
            <Badge tone={activeAeroMode === ACTIVE_AERO_MODES.STRAIGHT ? 'info' : 'neutral'} size="xs" square>
              {activeAeroMode === ACTIVE_AERO_MODES.STRAIGHT
                ? t('live.activeAeroStraight')
                : t('live.activeAeroCorner')}
            </Badge>
          )
        }
      >
        <dl className={styles.metrics}>
          <div className={styles.metric}>
            <dt className={styles.metricLabel} data-icon="ers">
              <Zap size={14} aria-hidden="true" />
              {t('live.cockpit.ersBattery')}
            </dt>
            <dd className={styles.metricValue}>
              <span className={styles.bar} style={styleVars({ '--fill': `${ersPct ?? 0}%` })} aria-hidden="true">
                <span className={styles.barFill} />
              </span>
              <span className={styles.number}>{ersPct !== null ? `${ersPct}%` : '—'}</span>
            </dd>
          </div>

          <div className={styles.metric}>
            <dt className={styles.metricLabel} data-icon="fuel">
              <Fuel size={14} aria-hidden="true" />
              {t('live.cockpit.fuelDelta')}
            </dt>
            <dd className={styles.metricValue}>
              <span
                className={styles.number}
                data-tone={fuelDelta === null ? undefined : fuelDelta >= 0 ? 'good' : 'bad'}
              >
                {fuelDelta !== null
                  ? t('live.cockpit.fuelLaps', { value: `${fuelDelta >= 0 ? '+' : ''}${fuelDelta.toFixed(1)}` })
                  : '—'}
              </span>
            </dd>
          </div>

          <div className={styles.metric}>
            <dt className={styles.metricLabel}>
              <Gauge size={14} aria-hidden="true" />
              {t('live.cockpit.engineTemp')}
            </dt>
            <dd className={styles.metricValue}>
              <span className={styles.number}>{units.temperature(telemetry?.EngineTemperature || null, 0, '—')}</span>
              {boostActive && (
                <Badge color="var(--f1-yellow)" size="xs" square title={t('live.badges.boostTitle')}>
                  {t('live.boostActive')}
                </Badge>
              )}
            </dd>
          </div>
        </dl>
      </VitalCard>

      {/* Aero damage */}
      <VitalCard
        title={t('live.cockpit.aeroDamage')}
        badge={
          hasAeroDamage ? (
            <Badge tone="danger" size="xs" square icon={<AlertTriangle size={12} aria-hidden="true" />}>
              {t('live.cockpit.damage')}
            </Badge>
          ) : (
            <Badge tone="success" size="xs" square icon={<CheckCircle2 size={12} aria-hidden="true" />}>
              {t('live.cockpit.nominal')}
            </Badge>
          )
        }
      >
        {hasAeroDamage ? (
          <dl className={styles.damageGrid}>
            <div className={styles.damageItem}>
              <dt className={styles.damageLabel}>{t('live.cockpit.frontWing')} (L/R)</dt>
              <dd className={styles.damageValue}>
                {flWing}% / {frWing}%
              </dd>
            </div>
            <div className={styles.damageItem}>
              <dt className={styles.damageLabel}>{t('live.cockpit.floorDiffuser')}</dt>
              <dd className={styles.damageValue}>{floorDamage}%</dd>
            </div>
          </dl>
        ) : (
          <div className={styles.nominal}>
            <CheckCircle2 size={24} aria-hidden="true" />
            <span>{t('live.cockpit.aeroNominal')}</span>
          </div>
        )}
      </VitalCard>
    </div>
  );
};
