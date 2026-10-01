import React, { useRef, useEffect, useId } from 'react';
import { Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { Session } from '../../types/session';
import { SessionTypeBadge } from '../common/SessionTypeBadge';
import { useI18n } from '../../context/I18nContext';
import { TagBadge } from '../session_history/TagBadge';
import { F1FormatBadge } from '../F1FormatBadge';
import { TrackFlag } from '../TrackFlag';
import { IconButton } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import styles from './SessionSelectorDropdown.module.css';
import { useUnits } from '../../hooks/useUnits';

type TypeTab = 'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE';

interface SessionSelectorDropdownProps {
  filteredSessions: Session[];
  selectedSession: Session | undefined;
  isOpen: boolean;
  onToggleOpen: () => void;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  typeTab: TypeTab;
  onTypeTabChange: (tab: TypeTab) => void;
  onSelectSession: (id: number) => void;
  slot: 'A' | 'B';
  placeholder?: string;
  isRestrictedCircuit?: boolean;
  restrictedTrackName?: string;
}

export const SessionSelectorDropdown: React.FC<SessionSelectorDropdownProps> = ({
  filteredSessions,
  selectedSession,
  isOpen,
  onToggleOpen,
  dropdownRef,
  searchQuery,
  onSearchChange,
  typeTab,
  onTypeTabChange,
  onSelectSession,
  slot,
  placeholder = 'Select Session...',
  isRestrictedCircuit = false,
  restrictedTrackName,
}) => {
  const { t } = useI18n();
  const units = useUnits();
  const internalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = dropdownRef || internalRef;
  const listId = useId();

  // Click outside and Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onToggleOpen();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onToggleOpen();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onToggleOpen, containerRef]);

  const typeOptions = [
    { value: 'ALL', label: t('comparator.dropdown.tabAll') },
    { value: 'RACE', label: t('comparator.dropdown.tabRace') },
    { value: 'SPRINT', label: t('comparator.dropdown.tabSprint') },
    { value: 'QUALI', label: t('comparator.dropdown.tabQuali') },
    { value: 'PRACTICE', label: t('comparator.dropdown.tabPractice') },
  ] as const;

  const Chevron = isOpen ? ChevronUp : ChevronDown;

  return (
    <div ref={containerRef} className={styles.dropdown} data-open={isOpen || undefined}>
      <button
        type="button"
        className={styles.trigger}
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listId : undefined}
        data-testid={slot === 'A' ? 'session-selector-trigger' : 'session-b-selector-trigger'}
      >
        {selectedSession ? (
          <span className={styles.selected}>
            <TrackFlag track={selectedSession.track_name} width={18} height={12} />
            <span className={styles.selectedTrack}>{selectedSession.track_name}</span>
            <F1FormatBadge format={selectedSession.packet_format} size="xs" />
            <SessionTypeBadge sessionType={selectedSession.session_type} size="xs" showIcon={false} />
            <span className={styles.selectedDate}>({new Date(selectedSession.created_at).toLocaleDateString()})</span>
          </span>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
        <Chevron size={15} className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className={styles.popover}>
          {isRestrictedCircuit && restrictedTrackName && (
            <div className={styles.restricted}>
              <TrackFlag track={restrictedTrackName} width={15} height={10} />
              <span>{t('comparator.dropdown.filteredToCircuit', { track: restrictedTrackName })}</span>
            </div>
          )}

          <div className={styles.search}>
            <Search size={14} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              className={styles.searchInput}
              aria-label={t('comparator.dropdown.searchSessions')}
              placeholder={
                isRestrictedCircuit ? t('comparator.dropdown.searchSameCircuit') : t('comparator.dropdown.searchAny')
              }
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <IconButton
                variant="ghost"
                size="sm"
                className={styles.clear}
                label={t('comparator.dropdown.clearSearch')}
                onClick={() => onSearchChange('')}
              >
                <X size={12} />
              </IconButton>
            )}
          </div>

          <SegmentedControl
            options={typeOptions}
            value={typeTab}
            onChange={onTypeTabChange}
            aria-label={t('comparator.dropdown.typeFilterLabel')}
            size="xs"
          />

          {filteredSessions.length > 0 ? (
            <div id={listId} role="listbox" aria-label={placeholder} className={styles.list}>
              {filteredSessions.map((s) => {
                const isSelected = selectedSession?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.item}
                    onClick={() => onSelectSession(s.id)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className={styles.itemRow}>
                      <span className={styles.trackGroup}>
                        <TrackFlag track={s.track_name} width={18} height={12} />
                        <span className={styles.track}>{s.track_name}</span>
                      </span>
                      <span className={styles.badges}>
                        <F1FormatBadge format={s.packet_format} size="xs" />
                        <SessionTypeBadge sessionType={s.session_type} size="xs" showIcon={false} />
                      </span>
                    </span>

                    <span className={styles.itemRow}>
                      <span className={styles.meta}>{units.dateAndTime(s.created_at)}</span>
                      {s.weather && <span className={styles.weather}>🌦️ {s.weather}</span>}
                    </span>

                    {s.tags && s.tags.length > 0 && (
                      <span className={styles.tags}>
                        {s.tags.map((tag) => (
                          <TagBadge key={tag.id} tag={tag} size="xs" />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={styles.empty}>
              {isRestrictedCircuit ? t('comparator.dropdown.noMatchingTrack') : t('comparator.dropdown.noMatching')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
