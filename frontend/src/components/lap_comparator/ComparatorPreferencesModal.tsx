import React, { useState, useEffect } from 'react';
import { Sliders, Trophy, Users, User, Check } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { ComparatorPreferences, ComparatorRivalMode } from '../../types/comparatorPreferences';
import {
  loadComparatorPreferences,
  saveComparatorPreferences,
} from '../../utils/comparatorPreferencesUtils';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../ui/Modal';
import styles from './ComparatorPreferencesModal.module.css';

export interface ComparatorPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prefs: ComparatorPreferences) => void;
  currentSlotBDriverName?: string;
}

const RIVAL_MODES: ReadonlyArray<{ mode: ComparatorRivalMode; icon: React.ReactNode; labelKey: string }> = [
  { mode: 'fastest', icon: <Trophy size={16} aria-hidden="true" />, labelKey: 'comparator.preferences.targetFastest' },
  { mode: 'teammate', icon: <Users size={16} aria-hidden="true" />, labelKey: 'comparator.preferences.targetTeammate' },
  { mode: 'driver', icon: <User size={16} aria-hidden="true" />, labelKey: 'comparator.preferences.targetDriver' },
];

export const ComparatorPreferencesModal: React.FC<ComparatorPreferencesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSlotBDriverName,
}) => {
  const { t } = useI18n();

  const [rivalMode, setRivalMode] = useState<ComparatorRivalMode>('fastest');
  const [rivalDriverName, setRivalDriverName] = useState('');

  // Synchronize state from storage whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      const prefs = loadComparatorPreferences();
      setRivalMode(prefs.rivalMode);
      setRivalDriverName(prefs.rivalDriverName);
    }
  }, [isOpen]);

  const handleSave = () => {
    const updated: ComparatorPreferences = {
      rivalMode,
      rivalDriverName: rivalDriverName.trim(),
    };
    saveComparatorPreferences(updated);
    onSave(updated);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} data-testid="comparator-preferences-modal">
      <ModalHeader
        tone="primary"
        icon={<Sliders size={20} />}
        title={t('comparator.preferences.modalTitle')}
        subtitle={t('comparator.preferences.modalSubtitle')}
      />

      <ModalBody className={styles.body}>
        {/* Default comparison target (slot B) */}
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
                  name="rivalMode"
                  value={mode}
                  checked={rivalMode === mode}
                  onChange={() => setRivalMode(mode)}
                  data-testid={`rival-mode-${mode}-radio`}
                />
                {icon}
                <span>{t(labelKey)}</span>
              </label>
            ))}

            {rivalMode === 'driver' && (
              <div className={styles.rivalDriver}>
                <div className={styles.sectionHead}>
                  <label htmlFor="rival-driver-name-input" className={styles.rivalDriverLabel}>
                    {t('comparator.preferences.targetDriver')}:
                  </label>
                  {currentSlotBDriverName && (
                    <button
                      type="button"
                      className={styles.useCurrent}
                      onClick={() => setRivalDriverName(currentSlotBDriverName)}
                      data-testid="use-current-driver-b-btn"
                    >
                      {t('comparator.preferences.useCurrentDriver')}: {currentSlotBDriverName}
                    </button>
                  )}
                </div>
                <input
                  id="rival-driver-name-input"
                  type="text"
                  className={styles.input}
                  value={rivalDriverName}
                  onChange={(e) => setRivalDriverName(e.target.value)}
                  placeholder={t('comparator.preferences.rivalDriverPlaceholder')}
                  data-testid="rival-driver-name-input"
                />
              </div>
            )}
          </div>

          <p className={styles.help}>{t('comparator.preferences.fallbackNotice')}</p>
        </fieldset>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} data-testid="cancel-preferences-btn">
          {t('comparator.preferences.cancel')}
        </Button>
        <Button variant="primary" icon={<Check size={16} />} onClick={handleSave} data-testid="save-preferences-btn">
          {t('comparator.preferences.save')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
