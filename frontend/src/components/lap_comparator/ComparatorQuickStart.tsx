import React, { useMemo } from 'react';
import { ArrowRight, Rocket } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { CompareParams } from '../../router/routes';
import type { SessionListItem } from '../../types/session';
import { quickStartComparisons, type QuickStartComparison } from '../../utils/comparatorQuickStart';
import { sessionTypeLabel } from '../../utils/sessionTypeLabel';
import { formatLapTime } from '../../utils/formatters';
import { TrackFlag } from '../TrackFlag';
import { EmptyState } from '../ui/EmptyState';
import { Panel, PanelHeader } from '../ui/Panel';
import styles from './ComparatorQuickStart.module.css';
import { useUnits } from '../../hooks/useUnits';

export interface ComparatorQuickStartProps {
  sessions: SessionListItem[];
  onStart: (params: CompareParams) => void;
}

const TITLE_KEYS: Record<QuickStartComparison['kind'], string> = {
  bestVsFastest: 'comparator.quickStart.bestVsFastest',
  bestVsNextFastest: 'comparator.quickStart.bestVsNextFastest',
  vsPrevious: 'comparator.quickStart.vsPrevious',
  fastestLap: 'comparator.quickStart.fastestLaps',
};

/** What the comparator shows before any lap is picked: comparisons to open in one click. */
export const ComparatorQuickStart: React.FC<ComparatorQuickStartProps> = ({ sessions, onStart }) => {
  const { t } = useI18n();
  const units = useUnits();
  const cards = useMemo(() => quickStartComparisons(sessions), [sessions]);

  if (cards.length === 0) {
    return (
      <Panel as="div" className={styles.panel}>
        <EmptyState icon={<Rocket size={32} />} description={t('comparator.quickStart.empty')} />
      </Panel>
    );
  }

  const gap = (card: QuickStartComparison) =>
    card.lapBTimeMs === null ? null : ((card.lapATimeMs - card.lapBTimeMs) / 1000).toFixed(3);

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        level={2}
        icon={<Rocket size={15} />}
        title={t('comparator.quickStart.title')}
        subtitle={t('comparator.quickStart.subtitle')}
      />
      <ul className={styles.cards}>
        {cards.map((card) => {
          const delta = gap(card);
          return (
            <li key={`${card.kind}-${card.session.id}`}>
              <button type="button" className={`button-reset ${styles.card}`} onClick={() => onStart(card.params)}>
                <span className={styles.kind}>
                  {t(TITLE_KEYS[card.kind])}
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
                <span className={styles.session}>
                  <TrackFlag track={card.session.track_name} width={16} height={11} />
                  {card.session.track_name} · {sessionTypeLabel(card.session.session_type, t)}
                </span>
                <span className={styles.meta}>
                  {card.previous
                    ? t('comparator.quickStart.previousSession', { date: units.dateAndTime(card.previous.created_at) })
                    : units.dateAndTime(card.session.created_at)}
                </span>
                <span className={styles.times}>
                  <span data-slot="a">{formatLapTime(card.lapATimeMs)}</span>
                  {card.lapBTimeMs !== null && (
                    <>
                      <span aria-hidden="true">vs</span>
                      <span data-slot="b">{formatLapTime(card.lapBTimeMs)}</span>
                      {delta !== null && (
                        <span className={styles.delta}>
                          ({Number(delta) > 0 ? '+' : ''}
                          {delta} s)
                        </span>
                      )}
                    </>
                  )}
                  {card.kind === 'bestVsNextFastest' && (
                    <span className={styles.note}>{t('comparator.quickStart.youWereFastest')}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {cards[0].kind === 'fastestLap' && <p className={styles.hint}>{t('comparator.quickStart.noPlayer')}</p>}
    </Panel>
  );
};
