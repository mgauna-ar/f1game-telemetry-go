import React, { useId } from 'react';
import { Trophy, Users, User } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { ComparatorPreferences, ComparatorRivalMode } from '../../types/comparatorPreferences';
import { cx } from '../ui/cx';
import { TextInput } from '../ui/Field';
import styles from './ComparatorPreferencesModal.module.css';

export interface ComparatorPreferencesFieldsProps {
  value: ComparatorPreferences;
  onChange: (next: ComparatorPreferences) => void;
  /** Slot B's current driver, offered as the rival's name. */
  currentSlotBDriverName?: string;
}

const RIVAL_MODES: ReadonlyArray<{ mode: ComparatorRivalMode; icon: React.ReactNode; labelKey: string }> = [
  { mode: 'fastest', icon: <Trophy size={16} aria-hidden="true" />, labelKey: 'comparator.preferences.targetFastest' },
  { mode: 'teammate', icon: <Users size={16} aria-hidden="true" />, labelKey: 'comparator.preferences.targetTeammate' },
  { mode: 'driver', icon: <User size={16} aria-hidden="true" />, labelKey: 'comparator.preferences.targetDriver' },
];

/** Who slot B compares against by default: the fastest lap, your teammate or a named driver. */
export const ComparatorPreferencesFields: React.FC<ComparatorPreferencesFieldsProps> = ({
  value,
  onChange,
  currentSlotBDriverName,
}) => {
  const { t } = useI18n();
  const nameId = useId();
  const groupName = useId();

  return (
    <fieldset className={cx(styles.section, styles.slotB)}>
      <legend className={styles.label}>
        <span className={styles.dot} aria-hidden="true" />
        {t('comparator.preferences.comparisonTarget')}
      </legend>

      <div className={styles.options}>
        {RIVAL_MODES.map(({ mode, icon, labelKey }) => (
          <label key={mode} className={styles.option} data-testid={`rival-mode-${mode}-label`}>
            <input
              type="radio"
              name={groupName}
              value={mode}
              checked={value.rivalMode === mode}
              onChange={() => onChange({ ...value, rivalMode: mode })}
              data-testid={`rival-mode-${mode}-radio`}
            />
            {icon}
            <span>{t(labelKey)}</span>
          </label>
        ))}

        {value.rivalMode === 'driver' && (
          <div className={styles.rivalDriver}>
            <div className={styles.sectionHead}>
              <label htmlFor={nameId} className={styles.rivalDriverLabel}>
                {t('comparator.preferences.targetDriver')}:
              </label>
              {currentSlotBDriverName && (
                <button
                  type="button"
                  className={styles.useCurrent}
                  onClick={() => onChange({ ...value, rivalDriverName: currentSlotBDriverName })}
                  data-testid="use-current-driver-b-btn"
                >
                  {t('comparator.preferences.useCurrentDriver')}: {currentSlotBDriverName}
                </button>
              )}
            </div>
            <TextInput
              id={nameId}
              value={value.rivalDriverName}
              onChange={(e) => onChange({ ...value, rivalDriverName: e.target.value })}
              placeholder={t('comparator.preferences.rivalDriverPlaceholder')}
              data-testid="rival-driver-name-input"
            />
          </div>
        )}
      </div>

      <p className={styles.help}>{t('comparator.preferences.fallbackNotice')}</p>
    </fieldset>
  );
};
