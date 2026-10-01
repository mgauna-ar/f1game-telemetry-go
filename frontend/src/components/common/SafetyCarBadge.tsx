import React from 'react';
import { Flag, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { SAFETY_CAR_STATUS } from '../../constants/f1';
import { Badge } from '../ui/Badge';

export interface SafetyCarBadgeProps {
  /** `SessionData.SafetyCarStatus`. */
  status?: number;
  size?: 'sm' | 'md';
  /** Text when the track is clear; the header says "Green flag", the feed "Track clear". */
  clearLabel?: string;
}

/**
 * Track status (clear, safety car, virtual safety car, formation lap) for the live header and feed:
 * safety car yellow, VSC and formation lap orange (`--f1-flag-sc` / `--f1-flag-vsc`), never animated.
 */
export const SafetyCarBadge: React.FC<SafetyCarBadgeProps> = ({ status, size = 'sm', clearLabel }) => {
  const { t } = useI18n();
  const iconSize = size === 'md' ? 14 : 12;
  const flag = <Flag size={iconSize} aria-hidden="true" />;
  const shield = <ShieldAlert size={iconSize} aria-hidden="true" />;

  switch (status) {
    case SAFETY_CAR_STATUS.FULL:
      return (
        <Badge color="var(--f1-flag-sc)" size={size} uppercase icon={shield}>
          {t('live.safetyCarStatus')}
        </Badge>
      );
    case SAFETY_CAR_STATUS.VIRTUAL:
      return (
        <Badge color="var(--f1-flag-vsc)" size={size} uppercase icon={shield}>
          {t('live.vscStatus')}
        </Badge>
      );
    case SAFETY_CAR_STATUS.FORMATION_LAP:
      return (
        <Badge color="var(--f1-flag-vsc)" size={size} uppercase icon={flag}>
          {t('live.formationLap')}
        </Badge>
      );
    default:
      return (
        <Badge tone="success" size={size} uppercase icon={flag}>
          {clearLabel ?? t('live.greenFlag')}
        </Badge>
      );
  }
};
