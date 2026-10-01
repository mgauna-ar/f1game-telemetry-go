import React from 'react';
import { ArrowDown, ArrowUp, Minus, Swords } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionStatusStore } from '../../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../../store/useTelemetryDataStore';
import { parseDriverName } from '../../store/useTelemetryStore';
import { F1_FORMATS, TIME_CONSTANTS, getTeamColor, isRaceSession } from '../../constants/f1';
import { formatGlanceGap, playerGaps, type GapReading } from '../../utils/driverGlance';
import { carAtPosition } from '../../utils/liveTiming';
import { driverCode } from '../../utils/player';
import { formatLapTime } from '../../utils/formatters';
import { styleVars } from '../../styles/theme';
import type { LapData } from '../../types/telemetry';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Panel, PanelHeader } from '../ui/Panel';
import styles from './BattlePanel.module.css';

const TREND_ICONS = { closing: ArrowDown, opening: ArrowUp, stable: Minus } as const;

type Side = 'ahead' | 'behind';

interface BattlePanelProps {
  className?: string;
  /** Opens a car's detail; the rows are buttons when it's set. */
  onSelectCar?: (carIndex: number) => void;
}

/**
 * The player's fight: the cars directly ahead and behind, the gaps to them and how those gaps
 * trend (the race engineer's numbers), tyres and DRS or overtake mode. Outside a race the gaps are
 * between best laps.
 */
export const BattlePanel: React.FC<BattlePanelProps> = ({ className, onSelectCar }) => {
  const { t } = useI18n();
  const session = useSessionStatusStore((s) => s.session);
  const packetFormat = useSessionStatusStore((s) => s.packetFormat);
  const laps = useTelemetryDataStore((s) => s.allLaps);
  const playerIdx = useTelemetryDataStore((s) => s.playerCarIndex);
  const bestLapTimes = useTelemetryDataStore((s) => s.bestLapTimes);
  const aheadTrend = useTelemetryDataStore((s) => s.gapAheadTrend);
  const behindTrend = useTelemetryDataStore((s) => s.gapBehindTrend);

  const isRace = isRaceSession(session?.SessionType);
  const position = laps[playerIdx]?.CarPosition ?? 0;
  const gaps = isRace ? playerGaps(laps, playerIdx, aheadTrend, behindTrend) : bestLapGaps(laps, playerIdx, bestLapTimes);
  const aheadIdx = gaps.ahead?.carIndex ?? carAtPosition(laps, position - 1);
  const behindIdx = gaps.behind?.carIndex ?? carAtPosition(laps, position + 1);
  const is2026 = (packetFormat || session?.PacketFormat) === F1_FORMATS.FORMAT_2026;

  const row = (carIndex: number, kind: Side | 'you') =>
    carIndex >= 0 ? (
      <CarRow carIndex={carIndex} kind={kind} is2026={is2026} onSelectCar={onSelectCar} />
    ) : (
      <li className={styles.empty}>{t(`live.driver.gap.none.${kind === 'ahead' ? 'ahead' : 'behind'}`)}</li>
    );

  return (
    <Panel className={className} padding="compact" data-testid="battle-panel">
      <PanelHeader
        icon={<Swords size={16} />}
        title={t('live.raceControlView.battle')}
        subtitle={isRace ? t('live.raceControlView.battleSubRace') : t('live.raceControlView.battleSubBestLap')}
      />
      {position <= 0 ? (
        <EmptyState compact title={t('live.raceControlView.noPosition')} />
      ) : (
        <ol className={styles.battle}>
          {row(aheadIdx, 'ahead')}
          {aheadIdx >= 0 && <GapLine side="ahead" gap={gaps.ahead} />}
          {row(playerIdx, 'you')}
          {behindIdx >= 0 && <GapLine side="behind" gap={gaps.behind} />}
          {row(behindIdx, 'behind')}
        </ol>
      )}
    </Panel>
  );
};

/** Outside a race the order is by best lap, so the gaps are best-lap differences. */
function bestLapGaps(
  laps: readonly (LapData | undefined)[],
  playerIdx: number,
  bestLapTimes: readonly number[]
): { ahead: GapReading | null; behind: GapReading | null } {
  const position = laps[playerIdx]?.CarPosition ?? 0;
  const mine = bestLapTimes[playerIdx] ?? 0;
  const gapTo = (carIndex: number, sign: 1 | -1): GapReading | null => {
    const theirs = bestLapTimes[carIndex] ?? 0;
    const ms = sign * (mine - theirs);
    return carIndex >= 0 && mine > 0 && theirs > 0 && ms >= 0 ? { carIndex, ms, trend: null } : null;
  };
  return {
    ahead: gapTo(carAtPosition(laps, position - 1), 1),
    behind: gapTo(carAtPosition(laps, position + 1), -1),
  };
}

interface CarRowProps {
  carIndex: number;
  kind: Side | 'you';
  is2026: boolean;
  onSelectCar?: (carIndex: number) => void;
}

/** One car in the fight: position, team, driver, tyres, last lap and DRS or overtake mode. */
const CarRow: React.FC<CarRowProps> = ({ carIndex, kind, is2026, onSelectCar }) => {
  const { t } = useI18n();
  const participant = useSessionStatusStore((s) => s.participants[carIndex]);
  const lap = useTelemetryDataStore((s) => s.allLaps[carIndex]);
  const status = useTelemetryDataStore((s) => s.allCarStatus[carIndex]);
  const telemetry2 = useTelemetryDataStore((s) => s.allTelemetry2[carIndex]);

  const name = parseDriverName(participant?.Name, t('live.events.car', { number: carIndex + 1 }), participant?.DriverId);
  const content = (
    <>
      <span className={styles.pos}>P{lap?.CarPosition || '—'}</span>
      <span className={styles.teamBar} aria-hidden="true" />
      <span className={styles.name}>
        <span className={styles.code}>{driverCode(name, participant?.RaceNumber)}</span>
        <span className={styles.fullName}>{kind === 'you' ? t('live.youChip') : name}</span>
      </span>
      <span className={styles.tyre}>
        {status && <TyreCompoundBadge compound={status.VisualTyreCompound} />}
        {status && <span className={styles.tyreAge}>{t('live.driver.tyreAge', { laps: status.TyresAgeLaps })}</span>}
      </span>
      <span className={styles.lastLap}>{formatLapTime(lap?.LastLapTimeInMS ?? 0)}</span>
      <span className={styles.chips}>
        {!is2026 && status?.DRSAllowed === 1 && (
          <Badge tone="success" size="xs" square title={t('live.raceControlView.drsTitle')}>
            {t('live.raceControlView.drs')}
          </Badge>
        )}
        {is2026 && telemetry2?.OvertakeActive === 1 && (
          <Badge color="var(--f1-yellow)" size="xs" square title={t('live.badges.boostTitle')}>
            {t('live.boostActive')}
          </Badge>
        )}
      </span>
    </>
  );

  return (
    <li
      className={styles.row}
      data-kind={kind}
      style={styleVars({ '--team-color': getTeamColor(participant?.TeamId) })}
      data-testid={`battle-${kind}`}
    >
      {onSelectCar ? (
        <button
          type="button"
          className={`button-reset ${styles.car}`}
          onClick={() => onSelectCar(carIndex)}
          aria-label={t('live.raceControlView.openCar', { driver: name })}
        >
          {content}
        </button>
      ) : (
        <div className={styles.car}>{content}</div>
      )}
    </li>
  );
};

/** The gap between two rows and its trend, green when it's going your way. */
const GapLine: React.FC<{ side: Side; gap: GapReading | null }> = ({ side, gap }) => {
  const { t } = useI18n();
  const trend = gap?.trend;
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;
  return (
    <li className={styles.gap} aria-label={t(`live.driver.gap.${side}`)} data-testid={`battle-gap-${side}`}>
      <span className={styles.gapValue}>
        {gap ? `${side === 'ahead' ? '−' : '+'}${formatGlanceGap(gap.ms)}` : '—'}
      </span>
      {trend && TrendIcon && (
        <span className={styles.trend} data-good={trend.good} data-direction={trend.direction}>
          <TrendIcon size={14} aria-hidden="true" />
          {trend.direction === 'stable'
            ? t('live.driver.trend.stable')
            : t(`live.driver.trend.${trend.direction}`, {
                value: (trend.perLapMs / TIME_CONSTANTS.MS_PER_SECOND).toFixed(2),
              })}
        </span>
      )}
    </li>
  );
};
