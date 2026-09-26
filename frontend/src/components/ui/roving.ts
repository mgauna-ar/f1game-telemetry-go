/**
 * Arrow-key movement inside a tab list or radio group: Left/Up and Right/Down step and wrap,
 * Home and End jump to the ends. Returns the index to move to, or null for other keys.
 * Disabled entries are skipped.
 */
export function nextRovingIndex(key: string, current: number, disabled: boolean[]): number | null {
  const count = disabled.length;
  if (count === 0) return null;
  const step = (from: number, delta: number): number => {
    let index = from;
    for (let i = 0; i < count; i++) {
      index = (index + delta + count) % count;
      if (!disabled[index]) return index;
    }
    return current;
  };
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return step(current, 1);
    case 'ArrowLeft':
    case 'ArrowUp':
      return step(current, -1);
    case 'Home':
      return step(-1, 1);
    case 'End':
      return step(count, -1);
    default:
      return null;
  }
}
