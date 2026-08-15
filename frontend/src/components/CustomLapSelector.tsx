import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronUp, Check, Award, Star, AlertTriangle, Filter } from 'lucide-react';

export interface Lap {
  id: number;
  session_id: number;
  car_index?: number;
  lap_number: number;
  lap_time_ms: number;
  sector1_ms?: number;
  sector2_ms?: number;
  sector3_ms?: number;
  is_valid: boolean;
  tyre_compound?: string;
  fuel_load?: number;
  max_speed_kmh?: number;
}

export interface Participant {
  id: number;
  session_id: number;
  car_index: number;
  name: string;
  driver_id: number;
  team_id: number;
  race_number: number;
  ai_controlled: boolean;
  nationality: number;
}

interface CustomLapSelectorProps {
  laps: Lap[];
  participants: Participant[];
  selectedLapId: number | '';
  onSelectLap: (lapId: number) => void;
  slot: 'A' | 'B';
  disabled?: boolean;
  placeholder?: string;
}

// Format milliseconds to M:SS.ms
function formatTime(ms?: number) {
  if (!ms || ms <= 0) return '--:--.---';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const m = ms % 1000;
  return `${mins}:${secs.toString().padStart(2, '0')}.${m.toString().padStart(3, '0')}`;
}

// Format sector milliseconds to SS.ms
function formatSector(ms?: number) {
  if (!ms || ms <= 0) return '-';
  return `${(ms / 1000).toFixed(3)}s`;
}

// Render Tyre Compound Badge
export const renderTyreCompoundBadge = (compoundRaw?: string) => {
  if (!compoundRaw) return null;
  const str = compoundRaw.toUpperCase().trim();

  let label = str.charAt(0);
  let color = '#FFFFFF';
  let bg = 'rgba(255, 255, 255, 0.15)';

  if (str === '16' || str.includes('SOFT') || str === 'S') {
    label = 'S';
    color = '#ff4757';
    bg = 'rgba(255, 71, 87, 0.2)';
  } else if (str === '17' || str.includes('MED') || str === 'M') {
    label = 'M';
    color = '#ffd200';
    bg = 'rgba(255, 210, 0, 0.2)';
  } else if (str === '18' || str.includes('HARD') || str === 'H') {
    label = 'H';
    color = '#FFFFFF';
    bg = 'rgba(255, 255, 255, 0.2)';
  } else if (str === '7' || str.includes('INTER') || str === 'I') {
    label = 'I';
    color = '#2ed573';
    bg = 'rgba(46, 213, 115, 0.2)';
  } else if (str === '8' || str.includes('WET') || str === 'W') {
    label = 'W';
    color = '#1e90ff';
    bg = 'rgba(30, 144, 255, 0.2)';
  }

  return (
    <span
      className="tyre-badge-mini"
      style={{ color, backgroundColor: bg, borderColor: color }}
      title={`Tyre Compound: ${compoundRaw}`}
    >
      {label}
    </span>
  );
};

export const CustomLapSelector: React.FC<CustomLapSelectorProps> = ({
  laps,
  participants,
  selectedLapId,
  onSelectLap,
  slot,
  disabled = false,
  placeholder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverCarIndex, setSelectedDriverCarIndex] = useState<number | 'ALL'>('ALL');
  const [validOnly, setValidOnly] = useState(false);
  const [sortMode, setSortMode] = useState<'fastest' | 'lap_num'>('fastest');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Selected lap object & driver
  const selectedLap = useMemo(() => laps.find((l) => l.id === selectedLapId), [laps, selectedLapId]);
  const selectedDriver = useMemo(() => {
    if (selectedLap?.car_index !== undefined) {
      return participants.find((p) => p.car_index === selectedLap.car_index);
    }
    return undefined;
  }, [selectedLap, participants]);

  // Session Best Lap (overall fastest valid completed lap)
  const sessionBestLap = useMemo(() => {
    const validLaps = laps.filter((l) => l.is_valid && l.lap_time_ms > 0 && (l.sector3_ms ?? 0) > 0);
    if (validLaps.length === 0) return null;
    return validLaps.reduce((prev, curr) => (curr.lap_time_ms < prev.lap_time_ms ? curr : prev), validLaps[0]);
  }, [laps]);

  // Map of driver car_index -> personal best lap ID
  const driverPbMap = useMemo(() => {
    const map = new Map<number, number>();
    participants.forEach((p) => {
      const driverValidLaps = laps
        .filter((l) => (l.car_index ?? -1) === p.car_index && l.is_valid && l.lap_time_ms > 0 && (l.sector3_ms ?? 0) > 0)
        .sort((a, b) => a.lap_time_ms - b.lap_time_ms);
      if (driverValidLaps.length > 0) {
        map.set(p.car_index, driverValidLaps[0].id);
      }
    });
    return map;
  }, [participants, laps]);

  // Drivers who have at least one recorded lap
  const driversWithLaps = useMemo(() => {
    const carIndices = Array.from(new Set(laps.map((l) => l.car_index ?? -1)));
    return carIndices.map((idx) => {
      const p = participants.find((part) => part.car_index === idx);
      const count = laps.filter((l) => (l.car_index ?? -1) === idx).length;
      return {
        car_index: idx,
        name: p ? p.name : `Car ${idx}`,
        race_number: p?.race_number,
        lapCount: count,
      };
    });
  }, [participants, laps]);

  // Filtered and sorted laps for the popover list
  const filteredLaps = useMemo(() => {
    return laps
      .filter((l) => {
        // Valid only filter (must be valid and completed)
        if (validOnly && (!l.is_valid || l.lap_time_ms <= 0 || (l.sector3_ms ?? 0) <= 0)) {
          return false;
        }

        // Driver tab filter
        if (selectedDriverCarIndex !== 'ALL') {
          if ((l.car_index ?? -1) !== selectedDriverCarIndex) return false;
        }

        // Search query filter (driver name, race number, lap number, time)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const p = participants.find((part) => part.car_index === l.car_index);
          const driverName = p?.name.toLowerCase() || '';
          const raceNum = p?.race_number?.toString() || '';
          const lapNumStr = `lap ${l.lap_number}`;
          const formatted = formatTime(l.lap_time_ms).toLowerCase();

          const matches =
            driverName.includes(q) ||
            raceNum.includes(q) ||
            lapNumStr.includes(q) ||
            l.lap_number.toString() === q ||
            formatted.includes(q);

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortMode === 'fastest') {
          // Completed valid laps first by time, then incomplete/invalid laps
          const aValid = a.is_valid && a.lap_time_ms > 0 && (a.sector3_ms ?? 0) > 0;
          const bValid = b.is_valid && b.lap_time_ms > 0 && (b.sector3_ms ?? 0) > 0;
          if (aValid && bValid) return a.lap_time_ms - b.lap_time_ms;
          if (aValid) return -1;
          if (bValid) return 1;
          return a.lap_number - b.lap_number;
        }
        // Chronological order
        return a.lap_number - b.lap_number;
      });
  }, [laps, validOnly, selectedDriverCarIndex, searchQuery, participants, sortMode]);


  const slotColor = slot === 'A' ? '#ff4757' : '#00d2d3';
  const defaultPlaceholder = placeholder || `Select Lap ${slot}...`;

  return (
    <div
      ref={dropdownRef}
      className={`custom-lap-dropdown ${isOpen ? 'is-open' : ''} slot-${slot.toLowerCase()}`}
      style={{ position: 'relative', zIndex: isOpen ? 100 : 1 }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className={`custom-lap-trigger slot-${slot.toLowerCase()} ${isOpen ? 'is-open' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled || laps.length === 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-testid={`lap-${slot.toLowerCase()}-trigger`}
      >
        {selectedLap ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', width: '100%' }}>
            <span style={{ color: slotColor, fontWeight: 700, fontSize: '0.9rem' }}>●</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                {selectedDriver ? `#${selectedDriver.race_number} ${selectedDriver.name}` : `Car ${selectedLap.car_index ?? '?'}`}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>•</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Lap {selectedLap.lap_number}</span>
              {renderTyreCompoundBadge(selectedLap.tyre_compound)}
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: slotColor, fontSize: '0.84rem' }}>
                {formatTime(selectedLap.lap_time_ms)}
              </span>
              {!selectedLap.is_valid && (
                <span style={{ fontSize: '0.65rem', background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', padding: '1px 4px', borderRadius: '3px' }}>
                  Invalid
                </span>
              )}
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {laps.length === 0 ? 'No laps recorded' : defaultPlaceholder}
          </span>
        )}

        {isOpen ? (
          <ChevronUp size={15} color="var(--text-secondary)" style={{ flexShrink: 0, marginLeft: '0.35rem' }} />
        ) : (
          <ChevronDown size={15} color="var(--text-secondary)" style={{ flexShrink: 0, marginLeft: '0.35rem' }} />
        )}
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div ref={popoverRef} className={`custom-lap-popover slot-${slot.toLowerCase()}`} role="listbox">
          {/* Search Bar */}
          <div className="custom-lap-search-wrapper">
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              className="custom-lap-search-input"
              placeholder="Search driver, lap #, time..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="custom-session-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Driver Filter Tabs (if more than 1 driver) */}
          {driversWithLaps.length > 1 && (
            <div className="custom-lap-driver-tabs">
              <button
                type="button"
                className={`custom-lap-driver-tab ${selectedDriverCarIndex === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedDriverCarIndex('ALL')}
              >
                All Drivers ({laps.length})
              </button>
              {driversWithLaps.map((d) => (
                <button
                  key={d.car_index}
                  type="button"
                  className={`custom-lap-driver-tab ${selectedDriverCarIndex === d.car_index ? 'active' : ''}`}
                  onClick={() => setSelectedDriverCarIndex(d.car_index)}
                >
                  {d.race_number !== undefined ? `#${d.race_number} ` : ''}{d.name} ({d.lapCount})
                </button>
              ))}
            </div>
          )}

          {/* Quick Toolbar (Valid only toggle & sort mode) */}
          <div className="custom-lap-toolbar">
            <button
              type="button"
              onClick={() => setValidOnly((prev) => !prev)}
              style={{
                background: validOnly ? (slot === 'A' ? 'rgba(255, 71, 87, 0.15)' : 'rgba(0, 210, 211, 0.15)') : 'transparent',
                border: validOnly ? (slot === 'A' ? '1px solid #ff4757' : '1px solid #00d2d3') : '1px solid rgba(255,255,255,0.1)',
                color: validOnly ? slotColor : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.68rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Filter size={10} /> Valid Only
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Sort:</span>
              <button
                type="button"
                onClick={() => setSortMode('fastest')}
                style={{
                  background: sortMode === 'fastest' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  border: 'none',
                  color: sortMode === 'fastest' ? '#fff' : 'var(--text-muted)',
                  borderRadius: '3px',
                  padding: '1px 5px',
                  fontSize: '0.68rem',
                  fontWeight: sortMode === 'fastest' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                Fastest
              </button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>|</span>
              <button
                type="button"
                onClick={() => setSortMode('lap_num')}
                style={{
                  background: sortMode === 'lap_num' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  border: 'none',
                  color: sortMode === 'lap_num' ? '#fff' : 'var(--text-muted)',
                  borderRadius: '3px',
                  padding: '1px 5px',
                  fontSize: '0.68rem',
                  fontWeight: sortMode === 'lap_num' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                Lap #
              </button>
            </div>
          </div>

          {/* Scrollable Lap List */}
          <div className="custom-lap-list">
            {filteredLaps.length > 0 ? (
              filteredLaps.map((lap) => {
                const isSelected = lap.id === selectedLapId;
                const p = participants.find((part) => part.car_index === lap.car_index);
                const isCompleted = lap.is_valid && lap.lap_time_ms > 0 && Boolean(lap.sector3_ms && lap.sector3_ms > 0);
                const isSessionBest = isCompleted && sessionBestLap && lap.id === sessionBestLap.id;
                const isDriverPb = isCompleted && (lap.car_index !== undefined && driverPbMap.get(lap.car_index) === lap.id) && !isSessionBest;

                const deltaToBest = isCompleted && sessionBestLap
                  ? (lap.lap_time_ms - sessionBestLap.lap_time_ms) / 1000
                  : null;

                return (
                  <div
                    key={lap.id}
                    className={`custom-lap-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectLap(lap.id);
                      setIsOpen(false);
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {/* Top Row: Driver Name + Lap # + Badges */}
                    <div className="custom-lap-item-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                          {p ? `#${p.race_number} ${p.name}` : `Car ${lap.car_index ?? '?'}`}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>•</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', fontWeight: 600 }}>
                          Lap {lap.lap_number}
                        </span>
                        {renderTyreCompoundBadge(lap.tyre_compound)}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                        {isSessionBest && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              background: 'rgba(255, 215, 0, 0.2)',
                              color: '#ffd700',
                              border: '1px solid rgba(255, 215, 0, 0.4)',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <Award size={10} /> Best
                          </span>
                        )}
                        {isDriverPb && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              background: 'rgba(0, 210, 211, 0.15)',
                              color: '#00d2d3',
                              border: '1px solid rgba(0, 210, 211, 0.35)',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <Star size={10} /> PB
                          </span>
                        )}
                        {!lap.is_valid ? (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              background: 'rgba(255, 71, 87, 0.15)',
                              color: '#ff4757',
                              border: '1px solid rgba(255, 71, 87, 0.35)',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <AlertTriangle size={10} /> Invalid
                          </span>
                        ) : !isCompleted ? (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              background: 'rgba(243, 156, 18, 0.15)',
                              color: '#f39c12',
                              border: '1px solid rgba(243, 156, 18, 0.35)',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            Incomplete
                          </span>
                        ) : null}
                        {isSelected && <Check size={14} color={slotColor} />}
                      </div>
                    </div>

                    {/* Middle Row: Lap Time & Speed */}
                    <div className="custom-lap-item-middle">
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: isSelected ? slotColor : (!isCompleted ? 'var(--text-muted)' : '#fff'),
                          }}
                        >
                          {isCompleted ? formatTime(lap.lap_time_ms) : '--:--.---'}
                        </span>
                        {isCompleted && deltaToBest !== null && deltaToBest > 0 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            +{deltaToBest.toFixed(3)}s
                          </span>
                        )}
                        {isCompleted && deltaToBest === 0 && (
                          <span style={{ fontSize: '0.7rem', color: '#ffd700', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            Fastest Lap
                          </span>
                        )}
                      </div>

                      {lap.max_speed_kmh && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
                          {Math.round(lap.max_speed_kmh)} km/h
                        </span>
                      )}
                    </div>


                    {/* Bottom Row: Sector Breakdown */}
                    {(lap.sector1_ms || lap.sector2_ms || lap.sector3_ms) && (
                      <div className="custom-lap-item-bottom">
                        <span>S1: <strong style={{ color: '#f39c12' }}>{formatSector(lap.sector1_ms)}</strong></span>
                        <span>•</span>
                        <span>S2: <strong style={{ color: '#9b59b6' }}>{formatSector(lap.sector2_ms)}</strong></span>
                        <span>•</span>
                        <span>S3: <strong style={{ color: '#00d2d3' }}>{formatSector(lap.sector3_ms)}</strong></span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                No laps match your filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
