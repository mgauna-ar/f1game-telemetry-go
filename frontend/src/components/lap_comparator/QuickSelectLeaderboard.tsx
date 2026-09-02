import React from 'react';
import { Zap } from 'lucide-react';
import type { Participant, Lap } from '../../types/session';
import { formatTime } from '../../utils/formatters';
import { useI18n } from '../../context/I18nContext';
import { LeaderboardSearchBar } from './LeaderboardSearchBar';
import { DriverGridCard } from './DriverGridCard';

export interface QuickSelectDriver extends Participant {
  bestLap: Lap | null;
  sessionSlot?: 'A' | 'B';
  sessionTrack?: string;
  sessionType?: string;
}

export interface QuickSelectLeaderboardProps {
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
}

export const QuickSelectLeaderboard: React.FC<QuickSelectLeaderboardProps> = ({
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
}) => {
  const { t } = useI18n();

  return (
    <div
      className="glass-panel"
      style={{
        gridColumn: 'span 12',
        padding: '0.75rem 1.25rem',
        transition: 'all 0.2s ease',
      }}
      data-testid="quick-select-panel"
    >
      {/* Panel Header & Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggleOpen}
        data-testid="quick-select-header-toggle"
      >
        {/* Left: Title, Driver Count Badge & Collapsed Snippet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Zap size={15} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('comparator.quickSelect.title')}
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
              data-testid="quick-select-driver-count"
            >
              {quickSelectData.drivers.length}{driverSearchQuery ? ` / ${quickSelectData.totalCount}` : ''} {t('common.drivers').toLowerCase()}
            </span>
          </div>

          {/* Top 3 snippet when collapsed */}
          {!isOpen && quickSelectData.drivers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem', flexWrap: 'wrap' }}>
              {quickSelectData.drivers.slice(0, 3).map((d, i) => (
                <span
                  key={`${d.session_id}-${d.car_index}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: i === 0 ? '#ffd700' : 'var(--text-secondary)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  P{i + 1}: {d.name.split(' ').pop()} {d.bestLap ? formatTime(d.bestLap.lap_time_ms) : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: Search, Tabs & Collapse Control */}
        <LeaderboardSearchBar
          isOpen={isOpen}
          onToggleOpen={onToggleOpen}
          isLinkedSessions={isLinkedSessions}
          sessionAId={sessionAId}
          sessionBId={sessionBId}
          quickSelectSessionTab={quickSelectSessionTab}
          onQuickSelectSessionTabChange={onQuickSelectSessionTabChange}
          driverSearchQuery={driverSearchQuery}
          onDriverSearchChange={onDriverSearchChange}
        />
      </div>

      {/* Expanded Grid Content */}
      {isOpen && (
        <div style={{ marginTop: '0.85rem' }}>
          {quickSelectData.drivers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No drivers match your search query.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '0.6rem',
                maxHeight: '340px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
              data-testid="quick-select-drivers-grid"
            >
              {quickSelectData.drivers.map((p, idx) => (
                <DriverGridCard
                  key={`${p.session_id}-${p.car_index}`}
                  driver={p}
                  index={idx}
                  leaderLapTimeMs={quickSelectData.leaderLapTimeMs}
                  lapAId={lapAId}
                  lapBId={lapBId}
                  lapsA={lapsA}
                  lapsB={lapsB}
                  onSetLapA={onSetLapA}
                  onSetLapB={onSetLapB}
                  isLinkedSessions={isLinkedSessions}
                  sessionAId={sessionAId}
                  sessionBId={sessionBId}
                  participantsA={participantsA}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
