import React, { useId, useState, useMemo } from 'react';
import {
  Zap,
  Trophy,
  Users,
  Timer,
  ChevronsUp,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  Clock,
  Filter,
} from 'lucide-react';
import type { Participant, Lap } from '../../types/session';
import type { QuickSelectDriver } from '../../types/comparator';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { Badge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { TextInput } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { SegmentedControl } from '../ui/SegmentedControl';
import { getTeamColor } from '../../constants/f1';
import { formatTime, formatSectorTime } from '../../utils/formatters';
import { sortLapsByQuality } from '../../utils/lapUtils';
import { styleVars } from '../../styles/theme';
import { useI18n } from '../../context/I18nContext';
import styles from './ComparatorTimingTower.module.css';

const SLOT_A_COLOR = 'var(--f1-slot-a)';
const SLOT_B_COLOR = 'var(--f1-slot-b)';

export interface ComparatorTimingTowerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  quickSelectData: {
    drivers: QuickSelectDriver[];
    totalCount: number;
    leaderLapTimeMs: number | null;
  };
  driverSearchQuery: string;
  onDriverSearchChange: (q: string) => void;
  isLinkedSessions: boolean;
  sessionAId: number | '';
  sessionBId: number | '';
  quickSelectSessionTab: 'ALL' | 'A' | 'B';
  onQuickSelectSessionTabChange: (tab: 'ALL' | 'A' | 'B') => void;
  lapAId: number | '';
  lapBId: number | '';
  lapsA: Lap[];
  lapsB: Lap[];
  onSetLapA: (id: number) => void;
  onSetLapB: (id: number) => void;
  participantsA: Participant[];
  slotADriver?: Participant;
  slotBDriver?: Participant;
  lapAObj?: Lap;
  lapBObj?: Lap;
}

const seconds = (ms: number) => (ms / 1000).toFixed(3);

export const ComparatorTimingTower: React.FC<ComparatorTimingTowerProps> = ({
  isOpen,
  onToggleOpen,
  quickSelectData,
  driverSearchQuery,
  onDriverSearchChange,
  isLinkedSessions,
  sessionAId,
  sessionBId,
  quickSelectSessionTab,
  onQuickSelectSessionTabChange,
  lapAId,
  lapBId,
  lapsA,
  lapsB,
  onSetLapA,
  onSetLapB,
  participantsA,
  slotADriver,
  lapAObj,
}) => {
  const { t } = useI18n();
  const titleId = useId();

  // Local table filters & expanded lap drilldowns
  const [validOnly, setValidOnly] = useState(false);
  const [telemetryOnly, setTelemetryOnly] = useState(false);
  const [expandedDriverCarIndex, setExpandedDriverCarIndex] = useState<number | null>(null);

  // Quick Preset Handlers
  const handleVsLeader = () => {
    const leader = quickSelectData.drivers.find(
      (d) => d.bestLap && d.bestLap.lap_time_ms === quickSelectData.leaderLapTimeMs
    );
    if (leader?.bestLap) {
      onSetLapB(leader.bestLap.id);
    }
  };

  const handleVsTeammate = () => {
    if (!slotADriver) return;
    const teammate = quickSelectData.drivers.find(
      (d) => d.team_id === slotADriver.team_id && d.car_index !== slotADriver.car_index && d.bestLap
    );
    if (teammate?.bestLap) {
      onSetLapB(teammate.bestLap.id);
    }
  };

  const handlePersonalBest = () => {
    if (!slotADriver) return;
    const driverLaps = sortLapsByQuality(lapsA.filter((l) => (l.car_index ?? -1) === slotADriver.car_index));
    if (driverLaps.length > 0) {
      const best = driverLaps[0];
      if (lapAId !== best.id) {
        onSetLapA(best.id);
      } else if (lapBId !== best.id) {
        onSetLapB(best.id);
      }
    }
  };

  const handleNextAhead = () => {
    if (!slotADriver) return;
    const currentIdx = quickSelectData.drivers.findIndex((d) => d.car_index === slotADriver.car_index);
    if (currentIdx > 0) {
      const ahead = quickSelectData.drivers[currentIdx - 1];
      if (ahead?.bestLap) {
        onSetLapB(ahead.bestLap.id);
      }
    }
  };

  // Filter drivers for table
  const displayedDrivers = useMemo(() => {
    return quickSelectData.drivers.filter((d) => {
      if (validOnly && (!d.bestLap || !d.bestLap.is_valid || d.bestLap.lap_time_ms <= 0)) {
        return false;
      }
      if (telemetryOnly && (!d.bestLap || !d.bestLap.has_telemetry)) {
        return false;
      }
      return true;
    });
  }, [quickSelectData.drivers, validOnly, telemetryOnly]);

  const setBestLap = (d: QuickSelectDriver, laps: Lap[], setLap: (id: number) => void) => {
    const driverLaps = sortLapsByQuality(laps.filter((l) => (l.car_index ?? -1) === d.car_index));
    if (driverLaps.length > 0) setLap(driverLaps[0].id);
  };

  const isAssigned = (lapId: number | '', d: QuickSelectDriver) =>
    Boolean(lapId && d.bestLap && lapId === d.bestLap.id);

  const baselineGap = (d: QuickSelectDriver): React.ReactNode => {
    if (slotADriver && slotADriver.car_index === d.car_index) {
      return (
        <Badge color={SLOT_A_COLOR} size="xs" square>
          {t('comparator.timingTower.baselineBadge')}
        </Badge>
      );
    }
    if (!lapAObj || !d.bestLap || d.bestLap.lap_time_ms <= 0) return '—';
    const deltaMs = d.bestLap.lap_time_ms - lapAObj.lap_time_ms;
    if (deltaMs < 0) {
      return (
        <span className={styles.gap} data-gap="faster">
          -{seconds(Math.abs(deltaMs))}s
        </span>
      );
    }
    if (deltaMs > 0) {
      return (
        <span className={styles.gap} data-gap="slower">
          +{seconds(deltaMs)}s
        </span>
      );
    }
    return <span className={styles.gap}>0.000s</span>;
  };

  const leaderGap = (d: QuickSelectDriver): React.ReactNode => {
    if (!d.bestLap || !quickSelectData.leaderLapTimeMs) return '—';
    if (d.bestLap.lap_time_ms === quickSelectData.leaderLapTimeMs) {
      return (
        <Badge color="var(--f1-gold)" size="xs" square>
          {t('comparator.timingTower.leaderBadge')}
        </Badge>
      );
    }
    return <span className={styles.muted}>+{seconds(d.bestLap.lap_time_ms - quickSelectData.leaderLapTimeMs)}s</span>;
  };

  const sectorCell = (ms: number | null | undefined) =>
    ms ? <span className={styles.muted}>{formatSectorTime(ms)}</span> : '—';

  const columns: DataTableColumn<QuickSelectDriver>[] = [
    {
      key: 'pos',
      header: t('comparator.timingTower.colPos'),
      cell: (_d, idx) => (
        <span className={styles.rank} data-rank={idx + 1} data-testid={`rank-badge-${idx + 1}`}>
          P{idx + 1}
        </span>
      ),
    },
    {
      key: 'driver',
      header: t('comparator.timingTower.colDriver'),
      rowHeader: true,
      cell: (d) => (
        <div className={styles.driverCell}>
          <span
            className={styles.teamStripe}
            style={styleVars({ '--team-color': getTeamColor(d.team_id) })}
            aria-hidden="true"
          />
          <span className={styles.raceNum}>#{d.race_number}</span>
          <span className={styles.driverName} title={d.name}>
            {d.name}
          </span>
          {isAssigned(lapAId, d) && (
            <Badge color={SLOT_A_COLOR} size="xs" square>
              {t('comparator.timingTower.baselineBadge')}
            </Badge>
          )}
          {isAssigned(lapBId, d) && (
            <Badge color={SLOT_B_COLOR} size="xs" square>
              {t('comparator.timingTower.rivalBadge')}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'tyre',
      header: t('comparator.timingTower.colTyre'),
      cell: (d) => (d.bestLap?.tyre_compound ? <TyreCompoundBadge compound={d.bestLap.tyre_compound} /> : '—'),
    },
    {
      key: 'best',
      header: t('comparator.timingTower.colBestLap'),
      numeric: true,
      cell: (d) =>
        d.bestLap ? (
          <span
            className={styles.bestLap}
            data-fastest={d.bestLap.lap_time_ms === quickSelectData.leaderLapTimeMs || undefined}
          >
            {formatTime(d.bestLap.lap_time_ms)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'gapLeader',
      header: t('comparator.timingTower.colGapLeader'),
      numeric: true,
      cell: leaderGap,
    },
    {
      key: 'gapBase',
      header: t('comparator.timingTower.colGapBaseline'),
      numeric: true,
      cell: baselineGap,
    },
    {
      key: 's1',
      header: t('comparator.timingTower.colS1'),
      numeric: true,
      cell: (d) => sectorCell(d.bestLap?.sector1_ms),
    },
    {
      key: 's2',
      header: t('comparator.timingTower.colS2'),
      numeric: true,
      cell: (d) => sectorCell(d.bestLap?.sector2_ms),
    },
    {
      key: 's3',
      header: t('comparator.timingTower.colS3'),
      numeric: true,
      cell: (d) => sectorCell(d.bestLap?.sector3_ms),
    },
    {
      key: 'telemetry',
      header: <abbr title={t('comparator.charts.telemetryAvailable')}>{t('comparator.timingTower.colTelemetry')}</abbr>,
      cell: (d) => {
        if (!d.bestLap) return '—';
        const label = d.bestLap.has_telemetry
          ? t('comparator.charts.telemetryAvailable')
          : t('comparator.charts.timingOnly');
        return (
          <span className={styles.telemetry} data-telemetry={d.bestLap.has_telemetry || undefined} title={label}>
            {d.bestLap.has_telemetry ? (
              <Activity size={12} aria-label={label} />
            ) : (
              <Clock size={12} aria-label={label} />
            )}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: t('comparator.timingTower.colActions'),
      cell: (d) => {
        const isExpanded = expandedDriverCarIndex === d.car_index;
        const isDriverInA = participantsA.some((pa) => pa.car_index === d.car_index);
        const baselineLabel = `${t('comparator.duel.slotA')} (${t('comparator.timingTower.btnSetBaseline')}): ${d.name}`;
        const rivalLabel = `${t('comparator.duel.slotB')} (${t('comparator.timingTower.btnSetRival')}): ${d.name}`;
        return (
          <div className={styles.actions}>
            <div className={styles.slotCircles} role="group" aria-label={t('comparator.timingTower.slotGroupLabel')}>
              {(isLinkedSessions || isDriverInA || d.sessionSlot === 'A') && (
                <button
                  type="button"
                  className={styles.circle}
                  data-slot="a"
                  aria-pressed={isAssigned(lapAId, d)}
                  onClick={() => setBestLap(d, lapsA, onSetLapA)}
                  title={baselineLabel}
                  aria-label={baselineLabel}
                  data-testid={`tower-set-baseline-${d.car_index}`}
                >
                  <span className={styles.circleDot} />
                </button>
              )}
              <button
                type="button"
                className={styles.circle}
                data-slot="b"
                aria-pressed={isAssigned(lapBId, d)}
                onClick={() => setBestLap(d, lapsB, onSetLapB)}
                title={rivalLabel}
                aria-label={rivalLabel}
                data-testid={`tower-set-rival-${d.car_index}`}
              >
                <span className={styles.circleDot} />
              </button>
            </div>

            <IconButton
              size="sm"
              variant="ghost"
              label={isExpanded ? t('comparator.timingTower.hideLaps') : t('comparator.timingTower.showLaps')}
              aria-expanded={isExpanded}
              onClick={() => setExpandedDriverCarIndex(isExpanded ? null : d.car_index)}
              data-testid={`tower-expand-laps-${d.car_index}`}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </IconButton>
          </div>
        );
      },
    },
  ];

  const renderLapHistory = (d: QuickSelectDriver) => {
    if (expandedDriverCarIndex !== d.car_index) return null;
    const lapsSource = !isLinkedSessions && d.sessionSlot === 'B' ? lapsB : lapsA;
    const driverLaps = lapsSource.filter((l) => {
      if ((l.car_index ?? -1) !== d.car_index) return false;
      if (!l.lap_time_ms || l.lap_time_ms <= 0) return false;
      if (validOnly && !l.is_valid) return false;
      if (telemetryOnly && !l.has_telemetry) return false;
      return true;
    });

    return (
      <div className={styles.history}>
        <h3 className={styles.historyTitle}>{t('comparator.timingTower.lapHistoryTitle', { driver: d.name })}</h3>
        <ul className={styles.historyGrid}>
          {driverLaps.length === 0 ? (
            <li className={styles.historyEmpty}>{t('comparator.timingTower.noMatchingDrivers')}</li>
          ) : (
            driverLaps.map((lap) => {
              const isLapA = lapAId === lap.id;
              const isLapB = lapBId === lap.id;
              return (
                <li key={lap.id} className={styles.lapCard} data-slot={isLapA ? 'a' : isLapB ? 'b' : undefined}>
                  <div className={styles.lapCardTop}>
                    <span className={styles.muted}>{t('comparator.duel.lapNumber', { lap: lap.lap_number })}</span>
                    <span className={styles.lapTime}>{formatTime(lap.lap_time_ms)}</span>
                    {lap.tyre_compound && <TyreCompoundBadge compound={lap.tyre_compound} />}
                  </div>
                  <div className={styles.lapSectors}>
                    <span>S1: {formatSectorTime(lap.sector1_ms)}</span>
                    <span>S2: {formatSectorTime(lap.sector2_ms)}</span>
                    <span>S3: {formatSectorTime(lap.sector3_ms)}</span>
                  </div>
                  <div className={styles.lapActions}>
                    <button
                      type="button"
                      className={styles.slotButton}
                      data-slot="a"
                      aria-pressed={isLapA}
                      onClick={() => onSetLapA(lap.id)}
                    >
                      {isLapA
                        ? t('comparator.timingTower.btnSetBaselineActive')
                        : t('comparator.timingTower.btnSetBaseline')}
                    </button>
                    <button
                      type="button"
                      className={styles.slotButton}
                      data-slot="b"
                      aria-pressed={isLapB}
                      onClick={() => onSetLapB(lap.id)}
                    >
                      {isLapB ? t('comparator.timingTower.btnSetRivalActive') : t('comparator.timingTower.btnSetRival')}
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    );
  };

  const presets = [
    {
      key: 'vs-leader',
      show: true,
      onClick: handleVsLeader,
      icon: <Trophy size={14} aria-hidden="true" />,
      label: t('comparator.timingTower.presetVsLeader'),
      tooltip: t('comparator.timingTower.presetVsLeaderTooltip'),
    },
    {
      key: 'vs-teammate',
      show: Boolean(slotADriver),
      onClick: handleVsTeammate,
      icon: <Users size={14} aria-hidden="true" />,
      label: t('comparator.timingTower.presetVsTeammate'),
      tooltip: t('comparator.timingTower.presetVsTeammateTooltip'),
    },
    {
      key: 'personal-best',
      show: Boolean(slotADriver),
      onClick: handlePersonalBest,
      icon: <Timer size={14} aria-hidden="true" />,
      label: t('comparator.timingTower.presetPersonalBest'),
      tooltip: t('comparator.timingTower.presetPersonalBestTooltip'),
    },
    {
      key: 'next-ahead',
      show: Boolean(slotADriver),
      onClick: handleNextAhead,
      icon: <ChevronsUp size={14} aria-hidden="true" />,
      label: t('comparator.timingTower.presetNextAhead'),
      tooltip: t('comparator.timingTower.presetNextAheadTooltip'),
    },
  ];

  return (
    <Panel
      padding="compact"
      className={styles.panel}
      aria-labelledby={titleId}
      data-expanded={isOpen || undefined}
      data-testid="quick-select-panel"
    >
      <div className={styles.headerBar}>
        <div className={styles.headerSide}>
          {/* Clicking the title is a mouse shortcut for the expand button */}
          <div className={styles.titleGroup} role="presentation" onClick={onToggleOpen}>
            <Zap size={16} className={styles.titleIcon} aria-hidden="true" />
            <h2 id={titleId} className={styles.title}>
              {t('comparator.timingTower.title')}
            </h2>
            <span className={styles.count} data-testid="timing-tower-count">
              {quickSelectData.drivers.length}
              {driverSearchQuery ? ` / ${quickSelectData.totalCount}` : ''} {t('common.drivers').toLowerCase()}
            </span>
          </div>

          <div className={styles.presets}>
            {presets
              .filter((p) => p.show)
              .map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  onClick={p.onClick}
                  icon={p.icon}
                  title={p.tooltip}
                  data-testid={`preset-${p.key}`}
                >
                  {p.label}
                </Button>
              ))}
          </div>
        </div>

        <div className={styles.headerSide}>
          {/* Collapsed: the top three, one click to set as the comparison */}
          {!isOpen && quickSelectData.drivers.length > 0 && (
            <div className={styles.top3} role="presentation" onClick={onToggleOpen}>
              {quickSelectData.drivers.slice(0, 3).map((d, i) => (
                <button
                  key={d.car_index}
                  type="button"
                  className={styles.top3Pill}
                  data-rank={i + 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (d.bestLap) onSetLapB(d.bestLap.id);
                  }}
                  title={t('comparator.timingTower.setRivalTitle', { driver: d.name })}
                >
                  <span className={styles.top3Pos}>P{i + 1}</span>
                  <span>{d.name.split(' ').pop()}</span>
                  <span className={styles.top3Time}>{d.bestLap ? formatTime(d.bestLap.lap_time_ms) : ''}</span>
                </button>
              ))}
            </div>
          )}

          {isOpen && (
            <div className={styles.search}>
              <Search size={14} className={styles.searchIcon} aria-hidden="true" />
              <TextInput
                aria-label={t('comparator.timingTower.searchDriver')}
                placeholder={t('comparator.timingTower.searchDriver')}
                value={driverSearchQuery}
                onChange={(e) => onDriverSearchChange(e.target.value)}
                data-testid="driver-quick-search-input"
              />
              {driverSearchQuery && (
                <IconButton
                  size="sm"
                  variant="ghost"
                  className={styles.searchClear}
                  label={t('comparator.dropdown.clearSearch')}
                  onClick={() => onDriverSearchChange('')}
                >
                  <X size={12} />
                </IconButton>
              )}
            </div>
          )}

          {isOpen && (
            <>
              <Chip
                pressed={validOnly}
                onClick={() => setValidOnly((prev) => !prev)}
                icon={<Filter size={12} aria-hidden="true" />}
              >
                {t('comparator.timingTower.filterValidOnly')}
              </Chip>
              <Chip
                pressed={telemetryOnly}
                onClick={() => setTelemetryOnly((prev) => !prev)}
                icon={<Activity size={12} aria-hidden="true" />}
              >
                {t('comparator.timingTower.filterTelemetryOnly')}
              </Chip>
            </>
          )}

          {/* Cross-session: show one slot's session or both */}
          {isOpen && !isLinkedSessions && sessionAId !== sessionBId && (
            <SegmentedControl
              size="xs"
              aria-label={t('comparator.timingTower.sessionFilterLabel')}
              value={quickSelectSessionTab}
              onChange={onQuickSelectSessionTabChange}
              options={[
                { value: 'ALL', label: t('comparator.dropdown.tabAll') },
                { value: 'A', label: t('comparator.duel.slotA') },
                { value: 'B', label: t('comparator.duel.slotB') },
              ]}
            />
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleOpen}
            aria-expanded={isOpen}
            icon={isOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            data-testid="quick-select-collapse-btn"
          >
            {isOpen ? t('comparator.timingTower.collapse') : t('comparator.timingTower.expand')}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className={styles.body}>
          {displayedDrivers.length === 0 ? (
            <EmptyState compact title={t('comparator.timingTower.noMatchingDrivers')} />
          ) : (
            <div data-testid="quick-select-drivers-grid">
              <DataTable
                columns={columns}
                rows={displayedDrivers}
                getRowKey={(d) => `${d.session_id}-${d.car_index}`}
                caption={t('comparator.timingTower.tableCaption')}
                getRowClassName={(d) =>
                  isAssigned(lapAId, d) ? styles.assignedA : isAssigned(lapBId, d) ? styles.assignedB : undefined
                }
                renderExpanded={renderLapHistory}
                stickyHeader
                density="compact"
                className={styles.tableWrap}
                tableClassName={styles.table}
              />
            </div>
          )}
        </div>
      )}
    </Panel>
  );
};
