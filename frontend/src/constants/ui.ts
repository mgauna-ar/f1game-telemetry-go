/**
 * Centralized UI constants to eliminate magic numbers in component styling,
 * chart geometries, animations, and interaction timings.
 */

export const UI = {
  // Icon sizes (lucide `size`): one step per role, so icons line up with the text beside them
  ICON_SIZE_XS: 12, // inline with small text, badges
  ICON_SIZE_SM: 14, // buttons, chips, table actions
  ICON_SIZE_MD: 16, // panel headers, tabs, nav
  ICON_SIZE_LG: 20, // page-level hero cards
  ICON_SIZE_XL: 28, // page titles (ui/PageHeader sizes it from the title)
  ICON_SIZE_2XL: 32, // empty states (ui/EmptyState sizes it)

  // Visual Opacity Levels
  DEFAULT_OPACITY: 0.65,
  ACTIVE_OPACITY: 1.0,
  MUTED_OPACITY: 0.35,
  GHOST_OPACITY: 0.15,

  // Timings & Delays (ms)
  TOAST_DURATION_MS: 4000,
  TOOLTIP_DELAY_MS: 200,
  DEBOUNCE_SEARCH_MS: 300,
  DEFAULT_RECONNECT_MS: 2000,
  MAX_RECONNECT_MS: 30000,
  COPY_FEEDBACK_MS: 2000,

  // Shortest bar in a ranking scaled from the slowest to the fastest value (%)
  RANKING_BAR_MIN_PCT: 8,

  // Grid & Layout Sizes (px)
  LEADERBOARD_WIDTH_PX: 320,
  MODAL_MAX_WIDTH_PX: 680,
} as const;

/** Browser tab titles read "<view> · F1 Telemetry"; the default matches index.html. */
export const APP_NAME = 'F1 Telemetry';
export const DEFAULT_DOCUMENT_TITLE = 'F1 Telemetry — Real-Time Telemetry & Pit Wall';

