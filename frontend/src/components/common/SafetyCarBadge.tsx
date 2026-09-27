import React from 'react';
import { Flag, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { SAFETY_CAR_STATUS } from '../../constants/f1';
import { Badge } from '../ui/Badge';
import styles from './SafetyCarBadge.module.css';

export interface SafetyCarBadgeProps {
  /** `SessionData.SafetyCarStatus`. */
  status?: number;
  size?: 'sm' | 'md';
  /** Text when the track is clear; the header says "Green flag", the feed "Track clear". */
  clearLabel?: string;
}

/** Track status (clear, safety car, virtual safety car, formation lap) for the live header and feed. */
export const SafetyCarBadge: React.FC<SafetyCarBadgeProps> = ({ status, size = 'sm', clearLabel }) => {
  const { t } = useI18n();
  const iconSize = size === 'md' ? 14 : 13;
  const flag = <Flag size={iconSize} aria-hidden="true" />;
  const shield = <ShieldAlert size={iconSize} aria-hidden="true" />;

  switch (status) {
    case SAFETY_CAR_STATUS.FULL:
      return (
        <Badge tone="warning" size={size} uppercase icon={shield} className={styles.fullSafetyCar}>
          {t('live.safetyCarStatus')}
        </Badge>
      );
    case SAFETY_CAR_STATUS.VIRTUAL:
      return (
        <Badge tone="orange" size={size} uppercase icon={shield}>
          {t('live.vscStatus')}
        </Badge>
      );
    case SAFETY_CAR_STATUS.FORMATION_LAP:
      return (
        <Badge tone="info" size={size} uppercase icon={flag}>
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
