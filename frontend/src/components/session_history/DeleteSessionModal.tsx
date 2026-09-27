import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { Session } from '../../types/session';
import { Button } from '../ui/Button';
import { Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader } from '../ui/Modal';

interface DeleteSessionModalProps {
  session: Session | null;
  deletingSessionId: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteSessionModal: React.FC<DeleteSessionModalProps> = ({
  session,
  deletingSessionId,
  onCancel,
  onConfirm,
}) => {
  const { t } = useI18n();
  const isDeleting = session !== null && deletingSessionId === session.id;

  return (
    <Modal isOpen={session !== null} onClose={onCancel} size="sm" role="alertdialog" describedByBody>
      <ModalHeader tone="danger" icon={<AlertTriangle size={20} />} title={t('history.modal.confirmTitle')} />
      {session && (
        <ModalBody>
          <ModalDescription>
            {t('history.modal.confirmBody', {
              id: session.id,
              track: session.track_name,
              type: session.session_type,
            })}
          </ModalDescription>
        </ModalBody>
      )}
      <ModalFooter>
        <Button onClick={onCancel} disabled={isDeleting}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={isDeleting} icon={<Trash2 size={14} />}>
          {isDeleting ? t('common.deleting') : t('common.deleteSession')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
