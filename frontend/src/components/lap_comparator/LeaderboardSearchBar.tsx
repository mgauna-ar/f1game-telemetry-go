import React from 'react';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';

export interface LeaderboardSearchBarProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  isLinkedSessions: boolean;
  sessionAId: number | '';
  sessionBId: number | '';
  quickSelectSessionTab: 'ALL' | 'A' | 'B';
  onQuickSelectSessionTabChange: (tab: 'ALL' | 'A' | 'B') => void;
  driverSearchQuery: string;
  onDriverSearchChange: (q: string) => void;
}

export const LeaderboardSearchBar: React.FC<LeaderboardSearchBarProps> = ({
  isOpen,
  onToggleOpen,
  isLinkedSessions,
  sessionAId,
  sessionBId,
  quickSelectSessionTab,
  onQuickSelectSessionTabChange,
  driverSearchQuery,
  onDriverSearchChange,
}) => {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Session Tabs when in Cross-Session Mode */}
      {!isLinkedSessions && sessionAId !== sessionBId && isOpen && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.35)',
            padding: '2px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          data-testid="quick-select-session-tabs"
        >
          <button
            type="button"
            onClick={() => onQuickSelectSessionTabChange('ALL')}
            style={{
              background: quickSelectSessionTab === 'ALL' ? 'rgba(255,255,255,0.15)' : 'transparent',
              border: 'none',
              color: quickSelectSessionTab === 'ALL' ? '#fff' : 'var(--text-muted)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            data-testid="quick-tab-all"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onQuickSelectSessionTabChange('A')}
            style={{
              background: quickSelectSessionTab === 'A' ? 'rgba(255, 71, 87, 0.2)' : 'transparent',
              border: 'none',
              color: quickSelectSessionTab === 'A' ? '#ff4757' : 'var(--text-muted)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            data-testid="quick-tab-a"
          >
            Session A
          </button>
          <button
            type="button"
            onClick={() => onQuickSelectSessionTabChange('B')}
            style={{
              background: quickSelectSessionTab === 'B' ? 'rgba(0, 210, 211, 0.2)' : 'transparent',
              border: 'none',
              color: quickSelectSessionTab === 'B' ? '#00d2d3' : 'var(--text-muted)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            data-testid="quick-tab-b"
          >
            Session B
          </button>
        </div>
      )}

      {/* Driver Search Box */}
      {isOpen && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={12}
            style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)', pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="Filter drivers..."
            value={driverSearchQuery}
            onChange={(e) => onDriverSearchChange(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              padding: '0.25rem 1.6rem 0.25rem 1.6rem',
              fontSize: '0.75rem',
              color: '#fff',
              width: '130px',
              outline: 'none',
            }}
            data-testid="driver-quick-search-input"
          />
          {driverSearchQuery && (
            <button
              type="button"
              onClick={() => onDriverSearchChange('')}
              style={{
                position: 'absolute',
                right: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                padding: 0,
              }}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Expand / Collapse Button */}
      <button
        type="button"
        onClick={onToggleOpen}
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'var(--text-secondary)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: '0.75rem',
        }}
        title={isOpen ? 'Collapse Quick Select panel' : 'Expand Quick Select panel'}
        data-testid="quick-select-collapse-btn"
      >
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span>{isOpen ? 'Collapse' : 'Expand'}</span>
      </button>
    </div>
  );
};
