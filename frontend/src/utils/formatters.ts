import { TIME_CONSTANTS } from '../constants/f1';

/**
 * Formats milliseconds into lap time string "M:SS.mmm" or "--:--.---" if invalid.
 */
export function formatLapTime(ms?: number): string {
  if (!ms || ms <= 0) return '--:--.---';
  const mins = Math.floor(ms / TIME_CONSTANTS.MS_PER_MINUTE);
  const secs = Math.floor((ms % TIME_CONSTANTS.MS_PER_MINUTE) / TIME_CONSTANTS.MS_PER_SECOND);
  const millis = Math.floor(ms % TIME_CONSTANTS.MS_PER_SECOND);
  return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

/**
 * Synonym for formatLapTime for lap and timer components.
 */
export const formatTime = formatLapTime;

/**
 * Formats milliseconds into sector time string "SS.mmm s" or "-" / "--.---" if invalid.
 */
export function formatSectorTime(ms?: number, includeUnit = true): string {
  if (!ms || ms <= 0) return includeUnit ? '-' : '--.---';
  const val = (ms / TIME_CONSTANTS.MS_PER_SECOND).toFixed(3);
  return includeUnit ? `${val}s` : val;
}

/** A gap between two cars: "1.234" under a minute, "1:02.345" above. The unit is left to the label. */
export function formatGap(ms: number): string {
  return ms >= TIME_CONSTANTS.MS_PER_MINUTE ? formatLapTime(ms) : (ms / TIME_CONSTANTS.MS_PER_SECOND).toFixed(3);
}

/** A signed time difference in seconds: "+0.236", "−0.120" (a real minus sign), "±0.000". */
export function formatSignedDelta(ms: number): string {
  return `${ms > 0 ? '+' : ms < 0 ? '−' : '±'}${(Math.abs(ms) / TIME_CONSTANTS.MS_PER_SECOND).toFixed(3)}`;
}

/**
 * Formats total race / session duration time (H:MM:SS or M:SS).
 */
export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '--:--';
  const hours = Math.floor(ms / TIME_CONSTANTS.MS_PER_HOUR);
  const mins = Math.floor((ms % TIME_CONSTANTS.MS_PER_HOUR) / TIME_CONSTANTS.MS_PER_MINUTE);
  const secs = Math.floor((ms % TIME_CONSTANTS.MS_PER_MINUTE) / TIME_CONSTANTS.MS_PER_SECOND);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats total race duration into H:MM:SS.mmm or M:SS.mmm format.
 */
export function formatTotalDuration(ms?: number): string {
  if (!ms || ms <= 0) return '--:--.---';
  const hrs = Math.floor(ms / TIME_CONSTANTS.MS_PER_HOUR);
  const mins = Math.floor((ms % TIME_CONSTANTS.MS_PER_HOUR) / TIME_CONSTANTS.MS_PER_MINUTE);
  const secs = Math.floor((ms % TIME_CONSTANTS.MS_PER_MINUTE) / TIME_CONSTANTS.MS_PER_SECOND);
  const millis = Math.floor(ms % TIME_CONSTANTS.MS_PER_SECOND);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

/**
 * The badge tone for a session type: sprint orange, race red, qualifying purple, practice green.
 */
export function getSessionTone(typeStr?: string | null): 'orange' | 'danger' | 'purple' | 'success' | 'neutral' {
  if (!typeStr) return 'neutral';
  const lower = typeStr.toLowerCase();
  if (lower.includes('sprint')) return 'orange';
  if (lower.includes('race')) return 'danger';
  if (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) return 'purple';
  if (lower.includes('practice') || lower.includes('fp')) return 'success';
  return 'neutral';
}

/**
 * Formats a raw session UID (string, decimal number, signed/negative int64, or Hex)
 * into a clean 16-character uppercase Hex string e.g. "0x48D7F9B1E038C41A".
 */
export function formatSessionUID(uid?: string | number | null): string {
  if (!uid && uid !== 0) return '0x0000000000000000';
  if (typeof uid === 'string') {
    const trimmed = uid.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      return `0x${trimmed.slice(2).toUpperCase()}`;
    }
    try {
      const big = BigInt.asUintN(64, BigInt(trimmed));
      return `0x${big.toString(16).toUpperCase().padStart(16, '0')}`;
    } catch {
      return trimmed;
    }
  }
  try {
    const big = BigInt.asUintN(64, BigInt(Math.trunc(uid)));
    return `0x${big.toString(16).toUpperCase().padStart(16, '0')}`;
  } catch {
    return String(uid);
  }
}
