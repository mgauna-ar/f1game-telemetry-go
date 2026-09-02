import React from 'react';
import { Activity, Clock } from 'lucide-react';
import type { Participant, Lap } from '../../types/session';
import type { QuickSelectDriver } from './QuickSelectLeaderboard';
import { TEAM_COLORS } from '../../constants/f1';
import { formatTime, getRankBadgeStyle } from '../../utils/formatters';
import { sortLapsByQuality } from '../../utils/lapUtils';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { useI18n } from '../../context/I18nContext';

export interface DriverGridCardProps {
  driver: QuickSelectDriver;
  index: number;
  leaderLapTimeMs: number | null;
  lapAId: number | '';
  lapBId: number | '';
  lapsA: Lap[];
  lapsB: Lap[];
  onSetLapA: (id: number) => void;
  onSetLapB: (id: number) => void;
  isLinkedSessions: boolean;
  sessionAId: number | '';
  sessionBId: number | '';
  participantsA: Participant[];
}

export const DriverGridCard: React.FC<DriverGridCardProps> = ({
  driver: p,
  index: idx,
  leaderLapTimeMs,
  lapAId,
  lapBId,
  lapsA,
  lapsB,
  onSetLapA,
  onSetLapB,
  isLinkedSessions,
  sessionAId,
  sessionBId,
  participantsA,
}) => {
  const { t } = useI18n();
  const teamColor = TEAM_COLORS[p.team_id] || '#A0A0A0';
  const rankStyle = getRankBadgeStyle(idx + 1);
  const isAssignedA = Boolean(lapAId && p.bestLap && lapAId === p.bestLap.id);
  const isAssignedB = Boolean(lapBId && p.bestLap && lapBId === p.bestLap.id);
  const isParticipantInA = participantsA.some((pa) => pa.car_index === p.car_index);
  const slotData = isAssignedA ? 'a' : isAssignedB ? 'b' : 'none';

  return (
    <div
      className="quick-select-card"
      data-slot={slotData}
      data-testid={`quick-select-card-${p.car_index}`}
    >
      {/* Top Row: Rank, Team Pill, Driver Name & Assignment Badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '3px',
              background: rankStyle.bg,
              color: rankStyle.color,
              border: rankStyle.border,
              flexShrink: 0,
            }}
            data-testid={`rank-badge-${idx + 1}`}
          >
            P{idx + 1}
          </span>
          <span style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: teamColor, flexShrink: 0 }} />
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={`#${p.race_number} ${p.name}`}
          >
            #{p.race_number} {p.name}
          </span>
          {p.bestLap?.tyre_compound && (
            <span style={{ flexShrink: 0 }}><TyreCompoundBadge compound={p.bestLap.tyre_compound} /></span>
          )}
          {p.bestLap && (
            p.bestLap.has_telemetry ? (
              <span
                style={{
                  fontSize: '0.60rem',
                  fontWeight: 700,
                  background: 'rgba(0, 210, 211, 0.12)',
                  color: '#00d2d3',
                  border: '1px solid rgba(0, 210, 211, 0.3)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  flexShrink: 0,
                }}
                title={t('comparator.quickSelect.telemetryBadge')}
              >
                <Activity size={9} /> {t('comparator.quickSelect.telemetryBadge')}
              </span>
            ) : (
              <span
                style={{
                  fontSize: '0.60rem',
                  fontWeight: 600,
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  flexShrink: 0,
                }}
                title={t('comparator.charts.noTelemetryWarning')}
              >
                <Clock size={9} /> {t('comparator.quickSelect.timingOnlyBadge')}
              </span>
            )
          )}
        </div>

        {/* Session slot badge if cross-session */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
          {!isLinkedSessions && sessionAId !== sessionBId && p.sessionSlot && (
            <span
              className={`session-badge ${p.sessionSlot === 'A' ? 'badge-red' : 'badge-cyan'}`}
              style={{ fontSize: '0.62rem', padding: '1px 5px' }}
            >
              Slot {p.sessionSlot}
            </span>
          )}
          {isAssignedA && (
            <span
              style={{
                fontSize: '0.62rem',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'rgba(255, 71, 87, 0.25)',
                color: '#ff4757',
                fontWeight: 700,
                border: '1px solid #ff4757',
              }}
              data-testid="driver-assigned-a-badge"
            >
              Slot A
            </span>
          )}
          {isAssignedB && (
            <span
              style={{
                fontSize: '0.62rem',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'rgba(0, 210, 211, 0.25)',
                color: '#00d2d3',
                fontWeight: 700,
                border: '1px solid #00d2d3',
              }}
              data-testid="driver-assigned-b-badge"
            >
              Slot B
            </span>
          )}
        </div>
      </div>

      {/* Middle Row: Lap Time & Leader Delta & Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', minWidth: 0 }}>
          {p.bestLap ? (
            <>
              <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>
                {formatTime(p.bestLap.lap_time_ms)}
              </span>
              {leaderLapTimeMs && p.bestLap.lap_time_ms === leaderLapTimeMs ? (
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: '#ffd700',
                    background: 'rgba(255, 215, 0, 0.12)',
                    padding: '1px 4px',
                    borderRadius: '3px',
                  }}
                >
                  LEADER
                </span>
              ) : leaderLapTimeMs && p.bestLap.lap_time_ms > leaderLapTimeMs ? (
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  +{((p.bestLap.lap_time_ms - leaderLapTimeMs) / 1000).toFixed(3)}s
                </span>
              ) : null}
            </>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No valid lap</span>
          )}
        </div>

        {/* Quick Set Actions */}
        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
          {(isLinkedSessions || isParticipantInA || p.sessionSlot === 'A') && (
            <button
              type="button"
              onClick={() => {
                const driverLaps = sortLapsByQuality(lapsA.filter((l) => (l.car_index ?? -1) === p.car_index));
                if (driverLaps.length > 0) onSetLapA(driverLaps[0].id);
              }}
              style={{
                background: isAssignedA ? 'rgba(255, 71, 87, 0.3)' : 'rgba(255, 71, 87, 0.15)',
                border: '1px solid rgba(255, 71, 87, 0.6)',
                color: '#ff4757',
                borderRadius: '4px',
                padding: '0.15rem 0.45rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 700,
              }}
              title={`Set Lap A to ${p.name}'s fastest lap`}
              data-testid={`quick-set-a-${p.car_index}`}
            >
              Set A
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const driverLaps = sortLapsByQuality(lapsB.filter((l) => (l.car_index ?? -1) === p.car_index));
              if (driverLaps.length > 0) onSetLapB(driverLaps[0].id);
            }}
            style={{
              background: isAssignedB ? 'rgba(0, 210, 211, 0.3)' : 'rgba(0, 210, 211, 0.15)',
              border: '1px solid rgba(0, 210, 211, 0.6)',
              color: '#00d2d3',
              borderRadius: '4px',
              padding: '0.15rem 0.45rem',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontWeight: 700,
            }}
            title={`Set Lap B to ${p.name}'s fastest lap`}
            data-testid={`quick-set-b-${p.car_index}`}
          >
            Set B
          </button>
        </div>
      </div>

      {/* Bottom Row: Sector Timings */}
      {p.bestLap && Boolean(p.bestLap.sector1_ms || p.bestLap.sector2_ms || p.bestLap.sector3_ms) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {p.bestLap.sector1_ms ? (
            <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1px 4px', borderRadius: '3px' }}>
              S1: {(p.bestLap.sector1_ms / 1000).toFixed(3)}
            </span>
          ) : null}
          {p.bestLap.sector2_ms ? (
            <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1px 4px', borderRadius: '3px' }}>
              S2: {(p.bestLap.sector2_ms / 1000).toFixed(3)}
            </span>
          ) : null}
          {p.bestLap.sector3_ms ? (
            <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1px 4px', borderRadius: '3px' }}>
              S3: {(p.bestLap.sector3_ms / 1000).toFixed(3)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};
