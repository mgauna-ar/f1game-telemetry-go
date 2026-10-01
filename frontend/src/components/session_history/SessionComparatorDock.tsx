import React from 'react';
import { GitCompare, ArrowLeftRight, X, ChevronRight, Zap } from 'lucide-react';
import { getTeamColor } from '../../constants/f1';
import { styleVars } from '../../styles/theme';
import type { StagedLap } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContextDefinitions';
import { formatLapTime as defaultFormatLapTime } from '../../utils/formatters';
import { Button, IconButton } from '../ui/Button';
import { cx } from '../ui/cx';
import styles from './SessionDock.module.css';

export type { StagedLap };

export interface SessionComparatorDockProps {
  stagedA?: StagedLap | null;
  stagedB?: StagedLap | null;
  onClearA?: () => void;
  onClearB?: () => void;
  onClearAll?: () => void;
  onSwap?: () => void;
  onLaunch?: () => void;
  formatLapTime?: (ms: number) => string;
}

interface SlotChipProps {
  slot: 'A' | 'B';
  staged: StagedLap | null | undefined;
  onClear: () => void;
  formatLapTime: (ms: number) => string;
}

const SlotChip: React.FC<SlotChipProps> = ({ slot, staged, onClear, formatLapTime }) => {
  const { t } = useI18n();
  return (
    <div className={cx(styles.slot, slot === 'B' && styles.slotB, staged && styles.filled)}>
      <span className={styles.slotTag}>{t(`history.dock.stagingSlot${slot}`)}</span>
      {staged ? (
        <div className={styles.staged} style={styleVars({ '--team-color': getTeamColor(staged.teamId) })}>
          <span className={styles.teamBar} aria-hidden="true" />
          <div className={styles.stagedText}>
            <div className={styles.stagedDriver}>{staged.driverName}</div>
            <div className={styles.stagedLap}>
              L{staged.lapNumber} • {formatLapTime(staged.lapTimeMS)}
            </div>
          </div>
          <IconButton
            size="sm"
            className={styles.removeSlot}
            label={t(`history.dock.removeSlot${slot}`)}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <X size={13} />
          </IconButton>
        </div>
      ) : (
        <span className={styles.empty}>{t(`history.dock.pickLap${slot}`)}</span>
      )}
    </div>
  );
};

export const SessionComparatorDock: React.FC<SessionComparatorDockProps> = (props) => {
  const { t } = useI18n();
  const historyData = useSessionHistoryData();
  const historyActions = useSessionHistoryActions();

  const stagedA = props.stagedA !== undefined ? props.stagedA : historyData.stagedSlotA;
  const stagedB = props.stagedB !== undefined ? props.stagedB : historyData.stagedSlotB;
  const onClearA = props.onClearA ?? historyActions.handleClearStagedA;
  const onClearB = props.onClearB ?? historyActions.handleClearStagedB;
  const onClearAll = props.onClearAll ?? historyActions.handleClearAllStaged;
  const onSwap = props.onSwap ?? historyActions.handleSwapStagedSlots;
  const onLaunch = props.onLaunch ?? historyActions.handleLaunchComparison;
  const formatLapTime = props.formatLapTime ?? defaultFormatLapTime;

  const hasAny = !!stagedA || !!stagedB;
  const hasBoth = !!stagedA && !!stagedB;

  if (!hasAny) return null;

  return (
    <section className={cx(styles.dock, styles.wide)} data-session-dock aria-labelledby="comparator-dock-title">
      <div className={styles.intro}>
        <span className={styles.introIcon} aria-hidden="true">
          <GitCompare size={18} />
        </span>
        <div>
          <h2 id="comparator-dock-title" className={styles.introTitle}>
            {t('history.dock.stagingTitle')}
          </h2>
          <div className={styles.introSub} role="status">
            {hasBoth ? t('history.dock.readyToCompare') : t('history.dock.selectAnother')}
          </div>
        </div>
      </div>

      <div className={styles.slots}>
        <SlotChip slot="A" staged={stagedA} onClear={onClearA} formatLapTime={formatLapTime} />
        <IconButton
          size="sm"
          variant="secondary"
          label={t('history.dock.swapSlots')}
          disabled={!hasBoth}
          onClick={onSwap}
        >
          <ArrowLeftRight size={13} />
        </IconButton>
        <SlotChip slot="B" staged={stagedB} onClear={onClearB} formatLapTime={formatLapTime} />
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          {t('common.clear')}
        </Button>
        <Button variant="primary" icon={<Zap size={14} aria-hidden="true" />} onClick={onLaunch}>
          {hasBoth ? t('history.dock.compare2Laps') : t('history.dock.launchComparator')}
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
};
