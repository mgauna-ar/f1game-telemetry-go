import React, { useState } from 'react';
import { Timer, ArrowLeftRight, Zap, Link, Unlink, X, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { SessionSelectorDropdown } from './SessionSelectorDropdown';
import { ComparatorPreferencesModal } from './ComparatorPreferencesModal';
import { DuelSlotCard, type DuelSlot } from './DuelSlotCard';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { useI18n } from '../../context/I18nContext';
import type { Session, Participant, Lap } from '../../types/session';
import type { SessionTypeTab } from '../../hooks/useComparatorSessions';
import type { ComparatorPreferences } from '../../types/comparatorPreferences';
import styles from './ComparatorDuelHeader.module.css';

export interface ComparatorDuelHeaderProps {
  sessions: Session[];
  selectedSessionAObj?: Session;
  selectedSessionBObj?: Session;
  isLinkedSessions: boolean;
  toggleSessionLink: () => void;
  lapAObj?: Lap;
  lapBObj?: Lap;
  totalDeltaMs: number | null;
  handleSwapSlots: () => void;
  isTimingTowerOpen: boolean;
  setIsTimingTowerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  timingTowerTotalCount: number;
  handleClearSelections: () => void;
  slotA: DuelSlot;
  slotB: DuelSlot;
  filteredDropdownSessionsA: Session[];
  filteredDropdownSessionsB: Session[];
  isSessionADropdownOpen: boolean;
  setIsSessionADropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSessionBDropdownOpen: boolean;
  setIsSessionBDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sessionASearchQuery: string;
  setSessionASearchQuery: (q: string) => void;
  sessionBSearchQuery: string;
  setSessionBSearchQuery: (q: string) => void;
  sessionATypeTab: SessionTypeTab;
  setSessionATypeTab: React.Dispatch<React.SetStateAction<SessionTypeTab>>;
  sessionBTypeTab: SessionTypeTab;
  setSessionBTypeTab: React.Dispatch<React.SetStateAction<SessionTypeTab>>;
  handleSelectSessionA: (sessionId: number) => void;
  handleSelectSessionB: (sessionId: number) => void;
  s1Delta: number | null;
  s2Delta: number | null;
  s3Delta: number | null;
  onPreferencesSave?: (prefs: ComparatorPreferences) => void;
}

const fasterSide = (delta: number) => (delta < 0 ? 'a' : delta > 0 ? 'b' : 'equal');
const lastName = (driver: Participant | undefined, fallback: string) => driver?.name?.split(' ').pop() || fallback;

export const ComparatorDuelHeader: React.FC<ComparatorDuelHeaderProps> = ({
  sessions,
  selectedSessionAObj,
  selectedSessionBObj,
  isLinkedSessions,
  toggleSessionLink,
  lapAObj,
  lapBObj,
  totalDeltaMs,
  handleSwapSlots,
  isTimingTowerOpen,
  setIsTimingTowerOpen,
  timingTowerTotalCount,
  handleClearSelections,
  slotA,
  slotB,
  filteredDropdownSessionsA,
  filteredDropdownSessionsB,
  isSessionADropdownOpen,
  setIsSessionADropdownOpen,
  isSessionBDropdownOpen,
  setIsSessionBDropdownOpen,
  sessionASearchQuery,
  setSessionASearchQuery,
  sessionBSearchQuery,
  setSessionBSearchQuery,
  sessionATypeTab,
  setSessionATypeTab,
  sessionBTypeTab,
  setSessionBTypeTab,
  handleSelectSessionA,
  handleSelectSessionB,
  s1Delta,
  s2Delta,
  s3Delta,
  onPreferencesSave,
}) => {
  const { t } = useI18n();
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const sectorDeltas = [
    { label: 'S1', delta: s1Delta },
    { label: 'S2', delta: s2Delta },
    { label: 'S3', delta: s3Delta },
  ];

  return (
    <Panel as="div" className={styles.panel}>
      {/* Session pickers and actions */}
      <div className={styles.toolbar}>
        <div className={styles.sessionControls}>
          <div className={styles.sessionPicker}>
            <span className={styles.sessionLabel}>{t('comparator.duel.slotASession')}</span>
            <SessionSelectorDropdown
              filteredSessions={filteredDropdownSessionsA}
              selectedSession={selectedSessionAObj}
              isOpen={isSessionADropdownOpen}
              onToggleOpen={() => setIsSessionADropdownOpen((prev) => !prev)}
              searchQuery={sessionASearchQuery}
              onSearchChange={setSessionASearchQuery}
              typeTab={sessionATypeTab}
              onTypeTabChange={setSessionATypeTab}
              onSelectSession={handleSelectSessionA}
              slot="A"
              placeholder={t('comparator.duel.selectSessionA')}
            />
          </div>

          {selectedSessionAObj && sessions.length > 1 && (
            <Button
              size="sm"
              className={styles.linkToggle}
              onClick={toggleSessionLink}
              aria-pressed={isLinkedSessions}
              icon={isLinkedSessions ? <Link size={14} aria-hidden="true" /> : <Unlink size={14} aria-hidden="true" />}
              title={isLinkedSessions ? t('comparator.linkedTitle') : t('comparator.crossSessionTitle')}
              data-testid="session-sync-toggle"
            >
              {isLinkedSessions ? t('comparator.linked') : t('comparator.crossSession')}
            </Button>
          )}

          {/* Slot B's session picker, shown when the sessions are unlinked */}
          {!isLinkedSessions && (
            <div className={styles.sessionPicker}>
              <span className={styles.sessionLabel}>{t('comparator.duel.slotBSession')}</span>
              <SessionSelectorDropdown
                filteredSessions={filteredDropdownSessionsB}
                selectedSession={selectedSessionBObj}
                isOpen={isSessionBDropdownOpen}
                onToggleOpen={() => setIsSessionBDropdownOpen((prev) => !prev)}
                searchQuery={sessionBSearchQuery}
                onSearchChange={setSessionBSearchQuery}
                typeTab={sessionBTypeTab}
                onTypeTabChange={setSessionBTypeTab}
                onSelectSession={handleSelectSessionB}
                slot="B"
                placeholder={t('comparator.duel.selectSessionB')}
                isRestrictedCircuit={!isLinkedSessions}
                restrictedTrackName={selectedSessionAObj?.track_name}
              />
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <Button
            size="sm"
            onClick={() => setIsPreferencesOpen(true)}
            icon={<Sliders size={14} aria-hidden="true" />}
            title={t('comparator.preferencesBtnTooltip')}
            data-testid="duel-open-preferences-btn"
          >
            {t('comparator.preferencesBtn')}
          </Button>

          {lapAObj && lapBObj && (
            <Button
              size="sm"
              onClick={handleSwapSlots}
              icon={<ArrowLeftRight size={14} aria-hidden="true" />}
              title={t('comparator.swapTitle')}
              data-testid="duel-swap-slots-btn"
            >
              {t('comparator.swap')}
            </Button>
          )}

          {(slotA.lapId || slotB.lapId) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearSelections}
              icon={<X size={14} aria-hidden="true" />}
              title={t('comparator.clearTitle')}
              data-testid="duel-clear-selections-btn"
            >
              {t('comparator.clear')}
            </Button>
          )}
        </div>
      </div>

      <div className={styles.matchup}>
        <DuelSlotCard slot="A" label={t('comparator.duel.reference')} lap={lapAObj} data={slotA} />

        <div className={styles.center}>
          {lapAObj && lapBObj && totalDeltaMs !== null ? (
            <div className={styles.delta}>
              <div className={styles.deltaBadge} data-faster={fasterSide(totalDeltaMs)} data-testid="duel-delta-badge">
                <Timer size={14} aria-hidden="true" />
                <span>
                  {totalDeltaMs === 0
                    ? t('comparator.identicalLaps')
                    : t('comparator.deltaLap', {
                        delta: (Math.abs(totalDeltaMs) / 1000).toFixed(3),
                        lap: totalDeltaMs < 0 ? lastName(slotA.driver, 'A') : lastName(slotB.driver, 'B'),
                      })}
                </span>
              </div>

              {sectorDeltas.some((s) => s.delta !== null) && (
                <div className={styles.sectorDeltas}>
                  {sectorDeltas.map(({ label, delta }) =>
                    delta === null ? null : (
                      <span key={label} className={styles.sectorPill} data-faster={fasterSide(delta)}>
                        {label}: {delta <= 0 ? '' : '+'}
                        {(delta / 1000).toFixed(3)}s
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.vs} aria-hidden="true">
              {t('comparator.duel.vs')}
            </div>
          )}

          {timingTowerTotalCount > 0 && (
            <Button
              size="sm"
              className={styles.towerToggle}
              onClick={() => setIsTimingTowerOpen((prev) => !prev)}
              aria-expanded={isTimingTowerOpen}
              icon={<Zap size={14} aria-hidden="true" />}
              data-testid="toggle-quick-select-toolbar-btn"
            >
              {t('comparator.timingTower.title')} ({timingTowerTotalCount})
              {isTimingTowerOpen ? (
                <ChevronUp size={14} aria-hidden="true" />
              ) : (
                <ChevronDown size={14} aria-hidden="true" />
              )}
            </Button>
          )}
        </div>

        <DuelSlotCard slot="B" label={t('comparator.duel.comparison')} lap={lapBObj} data={slotB} />
      </div>

      <ComparatorPreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        onSave={(prefs) => {
          onPreferencesSave?.(prefs);
        }}
        currentSlotBDriverName={slotB.driver?.name}
      />
    </Panel>
  );
};
