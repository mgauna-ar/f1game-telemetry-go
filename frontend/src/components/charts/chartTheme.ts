/**
 * The one look of every Recharts chart (history, Progress, comparator): axes, grid, tooltip,
 * margins and no animation. Charts spread these and add only what is theirs, such as colours.
 */
import { CHART_TOOLTIP_CONTENT_STYLE, cssVar } from '../../styles/theme';

/** Tick text under and beside the plot. */
export const AXIS_TICK = { fill: cssVar('--chart-tick'), fontSize: 11 } as const;

/** Spread onto `<XAxis>` / `<YAxis>`: the axis line and its tick text. */
export const AXIS_PROPS = {
  stroke: cssVar('--chart-axis'),
  tick: AXIS_TICK,
} as const;

/** Spread onto `<CartesianGrid>`. */
export const GRID_PROPS = {
  strokeDasharray: '3 3',
  stroke: cssVar('--chart-grid'),
} as const;

/** Spread onto `<Tooltip>`: one compact tooltip for every chart. */
export const TOOLTIP_PROPS = {
  contentStyle: {
    ...CHART_TOOLTIP_CONTENT_STYLE,
    padding: '6px 10px',
    fontSize: '0.75rem',
    lineHeight: '1.3',
  },
  itemStyle: {
    padding: '1px 0',
    fontSize: '0.75rem',
    margin: 0,
  },
  labelStyle: {
    color: cssVar('--text-body'),
    fontSize: '0.75rem',
    fontWeight: 600,
    marginBottom: '2px',
  },
  wrapperStyle: {
    zIndex: cssVar('--z-popover'),
    pointerEvents: 'none' as const,
  },
};

/** Default plot margins: room on the right for the last tick label. */
export const CHART_MARGIN = { top: 8, right: 24, left: 0, bottom: 0 } as const;

/** Charts redraw on every data change; animating them only makes them wobble. */
export const NO_ANIMATION = { isAnimationActive: false } as const;
