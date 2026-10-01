import React, { useState, useMemo } from 'react';
import { Zap, Gauge, Award, Layers } from 'lucide-react';
import { getTeamColor, DEFAULT_MAX_SPEED_FALLBACK_KPH } from '../../constants/f1';
import { UI } from '../../constants/ui';

import { formatSectorTime } from '../../utils/formatters';
import { styleVars } from '../../styles/theme';
import { SectorTime } from '../common/SectorTime';
import { cx } from '../ui/cx';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { Panel, PanelHeader } from '../ui/Panel';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Stat } from '../ui/Stat';
import type { DriverStanding, ClassificationResponse } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import styles from './SessionSectorMatrixTab.module.css';
import { useUnits } from '../../hooks/useUnits';

interface SessionSectorMatrixTabProps {
  classificationData?: ClassificationResponse | null;
  driverStandings: DriverStanding[];
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  formatLapTime: (ms: number) => string;
}

type SectorView = 'ALL' | 'S1' | 'S2' | 'S3';
type Sector = 1 | 2 | 3;

const SECTORS: readonly Sector[] = [1, 2, 3];

const bestSectorMS = (driver: DriverStanding, sector: Sector): number =>
  sector === 1 ? driver.bestS1MS : sector === 2 ? driver.bestS2MS : driver.bestS3MS;

export const SessionSectorMatrixTab: React.FC<SessionSectorMatrixTabProps> = ({
  classificationData,
  driverStandings,
  sessionBestS1,
  sessionBestS2,
  sessionBestS3,
  formatLapTime,
}) => {
  const { t } = useI18n();
  const [sectorView, setSectorView] = useState<SectorView>('ALL');

  const formatSector = (ms: number) => formatSectorTime(ms, false);
  const sessionBest = (sector: Sector) => (sector === 1 ? sessionBestS1 : sector === 2 ? sessionBestS2 : sessionBestS3);

  // Which driver holds each purple sector
  const sectorHolders = useMemo(
    () =>
      SECTORS.map((sector) => {
        const best = sector === 1 ? sessionBestS1 : sector === 2 ? sessionBestS2 : sessionBestS3;
        return driverStandings.find((d) => bestSectorMS(d, sector) > 0 && bestSectorMS(d, sector) === best) ?? null;
      }),
    [driverStandings, sessionBestS1, sessionBestS2, sessionBestS3]
  );

  // Absolute theoretical best lap of the entire session
  const ultimateSessionLapMS = classificationData?.ultimate_theoretical_ms ?? 0;

  // Actual best lap of the session
  const actualSessionBestLap = useMemo<{ bestMS: number; driver: DriverStanding | null }>(() => {
    if (classificationData && classificationData.actual_best_lap_ms > 0) {
      const holder =
        driverStandings.find(
          (d) =>
            d.driverName === classificationData.actual_best_lap_driver ||
            d.participant.name === classificationData.actual_best_lap_driver
        ) || null;
      return { bestMS: classificationData.actual_best_lap_ms, driver: holder };
    }
    return { bestMS: 0, driver: null };
  }, [classificationData, driverStandings]);

  const ultimateDeltaMS =
    actualSessionBestLap.bestMS > 0 && ultimateSessionLapMS > 0
      ? actualSessionBestLap.bestMS - ultimateSessionLapMS
      : 0;

  // Maximum top speed across all drivers from server speed rankings
  const speedRankings = useMemo(() => {
    if (!classificationData?.speed_rankings) return [];
    return classificationData.speed_rankings.map((sr) => {
      const d = driverStandings.find((ds) => ds.participant.car_index === sr.car_index);
      return {
        ...d,
        participant: d?.participant || {
          id: sr.car_index,
          session_id: 0,
          car_index: sr.car_index,
          name: sr.driver_name,
          driver_id: 0,
          team_id: sr.team_id,
          race_number: 0,
          ai_controlled: false,
        },
        maxSpeed: sr.max_speed,
      };
    });
  }, [classificationData, driverStandings]);

  const maxOverallSpeed = speedRankings.length > 0 ? speedRankings[0].maxSpeed : DEFAULT_MAX_SPEED_FALLBACK_KPH;
  const minOverallSpeed = speedRankings.length > 0 ? Math.min(...speedRankings.map((d) => d.maxSpeed)) : 0;
  // Top speeds sit within a few km/h of each other, so bars span slowest-to-fastest instead of 0-to-fastest
  const speedSpread = maxOverallSpeed - minOverallSpeed;
  const units = useUnits();

  const recordLabels = [t('history.sectors.s1Record'), t('history.sectors.s2Record'), t('history.sectors.s3Record')];
  const bestHeaders = [t('history.sectors.bestS1'), t('history.sectors.bestS2'), t('history.sectors.bestS3')];

  const sectorColumn = (sector: Sector): DataTableColumn<DriverStanding> => ({
    key: `s${sector}`,
    header: bestHeaders[sector - 1],
    numeric: true,
    align: 'left',
    cell: (driver) => {
      const time = bestSectorMS(driver, sector);
      const best = sessionBest(sector);
      const delta = time > 0 && best > 0 ? (time - best) / 1000 : 0;
      return (
        <div className={styles.sectorCell}>
          <SectorTime isSessionBest={delta === 0 && time > 0} className={styles.sectorTime}>
            {formatSector(time)}
          </SectorTime>
          {delta > 0 && <span className={styles.gap}>+{delta.toFixed(3)}</span>}
        </div>
      );
    },
  });

  const columns: DataTableColumn<DriverStanding>[] = [
    {
      key: 'pos',
      header: t('history.classification.headers.pos'),
      numeric: true,
      align: 'left',
      width: '40px',
      className: styles.pos,
      cell: (_driver, index) => `P${index + 1}`,
    },
    {
      key: 'driver',
      header: t('history.classification.headers.driver'),
      rowHeader: true,
      cell: (driver) => (
        <div className={styles.driver} style={styleVars({ '--team-color': getTeamColor(driver.participant.team_id) })}>
          <span className={styles.teamBar} aria-hidden="true" />
          {driver.participant.name}
        </div>
      ),
    },
    ...SECTORS.filter((sector) => sectorView === 'ALL' || sectorView === `S${sector}`).map(sectorColumn),
  ];

  return (
    <div className={styles.tab}>
      {/* 1. ULTIMATE THEORETICAL LAP HERO CARD */}
      <Panel as="div" className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <h3 className={styles.heroEyebrow}>
              <Zap size={18} aria-hidden="true" />
              {t('history.sectors.ultimateTheoretical')}
            </h3>
            <div className={styles.heroTime}>
              {ultimateSessionLapMS > 0 ? formatLapTime(ultimateSessionLapMS) : '--:--.---'}
            </div>
            <p className={styles.heroSub}>{t('history.sectors.ultimateTheoreticalSub')}</p>
          </div>

          <div className={styles.heroStats}>
            <Stat
              className={styles.heroStat}
              icon={<Award size={18} className={styles.fastest} />}
              label={t('history.sectors.actualFastest')}
              value={actualSessionBestLap.bestMS > 0 ? formatLapTime(actualSessionBestLap.bestMS) : '--:--.---'}
              valueClassName={cx(styles.heroStatValue, styles.fastest)}
              detail={actualSessionBestLap.driver?.participant.name || '--'}
            />
            <Stat
              className={styles.heroStat}
              icon={<Layers size={18} className={styles.gain} />}
              label={t('history.sectors.potentialGain')}
              value={ultimateDeltaMS > 0 ? `-${(ultimateDeltaMS / 1000).toFixed(3)}s` : '0.000s'}
              valueClassName={cx(styles.heroStatValue, styles.gain)}
              detail={t('history.sectors.marginVsBest')}
            />
          </div>
        </div>

        {/* Sector record cards */}
        <ul className={styles.records}>
          {SECTORS.map((sector, i) => {
            const holder = sectorHolders[i];
            return (
              <li key={sector} className={styles.record}>
                <div className={styles.recordTop}>
                  <span className={styles.recordLabel}>{recordLabels[i]}</span>
                  <SectorTime isSessionBest className={styles.recordTime}>
                    {formatSector(sessionBest(sector))}
                  </SectorTime>
                </div>
                <div
                  className={styles.recordHolder}
                  style={styleVars({ '--team-color': getTeamColor(holder?.participant.team_id) })}
                >
                  <span className={styles.teamDot} aria-hidden="true" />
                  <span>{holder?.participant.name || '--'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* 2. SECTOR LEADERBOARD & SPEED TRAP GRID */}
      <div className={styles.grid}>
        <Panel>
          <PanelHeader
            level={4}
            icon={<Zap size={18} color="var(--accent-purple)" />}
            title={t('history.sectors.sectorLeaderboards')}
            actions={
              <SegmentedControl
                size="xs"
                aria-label={t('history.sectors.sectorViewLabel')}
                value={sectorView}
                onChange={setSectorView}
                options={[
                  { value: 'ALL', label: t('history.sectors.allSectors') },
                  { value: 'S1', label: 'S1' },
                  { value: 'S2', label: 'S2' },
                  { value: 'S3', label: 'S3' },
                ]}
              />
            }
          />
          <DataTable
            caption={t('history.sectors.sectorTableCaption')}
            columns={columns}
            rows={driverStandings}
            getRowKey={(driver) => driver.participant.car_index}
            density="compact"
            stickyHeader
            className={styles.scroll}
          />
        </Panel>

        {/* Speed Trap & Top Speed Leaderboard */}
        <Panel>
          <PanelHeader
            level={4}
            icon={<Gauge size={18} color="var(--accent-secondary)" />}
            title={t('history.sectors.speedTrapMaxSpeeds')}
            actions={
              <span className={styles.topSpeed}>
                {t('history.sectors.highestSpeed', {
                  speed: units.speed(maxOverallSpeed || null, 1),
                })}
              </span>
            }
          />

          <ol className={styles.speedList}>
            {speedRankings.map((driver, rankIdx) => {
              const speed = driver.maxSpeed;
              const speedRatio =
                speedSpread > 0
                  ? UI.RANKING_BAR_MIN_PCT + ((speed - minOverallSpeed) / speedSpread) * (100 - UI.RANKING_BAR_MIN_PCT)
                  : 100;
              const deltaToTop = maxOverallSpeed > 0 ? maxOverallSpeed - speed : 0;

              return (
                <li
                  key={driver.participant.car_index}
                  className={cx(styles.speedRow, rankIdx === 0 && styles.leader)}
                  style={styleVars({ '--team-color': getTeamColor(driver.participant.team_id) })}
                >
                  <div className={styles.speedTop}>
                    <div className={styles.speedDriver}>
                      <span className={styles.speedRank}>P{rankIdx + 1}</span>
                      <span className={styles.teamBar} aria-hidden="true" />
                      <span>{driver.participant.name}</span>
                    </div>

                    <div className={styles.speedFigures}>
                      {deltaToTop > 0 && (
                        <span className={styles.speedGap}>
                          -{units.speed(deltaToTop, 1)}
                        </span>
                      )}
                      <span className={styles.speed}>
                        {units.speed(speed, 1)}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal speed bar */}
                  <div className={styles.speedTrack} aria-hidden="true">
                    <div className={styles.speedFill} data-speed-bar style={{ width: `${speedRatio}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    </div>
  );
};
