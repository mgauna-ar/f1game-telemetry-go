/**
 * The dashboard's breakpoints: the widths at and below which a layout changes. CSS names them in
 * media queries as `@media (--phone)`, `(--tablet)` and `(--laptop)`; the `breakpointMedia` PostCSS
 * plugin (vite.config.ts) turns them into `(max-width: …)` in every stylesheet, and components
 * read the same widths with `useMediaQuery(maxWidth('tablet'))`.
 *
 * - phone: one column, compact controls (a 375–430px phone, a small window)
 * - tablet: a tablet in portrait, or half a laptop screen
 * - laptop: a tablet in landscape or a small laptop, where side columns stack
 */
export const BREAKPOINTS = {
  phone: 600,
  tablet: 900,
  laptop: 1100,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/** The media condition for widths up to a breakpoint: `(max-width: 900px)`. */
export const maxWidth = (name: Breakpoint): string => `(max-width: ${BREAKPOINTS[name]}px)`;

/**
 * A phone in either orientation: phone widths, or a short touch screen held sideways (a phone
 * mounted on a rig in landscape is wider than the phone breakpoint).
 */
export const PHONE_MEDIA = `${maxWidth('phone')}, (max-height: ${BREAKPOINTS.phone}px) and (orientation: landscape) and (pointer: coarse)`;

const NAMED_MEDIA = /\(--([a-z-]+)\)/g;

/**
 * Expands the named breakpoints in a media query's condition. An unknown name throws, so a typo
 * fails the build instead of leaving a rule that never applies.
 */
export function expandMediaParams(params: string, file = 'stylesheet'): string {
  return params.replace(NAMED_MEDIA, (_match, name: string) => {
    if (!(name in BREAKPOINTS)) {
      throw new Error(`${file}: unknown breakpoint (--${name}); use ${Object.keys(BREAKPOINTS).join(', ')}`);
    }
    return maxWidth(name as Breakpoint);
  });
}
