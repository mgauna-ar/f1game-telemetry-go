import React from 'react';
import {
  Gauge,
  Timer,
  ArrowLeftRight,
  Zap,
  Link,
  Unlink,
  X,
} from 'lucide-react';
import { TrackFlag } from '../TrackFlag';
import { SlotCard } from './SlotCard';
import { formatTime } from '../../utils/formatters';
import { useI18n } from '../../context/I18nContext';
import type { Session, Participant, Lap } from '../../types/session';
import type { SessionTypeTab } from '../../hooks/useComparatorSessions';

interface ComparatorHeaderProps {
  sessions: Session[];
  selectedSessionAObj?: Session;
  selectedSessionBObj?: Session;
  isLinkedSessions: boolean;
  toggleSessionLink: () => void;
  lapAObj?: Lap;
  lapBObj?: Lap;
  totalDeltaMs: number | null;
  handleSwapSlots: () => void;
  isQuickSelectOpen: boolean;
  setIsQuickSelectOpen: React.Dispatch<React.SetStateAction<boolean>>;
  quickSelectTotalCount: number;
  handleClearSelections: () => void;
  slotA: {
    driver?: Participant;
    laps: Lap[];
    participants: Participant[];
    lapId: number | '';
    setLapId: (id: number | '') => void;
  };
  slotB: {
    driver?: Participant;
    laps: Lap[];
    participants: Participant[];
    lapId: number | '';
    setLapId: (id: number | '') => void;
  };
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
}

export const ComparatorHeader: React.FC<ComparatorHeaderProps> = ({
  sessions,
  selectedSessionAObj,
  selectedSessionBObj,
  isLinkedSessions,
  toggleSessionLink,
  lapAObj,
  lapBObj,
  totalDeltaMs,
  handleSwapSlots,
  isQuickSelectOpen,
  setIsQuickSelectOpen,
  quickSelectTotalCount,
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
}) => {
  const { t } = useI18n();

  return (
    <div
      className="glass-panel"
      style={{
        gridColumn: 'span 12',
        padding: '1.25rem 1.5rem',
        position: 'relative',
        zIndex: 80,
      }}
    >
      {/* Top Header Row: Title & Subtitle + Live Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
            <Gauge color="var(--accent-primary)" size={26} /> {t('comparator.title')}
          </h2>
          <p className="text-secondary" style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
            {t('comparator.subtitle')}
          </p>
        </div>

        {/* Live Badges and Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {selectedSessionAObj && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              <TrackFlag track={selectedSessionAObj.track_name} width={18} height={12} />
              <span>{selectedSessionAObj.track_name}</span>
              {!isLinkedSessions && selectedSessionBObj && selectedSessionBObj.id !== selectedSessionAObj.id && (
                <span style={{ fontSize: '0.72rem', background: 'rgba(255, 165, 2, 0.2)', color: '#ffa502', padding: '1px 6px', borderRadius: '10px' }}>
                  {t('comparator.crossSession')}
                </span>
              )}
            </div>
          )}

          {/* Session Link / Unlink Toggle Button */}
          {selectedSessionAObj && sessions.length > 1 && (
            <button
              type="button"
              onClick={toggleSessionLink}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                background: isLinkedSessions ? 'rgba(0, 210, 211, 0.12)' : 'rgba(255, 165, 2, 0.15)',
                border: `1px solid ${isLinkedSessions ? 'rgba(0, 210, 211, 0.4)' : 'rgba(255, 165, 2, 0.5)'}`,
                color: isLinkedSessions ? '#00d2d3' : '#ffa502',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={isLinkedSessions ? t('comparator.linkedTitle') : t('comparator.crossSessionTitle')}
              data-testid="session-sync-toggle"
            >
              {isLinkedSessions ? <Link size={14} /> : <Unlink size={14} />}
              <span>{isLinkedSessions ? t('comparator.linked') : t('comparator.crossSession')}</span>
            </button>
          )}

          {lapAObj && lapBObj && totalDeltaMs !== null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                background: totalDeltaMs < 0 ? 'rgba(255, 71, 87, 0.15)' : totalDeltaMs > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${totalDeltaMs < 0 ? '#ff4757' : totalDeltaMs > 0 ? '#00d2d3' : 'rgba(255, 255, 255, 0.2)'}`,
                fontSize: '0.82rem',
                fontWeight: 700,
                color: totalDeltaMs < 0 ? '#ff4757' : totalDeltaMs > 0 ? '#00d2d3' : '#fff',
              }}
            >
              <Timer size={14} />
              <span>
                {totalDeltaMs < 0
                  ? t('comparator.deltaLap', { delta: (Math.abs(totalDeltaMs) / 1000).toFixed(3), lap: t('comparator.lapA') })
                  : totalDeltaMs > 0
                  ? t('comparator.deltaLap', { delta: (Math.abs(totalDeltaMs) / 1000).toFixed(3), lap: t('comparator.lapB') })
                  : t('comparator.identicalLaps')}
              </span>
            </div>
          )}

          {lapAObj && lapBObj && (
            <button
              type="button"
              onClick={handleSwapSlots}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={t('comparator.swapTitle')}
            >
              <ArrowLeftRight size={13} /> {t('comparator.swap')}
            </button>
          )}

          {quickSelectTotalCount > 0 && (
            <button
              type="button"
              onClick={() => setIsQuickSelectOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '20px',
                background: isQuickSelectOpen ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${isQuickSelectOpen ? 'rgba(0, 210, 211, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
                color: isQuickSelectOpen ? '#00d2d3' : 'var(--text-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={isQuickSelectOpen ? t('comparator.collapseDrivers') : t('comparator.expandDrivers')}
              data-testid="toggle-quick-select-toolbar-btn"
            >
              <Zap size={13} color={isQuickSelectOpen ? '#00d2d3' : 'var(--accent-primary)'} />
              <span>{t('comparator.drivers', { count: quickSelectTotalCount })}</span>
            </button>
          )}

          {(slotA.lapId || slotB.lapId) && (
            <button
              type="button"
              onClick={handleClearSelections}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '20px',
                background: 'rgba(255, 71, 87, 0.1)',
                border: '1px solid rgba(255, 71, 87, 0.3)',
                color: '#ff4757',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={t('comparator.clearTitle')}
            >
              <X size={13} /> {t('comparator.clear')}
            </button>
          )}
        </div>
      </div>

      {/* SIDE-BY-SIDE COMPARISON SLOTS CONTAINER */}
      <div className="comparator-slots-container">
        {/* SLOT A CARD */}
        <SlotCard
          slot="A"
          title={t('comparator.slotABaseline')}
          accentColor="#ff4757"
          driver={slotA.driver}
          sessions={sessions}
          filteredSessions={filteredDropdownSessionsA}
          selectedSession={selectedSessionAObj}
          isSessionDropdownOpen={isSessionADropdownOpen}
          onToggleSessionDropdown={() => setIsSessionADropdownOpen((prev) => !prev)}
          sessionSearchQuery={sessionASearchQuery}
          onSessionSearchChange={setSessionASearchQuery}
          sessionTypeTab={sessionATypeTab}
          onSessionTypeTabChange={setSessionATypeTab}
          onSelectSession={handleSelectSessionA}
          laps={slotA.laps}
          participants={slotA.participants}
          selectedLapId={slotA.lapId}
          onSelectLap={(id) => slotA.setLapId(id)}
        />

        {/* SLOT B CARD */}
        <SlotCard
          slot="B"
          title={t('comparator.slotBComparison')}
          accentColor="#00d2d3"
          driver={slotB.driver}
          sessions={sessions}
          filteredSessions={filteredDropdownSessionsB}
          selectedSession={selectedSessionBObj}
          isSessionDropdownOpen={isSessionBDropdownOpen}
          onToggleSessionDropdown={() => setIsSessionBDropdownOpen((prev) => !prev)}
          sessionSearchQuery={sessionBSearchQuery}
          onSessionSearchChange={setSessionBSearchQuery}
          sessionTypeTab={sessionBTypeTab}
          onSessionTypeTabChange={setSessionBTypeTab}
          onSelectSession={handleSelectSessionB}
          laps={slotB.laps}
          participants={slotB.participants}
          selectedLapId={slotB.lapId}
          onSelectLap={(id) => slotB.setLapId(id)}
          isRestrictedCircuit={!isLinkedSessions}
          restrictedTrackName={selectedSessionAObj?.track_name}
        />
      </div>

      {/* Bottom Detailed Telemetry Summary & Sector Deltas Bar */}
      {(lapAObj || lapBObj) && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {/* Left: Selected Laps Summary Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {lapAObj && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff4757', display: 'inline-block' }} />
                <span style={{ fontWeight: 600, color: '#fff' }}>Lap A:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#ff4757', fontWeight: 700 }}>{formatTime(lapAObj.lap_time_ms)}</span>
                {slotA.driver && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({slotA.driver.name})</span>}
                {lapAObj.max_speed_kmh && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(255, 71, 87, 0.1)', color: '#ff4757', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {Math.round(lapAObj.max_speed_kmh)} km/h
                  </span>
                )}
                {!lapAObj.is_valid && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                    Invalid
                  </span>
                )}
              </div>
            )}

            {lapAObj && lapBObj && <div style={{ height: '16px', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />}

            {lapBObj && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d2d3', display: 'inline-block' }} />
                <span style={{ fontWeight: 600, color: '#fff' }}>Lap B:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#00d2d3', fontWeight: 700 }}>{formatTime(lapBObj.lap_time_ms)}</span>
                {slotB.driver && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({slotB.driver.name})</span>}
                {lapBObj.max_speed_kmh && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(0, 210, 211, 0.1)', color: '#00d2d3', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {Math.round(lapBObj.max_speed_kmh)} km/h
                  </span>
                )}
                {!lapBObj.is_valid && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                    Invalid
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Sector Deltas Chips (S1, S2, S3) */}
          {lapAObj && lapBObj && (s1Delta !== null || s2Delta !== null || s3Delta !== null) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sectors (Δ A vs B):</span>
              {s1Delta !== null && (
                <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: s1Delta < 0 ? 'rgba(255, 71, 87, 0.15)' : s1Delta > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', color: s1Delta < 0 ? '#ff4757' : s1Delta > 0 ? '#00d2d3' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  S1: {s1Delta <= 0 ? '' : '+'}{(s1Delta / 1000).toFixed(3)}s
                </span>
              )}
              {s2Delta !== null && (
                <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: s2Delta < 0 ? 'rgba(255, 71, 87, 0.15)' : s2Delta > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', color: s2Delta < 0 ? '#ff4757' : s2Delta > 0 ? '#00d2d3' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  S2: {s2Delta <= 0 ? '' : '+'}{(s2Delta / 1000).toFixed(3)}s
                </span>
              )}
              {s3Delta !== null && (
                <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: s3Delta < 0 ? 'rgba(255, 71, 87, 0.15)' : s3Delta > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', color: s3Delta < 0 ? '#ff4757' : s3Delta > 0 ? '#00d2d3' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  S3: {s3Delta <= 0 ? '' : '+'}{(s3Delta / 1000).toFixed(3)}s
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
