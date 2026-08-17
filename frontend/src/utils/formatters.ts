/**
 * Formats milliseconds into lap time string "M:SS.mmm" or "--:--.---" if invalid.
 */
export function formatLapTime(ms?: number): string {
  if (!ms || ms <= 0) return '--:--.---';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

/**
 * Synonym for formatLapTime for lap and timer components.
 */
export const formatTime = formatLapTime;

/**
 * Formats milliseconds into sector time string "SS.mmm s" or "-" if invalid.
 */
export function formatSectorTime(ms?: number): string {
  if (!ms || ms <= 0) return '-';
  return `${(ms / 1000).toFixed(3)}s`;
}

/**
 * Formats delta/gap milliseconds into "+S.mmm s" or "+M:SS.mmm" format.
 */
export function formatGapTime(gapMs?: number): string {
  if (gapMs === undefined || gapMs === null || gapMs <= 0) return 'LEADER';
  if (gapMs >= 60000) {
    const mins = Math.floor(gapMs / 60000);
    const secs = ((gapMs % 60000) / 1000).toFixed(3);
    return `+${mins}:${secs.padStart(6, '0')}`;
  }
  return `+${(gapMs / 1000).toFixed(3)}s`;
}

/**
 * Formats total race / session duration time (H:MM:SS or M:SS).
 */
export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '--:--';
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Style descriptor for leaderboard or podium rank badges (P1, P2, P3, etc.).
 */
export function getRankBadgeStyle(rank: number) {
  if (rank === 1) {
    return {
      bg: 'rgba(255, 215, 0, 0.18)',
      color: '#ffd700',
      border: '1px solid rgba(255, 215, 0, 0.5)',
      label: 'P1',
    };
  }
  if (rank === 2) {
    return {
      bg: 'rgba(224, 224, 224, 0.18)',
      color: '#e0e0e0',
      border: '1px solid rgba(224, 224, 224, 0.45)',
      label: 'P2',
    };
  }
  if (rank === 3) {
    return {
      bg: 'rgba(205, 127, 50, 0.2)',
      color: '#cd7f32',
      border: '1px solid rgba(205, 127, 50, 0.45)',
      label: 'P3',
    };
  }
  return {
    bg: 'rgba(255, 255, 255, 0.07)',
    color: 'var(--text-secondary)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    label: `P${rank}`,
  };
}

/**
 * Returns CSS badge class based on session type string.
 */
export function getSessionBadgeClass(typeStr?: string): string {
  if (!typeStr) return 'badge-gray';
  const lower = typeStr.toLowerCase();
  if (lower.includes('sprint')) return 'badge-orange';
  if (lower.includes('race')) return 'badge-red';
  if (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) return 'badge-purple';
  if (lower.includes('practice') || lower.includes('fp')) return 'badge-green';
  return 'badge-gray';
}
