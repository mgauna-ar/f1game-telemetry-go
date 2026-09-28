import { describe, expect, it } from 'vitest';
import { DEFAULT_STRIP_LAYOUT, STRIP_TRACE_IDS, moveStripTrace, normalizeStripLayout } from './stripTraces';

describe('normalizeStripLayout', () => {
  it('keeps a saved order and adds traces it does not know yet at the end', () => {
    const layout = normalizeStripLayout({ order: ['speed', 'delta', 'speed', 'bogus'], hidden: ['gear', 7] });
    expect(layout.order.slice(0, 3)).toEqual(['speed', 'delta', 'throttle']);
    expect(layout.order).toHaveLength(STRIP_TRACE_IDS.length);
    expect(layout.hidden).toEqual(['gear']);
  });

  it('falls back to the default for anything unreadable', () => {
    expect(normalizeStripLayout(null)).toEqual(DEFAULT_STRIP_LAYOUT);
    expect(normalizeStripLayout('x')).toEqual(DEFAULT_STRIP_LAYOUT);
  });
});

describe('moveStripTrace', () => {
  it('swaps a trace with its visible neighbour, skipping hidden ones', () => {
    const layout = { order: [...STRIP_TRACE_IDS], hidden: ['speed' as const] };
    const visible = layout.order.filter((id) => !layout.hidden.includes(id as 'speed'));
    const moved = moveStripTrace(layout, 'throttle', -1, visible);
    expect(moved.order.slice(0, 3)).toEqual(['throttle', 'speed', 'delta']);
    expect(moveStripTrace(layout, 'delta', -1, visible)).toBe(layout);
  });
});
