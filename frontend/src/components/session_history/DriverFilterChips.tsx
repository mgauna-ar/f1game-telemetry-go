import React, { useId } from 'react';
import { Filter } from 'lucide-react';
import { getTeamColor } from '../../constants/f1';
import type { DriverStanding } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
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
  /** Your car's chip is marked YOU. */
  playerCarIndex?: number | null;
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
  playerCarIndex = null,
}) => {
  const { t } = useI18n();
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
          <Chip
            key={driver.participant.car_index}
            pressed={!!selected[driver.participant.car_index]}
            onClick={() => onToggle(driver.participant.car_index)}
            color={getTeamColor(driver.participant.team_id)}
          >
            {driver.participant.name} <span className={styles.raceNumber}>#{driver.participant.race_number}</span>
            {driver.participant.car_index === playerCarIndex && (
              <>
                {' '}
                <Badge tone="you" size="xs">
                  {t('history.player.you')}
                </Badge>
              </>
            )}
          </Chip>
        ))}
      </div>
    </div>
  );
};
