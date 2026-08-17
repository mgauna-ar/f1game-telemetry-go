import React from 'react';
import { MapPin, Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { Session } from '../../types/session';
import { getSessionBadgeClass } from '../../utils/formatters';
import { useI18n } from '../../context/I18nContext';
import { TagBadge } from '../session_history/TagBadge';
import { F1FormatBadge } from '../F1FormatBadge';

interface SessionSelectorDropdownProps {
  sessions: Session[];
  filteredSessions: Session[];
  selectedSession: Session | undefined;
  isOpen: boolean;
  onToggleOpen: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  typeTab: 'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE';
  onTypeTabChange: (tab: 'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE') => void;
  onSelectSession: (id: number) => void;
  slot: 'A' | 'B';
  accentColor: string;
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
  accentColor,
  placeholder = 'Select Session...',
  isRestrictedCircuit = false,
  restrictedTrackName,
}) => {
  const { t } = useI18n();

  return (
    <div
      ref={dropdownRef}
      className={`custom-session-dropdown ${isOpen ? 'is-open' : ''}`}
      style={{ position: 'relative', zIndex: isOpen ? 100 : 1 }}
    >
      <button
        type="button"
        className={`custom-session-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-testid={slot === 'A' ? 'session-selector-trigger' : 'session-b-selector-trigger'}
      >
        {selectedSession ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <MapPin size={14} color={accentColor} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSession.track_name}</span>
            <F1FormatBadge format={selectedSession.packet_format} size="xs" />
            <span
              className={`session-badge ${getSessionBadgeClass(selectedSession.session_type)}`}
              style={{ fontSize: '0.65rem', padding: '1px 6px', flexShrink: 0 }}
            >
              {selectedSession.session_type}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
              ({new Date(selectedSession.created_at).toLocaleDateString()})
            </span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
        )}
        {isOpen ? (
          <ChevronUp size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
        ) : (
          <ChevronDown size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
        )}
      </button>

      {isOpen && (
        <div className="custom-session-popover" role="listbox">
          {/* Circuit Filter Indicator when restricted */}
          {isRestrictedCircuit && restrictedTrackName && (
            <div
              style={{
                padding: '0.35rem 0.65rem',
                background: 'rgba(0, 210, 211, 0.1)',
                borderBottom: '1px solid rgba(0, 210, 211, 0.2)',
                fontSize: '0.72rem',
                color: '#00d2d3',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <MapPin size={12} />
              <span>{t('comparator.dropdown.filteredToCircuit', { track: restrictedTrackName })}</span>
            </div>
          )}

          <div className="custom-session-search-wrapper">
            <Search size={14} className="custom-session-search-icon" />
            <input
              type="text"
              className="custom-session-search-input"
              placeholder={
                isRestrictedCircuit
                  ? t('comparator.dropdown.searchSameCircuit')
                  : t('comparator.dropdown.searchAny')
              }
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="custom-session-clear-btn"
                onClick={() => onSearchChange('')}
                title={t('comparator.dropdown.clearSearch')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="custom-session-filter-tabs">
            {(['ALL', 'RACE', 'SPRINT', 'QUALI', 'PRACTICE'] as const).map((tab) => {
              const tabMap: Record<string, string> = {
                ALL: t('comparator.dropdown.tabAll'),
                RACE: t('comparator.dropdown.tabRace'),
                SPRINT: t('comparator.dropdown.tabSprint'),
                QUALI: t('comparator.dropdown.tabQuali'),
                PRACTICE: t('comparator.dropdown.tabPractice'),
              };
              return (
                <button
                  key={tab}
                  type="button"
                  className={`custom-session-filter-tab ${typeTab === tab ? 'active' : ''}`}
                  onClick={() => onTypeTabChange(tab)}
                >
                  {tabMap[tab]}
                </button>
              );
            })}
          </div>

          <div className="custom-session-list">
            {filteredSessions.length > 0 ? (
              filteredSessions.map((s) => {
                const isSelected = selectedSession?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`custom-session-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => onSelectSession(s.id)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="custom-session-item-header">
                      <span className="custom-session-track">{s.track_name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <F1FormatBadge format={s.packet_format} size="xs" />
                        <span className={`session-badge ${getSessionBadgeClass(s.session_type)}`}>
                          {s.session_type}
                        </span>
                      </div>
                    </div>
                    <div className="custom-session-meta">
                      <span className="custom-session-meta-time">{new Date(s.created_at).toLocaleString()}</span>
                      {s.weather && <span className="custom-session-weather">🌦️ {s.weather}</span>}
                    </div>
                    {s.tags && s.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {s.tags.map((tag) => (
                          <TagBadge key={tag.id} tag={tag} size="xs" />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {isRestrictedCircuit
                  ? t('comparator.dropdown.noMatchingTrack')
                  : t('comparator.dropdown.noMatching')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
