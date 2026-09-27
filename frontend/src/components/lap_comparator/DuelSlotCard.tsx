import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown, Clock, Search, User } from 'lucide-react';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { Badge } from '../ui/Badge';
import { formatTime, formatSectorTime } from '../../utils/formatters';
import { sortLapsByQuality } from '../../utils/lapUtils';
import { TEAM_COLORS, getTeamColor } from '../../constants/f1';
import { styleVars } from '../../styles/theme';
import { useI18n } from '../../context/I18nContext';
import type { Participant, Lap } from '../../types/session';
import styles from './DuelSlotCard.module.css';

export interface DuelSlot {
  driver?: Participant;
  laps: Lap[];
  participants: Participant[];
  lapId: number | '';
  setLapId: (id: number | '') => void;
}

interface DuelSlotCardProps {
  slot: 'A' | 'B';
  label: string;
  lap?: Lap;
  data: DuelSlot;
}

const TelemetryIcon: React.FC<{ lap: Lap; size: number }> = ({ lap, size }) => {
  const { t } = useI18n();
  const label = lap.has_telemetry ? t('comparator.charts.telemetryAvailable') : t('comparator.charts.timingOnly');
  const Icon = lap.has_telemetry ? Activity : Clock;
  return (
    <span className={styles.telemetry} data-telemetry={lap.has_telemetry || undefined} title={label}>
      <Icon size={size} aria-label={label} />
    </span>
  );
};

/** One side of the duel: the slot's driver and lap, each with a picker popover. */
export const DuelSlotCard: React.FC<DuelSlotCardProps> = ({ slot, label, lap, data }) => {
  const { t } = useI18n();
  const key = slot.toLowerCase();
  const [openPicker, setOpenPicker] = useState<'driver' | 'lap' | null>(null);
  const [driverSearch, setDriverSearch] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  // Close the popovers on an outside click or Escape
  useEffect(() => {
    if (!openPicker) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setOpenPicker(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPicker(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPicker]);

  const togglePicker = (picker: 'driver' | 'lap') => setOpenPicker((prev) => (prev === picker ? null : picker));

  const filteredParticipants = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    if (!q) return data.participants;
    return data.participants.filter((p) => p.name.toLowerCase().includes(q) || p.race_number.toString().includes(q));
  }, [data.participants, driverSearch]);

  // Completed laps of the slot's driver
  const driverLaps = useMemo(() => {
    if (!data.driver) return [];
    return data.laps.filter((l) => (l.car_index ?? -1) === data.driver?.car_index && l.lap_time_ms > 0);
  }, [data.laps, data.driver]);

  // Picking a driver loads their best valid lap
  const handleSelectDriver = (p: Participant) => {
    const candidateLaps = sortLapsByQuality(data.laps.filter((l) => (l.car_index ?? -1) === p.car_index));
    if (candidateLaps.length > 0) data.setLapId(candidateLaps[0].id);
    setOpenPicker(null);
  };

  const teamColor = data.driver ? TEAM_COLORS[data.driver.team_id] : undefined;

  return (
    <div ref={cardRef} className={styles.card} data-slot={key} data-testid={`duel-slot-${key}`}>
      <div className={styles.header}>
        <span className={styles.tag}>
          <span className={styles.dot} aria-hidden="true" />
          <span>{label}</span>
        </span>
        {lap?.max_speed_kmh && (
          <span className={styles.speed}>
            {Math.round(lap.max_speed_kmh)} {t('common.units.kmh')}
          </span>
        )}
      </div>

      <div className={styles.row}>
        <div className={styles.driverInfo}>
          <span className={styles.teamStripe} style={styleVars({ '--team-color': teamColor })} aria-hidden="true" />
          <button
            type="button"
            className={styles.chip}
            data-empty={data.driver ? undefined : true}
            aria-expanded={openPicker === 'driver'}
            onClick={() => togglePicker('driver')}
            title={data.driver ? t('comparator.duel.switchDriver') : undefined}
            data-testid={data.driver ? `slot-${key}-driver-trigger` : `slot-${key}-driver-trigger-empty`}
          >
            {data.driver ? (
              <>
                <span className={styles.driverNum}>#{data.driver.race_number}</span>
                <span className={styles.driverName}>{data.driver.name}</span>
              </>
            ) : (
              <>
                <User size={14} aria-hidden="true" />
                <span>{t('comparator.duel.selectDriver')}</span>
              </>
            )}
            <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className={`${styles.chip} ${styles.lapChip}`}
          data-empty={lap ? undefined : true}
          aria-expanded={openPicker === 'lap'}
          onClick={() => togglePicker('lap')}
          data-testid={lap ? `lap-${key}-trigger` : `slot-${key}-lap-trigger-empty`}
        >
          {lap ? (
            <>
              <span className={styles.lapNum}>L{lap.lap_number}</span>
              <span className={styles.lapTime}>{formatTime(lap.lap_time_ms)}</span>
              {lap.tyre_compound && <TyreCompoundBadge compound={lap.tyre_compound} />}
              <TelemetryIcon lap={lap} size={12} />
              {!lap.is_valid && (
                <Badge tone="danger" size="xs" square>
                  {t('comparator.invalid')}
                </Badge>
              )}
            </>
          ) : (
            <span>{t('comparator.duel.selectLap')}</span>
          )}
          <ChevronDown size={13} className={styles.chevron} aria-hidden="true" />
        </button>
      </div>

      {openPicker === 'driver' && (
        <div className={styles.popover} data-testid={`slot-${key}-driver-popover`}>
          <label className={styles.popoverSearch}>
            <Search size={13} aria-hidden="true" />
            <input
              type="text"
              aria-label={t('comparator.timingTower.searchDriver')}
              placeholder={t('comparator.timingTower.searchDriver')}
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              autoFocus
            />
          </label>
          <div className={styles.list}>
            {filteredParticipants.map((p) => {
              const bestLap = sortLapsByQuality(data.laps.filter((l) => (l.car_index ?? -1) === p.car_index))[0];
              return (
                <button
                  key={p.car_index}
                  type="button"
                  className={styles.item}
                  aria-pressed={data.driver?.car_index === p.car_index}
                  onClick={() => handleSelectDriver(p)}
                >
                  <span className={styles.itemSide}>
                    <span
                      className={styles.teamIndicator}
                      style={styleVars({ '--team-color': getTeamColor(p.team_id) })}
                      aria-hidden="true"
                    />
                    <span className={styles.muted}>#{p.race_number}</span>
                    <span>{p.name}</span>
                  </span>
                  {bestLap && (
                    <span className={styles.itemSide}>
                      <span className={styles.mono}>{formatTime(bestLap.lap_time_ms)}</span>
                      {bestLap.tyre_compound && <TyreCompoundBadge compound={bestLap.tyre_compound} />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {openPicker === 'lap' && (
        <div className={styles.popover} data-testid={`slot-${key}-lap-popover`}>
          <div className={styles.popoverHeader}>
            <span>
              {data.driver
                ? t('comparator.duel.driverLaps', { driver: data.driver.name })
                : t('comparator.duel.allLaps')}
            </span>
            <span>{t('comparator.duel.lapsCount', { count: driverLaps.length })}</span>
          </div>
          <div className={styles.list}>
            {driverLaps.map((l) => (
              <button
                key={l.id}
                type="button"
                className={styles.item}
                aria-pressed={data.lapId === l.id}
                onClick={() => {
                  data.setLapId(l.id);
                  setOpenPicker(null);
                }}
              >
                <span className={styles.itemSide}>
                  <span className={styles.muted}>{t('comparator.duel.lapNumber', { lap: l.lap_number })}</span>
                  <span className={styles.mono}>{formatTime(l.lap_time_ms)}</span>
                  {l.tyre_compound && <TyreCompoundBadge compound={l.tyre_compound} />}
                </span>
                <span className={styles.itemSide}>
                  {l.sector1_ms && l.sector2_ms && l.sector3_ms ? (
                    <span className={styles.sectors}>
                      <span>S1: {formatSectorTime(l.sector1_ms)}</span>
                      <span>S2: {formatSectorTime(l.sector2_ms)}</span>
                      <span>S3: {formatSectorTime(l.sector3_ms)}</span>
                    </span>
                  ) : null}
                  <TelemetryIcon lap={l} size={10} />
                  {!l.is_valid && (
                    <Badge tone="danger" size="xs" square>
                      {t('comparator.invalid')}
                    </Badge>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
