/**
 * Centralized UI constants to eliminate magic numbers in component styling,
 * chart geometries, animations, and interaction timings.
 */

export const UI = {
  // Icon Sizes
  ICON_SIZE_XS: 9,
  ICON_SIZE_SM: 11,
  ICON_SIZE_MD: 13,
  ICON_SIZE_LG: 16,
  ICON_SIZE_XL: 20,
  ICON_SIZE_2XL: 24,

  // Chart Geometry & Defaults
  CHART_HEIGHT_DEFAULT: 300,
  CHART_HEIGHT_COMPACT: 180,
  CHART_HEIGHT_MINI: 120,
  CHART_MARGIN: { top: 5, right: 20, bottom: 5, left: 20 },
  CHART_MARGIN_COMPACT: { top: 4, right: 12, bottom: 4, left: 12 },

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

  // Grid & Layout Sizes (px)
  LEADERBOARD_WIDTH_PX: 320,
  MODAL_MAX_WIDTH_PX: 680,
} as const;
