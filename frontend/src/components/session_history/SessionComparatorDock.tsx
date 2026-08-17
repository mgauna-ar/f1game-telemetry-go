import React from 'react';
import { GitCompare, ArrowLeftRight, X, ChevronRight, Zap } from 'lucide-react';
import { TEAM_COLORS } from '../../constants/f1';
import type { StagedLap } from '../../types/session';

export type { StagedLap };

interface SessionComparatorDockProps {
  stagedA: StagedLap | null;
  stagedB: StagedLap | null;
  onClearA: () => void;
  onClearB: () => void;
  onClearAll: () => void;
  onSwap: () => void;
  onLaunch: () => void;
  formatLapTime: (ms: number) => string;
}

export const SessionComparatorDock: React.FC<SessionComparatorDockProps> = ({
  stagedA,
  stagedB,
  onClearA,
  onClearB,
  onClearAll,
  onSwap,
  onLaunch,
  formatLapTime,
}) => {
  const hasAny = !!stagedA || !!stagedB;
  const hasBoth = !!stagedA && !!stagedB;

  if (!hasAny) return null;

  return (
    <div
      className="comparator-staging-dock"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'min(92vw, 840px)',
        backgroundColor: 'rgba(12, 16, 26, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(0, 242, 254, 0.4)',
        borderRadius: '14px',
        padding: '0.85rem 1.25rem',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 242, 254, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Left Title Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 242, 254, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00f2fe',
          }}
        >
          <GitCompare size={18} />
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em', color: '#00f2fe' }}>
            LAP COMPARATOR STAGING
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {hasBoth ? '2 Laps ready to compare' : 'Select another lap or compare now'}
          </div>
        </div>
      </div>

      {/* Center Staged Laps Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', justifyContent: 'center' }}>
        {/* Slot A Chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: stagedA ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.03)',
            border: stagedA ? '1px solid rgba(0, 242, 254, 0.5)' : '1px dashed rgba(255, 255, 255, 0.15)',
            minWidth: '160px',
          }}
        >
          <span className="mono" style={{ fontSize: '0.7rem', fontWeight: 800, color: '#00f2fe', padding: '2px 4px', borderRadius: '4px', background: 'rgba(0,242,254,0.2)' }}>
            SLOT A
          </span>
          {stagedA ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span style={{ width: '3px', height: '16px', borderRadius: '2px', backgroundColor: TEAM_COLORS[stagedA.teamId] || '#A0A0A0' }} />
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{stagedA.driverName}</div>
                <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent-tertiary)' }}>
                  L{stagedA.lapNumber} • {formatLapTime(stagedA.lapTimeMS)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearA();
                }}
                title="Remove Slot A"
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Pick a lap for A...
            </span>
          )}
        </div>

        {/* Swap Button & VS Badge */}
        <button
          onClick={onSwap}
          title="Swap Slot A and Slot B"
          disabled={!stagedA || !stagedB}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: stagedA && stagedB ? 'var(--text-primary)' : 'var(--text-muted)',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: stagedA && stagedB ? 'pointer' : 'default',
          }}
        >
          <ArrowLeftRight size={13} />
        </button>

        {/* Slot B Chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: stagedB ? 'rgba(225, 6, 0, 0.1)' : 'rgba(255, 255, 255, 0.03)',
            border: stagedB ? '1px solid rgba(225, 6, 0, 0.5)' : '1px dashed rgba(255, 255, 255, 0.15)',
            minWidth: '160px',
          }}
        >
          <span className="mono" style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ff4d4f', padding: '2px 4px', borderRadius: '4px', background: 'rgba(225,6,0,0.2)' }}>
            SLOT B
          </span>
          {stagedB ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span style={{ width: '3px', height: '16px', borderRadius: '2px', backgroundColor: TEAM_COLORS[stagedB.teamId] || '#A0A0A0' }} />
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{stagedB.driverName}</div>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#ff4d4f' }}>
                  L{stagedB.lapNumber} • {formatLapTime(stagedB.lapTimeMS)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearB();
                }}
                title="Remove Slot B"
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Pick a lap for B...
            </span>
          )}
        </div>
      </div>

      {/* Right Launch & Clear Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onClearAll}
          className="nav-tab"
          style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          Clear
        </button>

        <button
          onClick={onLaunch}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRadius: '8px',
            border: 'none',
            background: hasBoth
              ? 'linear-gradient(135deg, #00f2fe, #4facfe)'
              : 'linear-gradient(135deg, var(--accent-primary), #ff4d4f)',
            color: hasBoth ? '#000000' : '#ffffff',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
            transition: 'transform 0.15s ease, filter 0.15s ease',
          }}
        >
          <Zap size={14} />
          <span>{hasBoth ? 'Compare 2 Laps' : 'Launch Comparator'}</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
