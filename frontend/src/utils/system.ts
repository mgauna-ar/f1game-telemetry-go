/**
 * Detects the client platform operating system from user agent and platform navigator info.
 */
export function detectUserOS(): 'macos' | 'windows' | 'linux' | 'other' {
  if (typeof window === 'undefined' || !window.navigator) return 'other';
  const ua = (window.navigator.userAgent || '').toLowerCase();
  const platform = (window.navigator.platform || '').toLowerCase();
  if (ua.includes('mac') || ua.includes('darwin') || platform.includes('mac')) return 'macos';
  if (ua.includes('win') || platform.includes('win')) return 'windows';
  if (ua.includes('linux') || ua.includes('x11') || platform.includes('linux')) return 'linux';
  return 'other';
}
