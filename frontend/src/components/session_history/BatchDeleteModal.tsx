import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';
import { Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader } from '../ui/Modal';

interface BatchDeleteModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const BatchDeleteModal: React.FC<BatchDeleteModalProps> = ({
  isOpen,
  selectedCount,
  onClose,
  onConfirm,
}) => {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" role="alertdialog" describedByBody>
      <ModalHeader tone="danger" icon={<AlertTriangle size={20} />} title={t('history.batch.confirmDeleteTitle')} />
      <ModalBody>
        <ModalDescription>{t('history.batch.confirmDeleteBody', { count: selectedCount })}</ModalDescription>
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose} disabled={isDeleting}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={handleConfirm} loading={isDeleting} icon={<Trash2 size={14} />}>
          {t('history.batch.deleteSelected', { count: selectedCount })}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
