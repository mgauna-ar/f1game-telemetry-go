/**
 * TypeScript side of the design tokens in styles/base/variables.css.
 *
 * - Inline styles and SVG attributes (Recharts) take `cssVar(token)`; the browser
 *   resolves it, so the colour always follows the stylesheet.
 * - Canvas can't resolve var(), so canvas code reads the value with `getCssVar(token)`.
 * - `alpha(color, amount)` tints any colour (a token or a hex value) with color-mix().
 */

/** Every token TypeScript reads; theme.test.ts checks that variables.css defines each one. */
export const THEME_TOKENS = [
  '--accent-primary',
  '--accent-secondary',
  '--accent-tertiary',
  '--accent-purple',
  '--accent-cyan',
  '--bg-tooltip',
  '--bg-inset',
  '--bg-hover',
  '--bg-active',
  '--text-primary',
  '--text-body',
  '--text-secondary',
  '--text-muted',
  '--text-on-accent',
  '--border-color',
  '--border-subtle',
  '--border-highlight',
  '--status-success',
  '--status-warning',
  '--status-danger',
  '--status-info',
  '--f1-slot-a',
  '--f1-slot-b',
  '--f1-sector-1',
  '--f1-sector-2',
  '--f1-sector-3',
  '--f1-purple',
  '--f1-green',
  '--f1-yellow',
  '--f1-compound-soft',
  '--f1-compound-medium',
  '--f1-compound-hard',
  '--f1-compound-inter',
  '--f1-compound-wet',
  '--f1-compound-unknown',
  '--f1-compound-soft-bg',
  '--f1-compound-medium-bg',
  '--f1-compound-hard-bg',
  '--f1-compound-inter-bg',
  '--f1-compound-wet-bg',
  '--f1-gold',
  '--f1-team-fallback',
  '--weather-sun',
  '--weather-cloud-light',
  '--weather-cloud',
  '--weather-rain',
  '--weather-rain-heavy',
  '--weather-storm',
  '--weather-warm',
  '--weather-cool',
  '--chart-axis',
  '--chart-tick',
  '--chart-grid',
  '--chart-cursor',
  '--chart-throttle',
  '--chart-brake',
  '--chart-ers',
  '--chart-ers-mode',
  '--chart-aero',
  '--chart-delta',
  '--chart-boost-a',
  '--chart-boost-b',
  '--chart-track',
  '--chart-track-casing',
  '--chart-marker-ring',
  '--chart-marker-outline',
  '--radius-xs',
  '--radius-sm',
  '--shadow-md',
  '--shadow-panel',
  '--z-raised',
  '--z-sticky',
  '--z-popover',
  '--z-dock',
  '--z-toast',
  '--z-tooltip',
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];

/** `var(--token)`, for inline styles and SVG attributes. */
export const cssVar = (token: ThemeToken): string => `var(${token})`;

/** The token's computed value (e.g. `#00d2d3`), for canvas drawing. Empty when the stylesheet isn't loaded. */
export function getCssVar(token: ThemeToken, element: Element = document.documentElement): string {
  return getComputedStyle(element).getPropertyValue(token).trim();
}

/** Several tokens' computed values at once, e.g. a canvas palette read at the start of each draw. */
export function getCssVars<K extends string>(
  tokens: Record<K, ThemeToken>,
  element: Element = document.documentElement,
): Record<K, string> {
  const style = getComputedStyle(element);
  const values = {} as Record<K, string>;
  for (const key of Object.keys(tokens) as K[]) {
    values[key] = style.getPropertyValue(tokens[key]).trim();
  }
  return values;
}

/**
 * `color` at `amount` opacity as an rgba() string, for canvas. The canvas turns any colour it
 * accepts into `#rrggbb` (or `rgba(...)` when translucent), which is what this reads back.
 */
export function canvasRgba(ctx: CanvasRenderingContext2D, color: string, amount: number): string {
  const previous = ctx.fillStyle;
  ctx.fillStyle = color;
  const normalized = String(ctx.fillStyle);
  ctx.fillStyle = previous;
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(normalized);
  const channels = hex
    ? hex.slice(1).map((h) => parseInt(h, 16))
    : /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(normalized)?.slice(1).map(Number);
  return channels ? `rgba(${channels.join(', ')}, ${amount})` : color;
}

/** `color` at `amount` opacity (0–1); works for tokens (`cssVar(...)`) and hex values alike. */
export const alpha = (color: string, amount: number): string =>
  `color-mix(in srgb, ${color} ${Math.round(amount * 100)}%, transparent)`;

/** Shared look of Recharts tooltips; each chart adds its own padding and font sizes. */
export const CHART_TOOLTIP_CONTENT_STYLE = {
  backgroundColor: cssVar('--bg-tooltip'),
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: `1px solid ${cssVar('--border-highlight')}`,
  borderRadius: cssVar('--radius-sm'),
  boxShadow: cssVar('--shadow-md'),
} as const;
