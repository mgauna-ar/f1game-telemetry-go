import { ReferenceArea } from 'recharts';
import { alpha, cssVar } from '../../styles/theme';
import type { RaceControlPeriod } from '../../utils/raceStory';

/**
 * The safety car and VSC periods as shaded lap ranges for a lap chart whose x-axis is a number
 * axis of lap numbers. Recharts reads its children directly, so this returns the areas rather
 * than being a component. A period still open at the end runs to `lastLap`.
 */
export function raceControlAreas(periods: readonly RaceControlPeriod[], lastLap: number, t: (key: string) => string) {
  return periods.map((p) => {
    const sc = p.kind === 'sc';
    return (
      <ReferenceArea
        key={`${p.kind}-${p.startLap}`}
        x1={p.startLap - 0.5}
        x2={(p.endLap ?? lastLap) + 0.5}
        fill={alpha(cssVar('--f1-yellow'), sc ? 0.14 : 0.08)}
        stroke={alpha(cssVar('--f1-yellow'), 0.35)}
        strokeDasharray={sc ? undefined : '4 3'}
        ifOverflow="hidden"
        label={{
          value: t(sc ? 'history.story.scShort' : 'history.story.vscShort'),
          position: 'insideTop',
          fill: cssVar('--f1-yellow'),
          fontSize: 10,
          fontWeight: 700,
        }}
      />
    );
  });
}
