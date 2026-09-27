import React, { useId } from 'react';
import { Filter } from 'lucide-react';
import { getTeamColor } from '../../constants/f1';
import { styleVars } from '../../styles/theme';
import type { DriverStanding } from '../../types/session';
import { Button } from '../ui/Button';
import styles from './DriverFilterChips.module.css';

interface DriverFilterChipsProps {
  /** Names the group, such as "Filter drivers (5/20 visible)". */
  label: React.ReactNode;
  drivers: DriverStanding[];
  selected: Record<number, boolean>;
  onToggle: (carIndex: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  selectAllLabel: string;
  clearLabel: string;
}

/** A row of toggle chips, one per driver in their team colour, that picks which drivers a chart shows. */
export const DriverFilterChips: React.FC<DriverFilterChipsProps> = ({
  label,
  drivers,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  selectAllLabel,
  clearLabel,
}) => {
  const labelId = useId();
  return (
    <div>
      <div className={styles.head}>
        <div id={labelId} className={styles.label}>
          <Filter size={14} aria-hidden="true" />
          {label}
        </div>
        <div className={styles.actions}>
          <Button size="sm" onClick={onSelectAll}>
            {selectAllLabel}
          </Button>
          <Button size="sm" onClick={onClear}>
            {clearLabel}
          </Button>
        </div>
      </div>

      <div className={styles.chips} role="group" aria-labelledby={labelId}>
        {drivers.map((driver) => (
          <button
            type="button"
            key={driver.participant.car_index}
            aria-pressed={!!selected[driver.participant.car_index]}
            onClick={() => onToggle(driver.participant.car_index)}
            className={styles.chip}
            style={styleVars({ '--team-color': getTeamColor(driver.participant.team_id) })}
          >
            <span className={styles.teamDot} aria-hidden="true" />
            <span>{driver.participant.name}</span>
            <span className={styles.raceNumber}>#{driver.participant.race_number}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
