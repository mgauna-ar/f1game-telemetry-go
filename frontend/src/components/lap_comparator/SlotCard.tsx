import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import type { Session, Participant, Lap } from '../../types/session';
import { SessionSelectorDropdown } from './SessionSelectorDropdown';
import { CustomLapSelector } from '../CustomLapSelector';
import { useI18n } from '../../context/I18nContext';

interface SlotCardProps {
  slot: 'A' | 'B';
  title: string;
  accentColor: string;
  driver?: Participant;
  sessions: Session[];
  filteredSessions: Session[];
  selectedSession?: Session;
  isSessionDropdownOpen: boolean;
  onToggleSessionDropdown: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  sessionSearchQuery: string;
  onSessionSearchChange: (q: string) => void;
  sessionTypeTab: 'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE';
  onSessionTypeTabChange: (tab: 'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE') => void;
  onSelectSession: (id: number) => void;
  laps: Lap[];
  participants: Participant[];
  selectedLapId: number | '';
  onSelectLap: (lapId: number) => void;
  isRestrictedCircuit?: boolean;
  restrictedTrackName?: string;
}

export const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  title,
  accentColor,
  driver,
  sessions,
  filteredSessions,
  selectedSession,
  isSessionDropdownOpen,
  onToggleSessionDropdown,
  dropdownRef,
  sessionSearchQuery,
  onSessionSearchChange,
  sessionTypeTab,
  onSessionTypeTabChange,
  onSelectSession,
  laps,
  participants,
  selectedLapId,
  onSelectLap,
  isRestrictedCircuit = false,
  restrictedTrackName,
}) => {
  const { t } = useI18n();
  const selectedLap = useMemo(() => laps.find((l) => l.id === selectedLapId), [laps, selectedLapId]);

  return (
    <div className={`comparator-slot-card slot-${slot.toLowerCase()}`}>
      <div className="slot-card-header">
        <span style={{ color: accentColor, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '1rem' }}>●</span> {title}
        </span>
        {driver && (
          <span
            title={`#${driver.race_number} ${driver.name}`}
            style={{
              fontSize: '0.75rem',
              color: accentColor,
              fontWeight: 600,
              textTransform: 'none',
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            #{driver.race_number} {driver.name}
          </span>
        )}
      </div>

      {/* Session Selector */}
      <SessionSelectorDropdown
        sessions={sessions}
        filteredSessions={filteredSessions}
        selectedSession={selectedSession}
        isOpen={isSessionDropdownOpen}
        onToggleOpen={onToggleSessionDropdown}
        dropdownRef={dropdownRef}
        searchQuery={sessionSearchQuery}
        onSearchChange={onSessionSearchChange}
        typeTab={sessionTypeTab}
        onTypeTabChange={onSessionTypeTabChange}
        onSelectSession={onSelectSession}
        slot={slot}
        accentColor={accentColor}
        placeholder={`Select Session ${slot}...`}
        isRestrictedCircuit={isRestrictedCircuit}
        restrictedTrackName={restrictedTrackName}
      />

      {/* Custom Lap Selector */}
      <CustomLapSelector
        laps={laps}
        participants={participants}
        selectedLapId={selectedLapId}
        onSelectLap={onSelectLap}
        slot={slot}
        disabled={!selectedSession}
        placeholder={`Select Lap ${slot}...`}
      />

      {/* Timing Only Warning Badge */}
      {selectedLap && selectedLap.has_telemetry === false && (
        <div
          style={{
            marginTop: '0.45rem',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            background: 'rgba(243, 156, 18, 0.1)',
            border: '1px solid rgba(243, 156, 18, 0.3)',
            color: '#f39c12',
            fontSize: '0.72rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <Clock size={12} />
          <span>{t('comparator.charts.noTelemetryWarning')}</span>
        </div>
      )}
    </div>
  );
};
