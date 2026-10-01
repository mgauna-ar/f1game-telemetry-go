import React, { useState, useEffect } from 'react';
import { Sliders, Check } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { ComparatorPreferences } from '../../types/comparatorPreferences';
import { useComparatorPreferencesStore } from '../../store/useComparatorPreferencesStore';
import { Button } from '../ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../ui/Modal';
import { AllSettingsLink } from '../settings/AllSettingsLink';
import { ComparatorPreferencesFields } from './ComparatorPreferencesFields';
import styles from './ComparatorPreferencesModal.module.css';

export interface ComparatorPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prefs: ComparatorPreferences) => void;
  currentSlotBDriverName?: string;
}

/**
 * A shortcut to the comparator section of the settings page: the same choice, saved for every
 * device, plus picking slot B's lap again with it.
 */
export const ComparatorPreferencesModal: React.FC<ComparatorPreferencesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSlotBDriverName,
}) => {
  const { t } = useI18n();
  const [draft, setDraft] = useState<ComparatorPreferences>(() => useComparatorPreferencesStore.getState().preferences);

  // Start from the saved preferences whenever the modal opens
  useEffect(() => {
    if (isOpen) setDraft(useComparatorPreferencesStore.getState().preferences);
  }, [isOpen]);

  const handleSave = () => {
    const updated: ComparatorPreferences = { ...draft, rivalDriverName: draft.rivalDriverName.trim() };
    useComparatorPreferencesStore.getState().update(updated);
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
        <ComparatorPreferencesFields
          value={draft}
          onChange={setDraft}
          currentSlotBDriverName={currentSlotBDriverName}
        />
      </ModalBody>

      <ModalFooter align="between">
        <AllSettingsLink section="comparator" onNavigate={onClose} />
        <span className={styles.footerActions}>
          <Button variant="ghost" onClick={onClose} data-testid="cancel-preferences-btn">
            {t('comparator.preferences.cancel')}
          </Button>
          <Button variant="primary" icon={<Check size={16} />} onClick={handleSave} data-testid="save-preferences-btn">
            {t('comparator.preferences.save')}
          </Button>
        </span>
      </ModalFooter>
    </Modal>
  );
};
