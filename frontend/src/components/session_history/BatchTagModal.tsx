import React, { useState } from 'react';
import { Tag as TagIcon } from 'lucide-react';
import { TagBadge } from './TagBadge';
import { useI18n } from '../../context/I18nContext';
import type { Tag } from '../../types/session';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader } from '../ui/Modal';

interface BatchTagModalProps {
  isOpen: boolean;
  selectedCount: number;
  availableTags: Tag[];
  onClose: () => void;
  onApplyTag: (tagId: number) => Promise<void>;
}

export const BatchTagModal: React.FC<BatchTagModalProps> = ({
  isOpen,
  selectedCount,
  availableTags,
  onClose,
  onApplyTag,
}) => {
  const { t } = useI18n();
  const [batchSelectedTagId, setBatchSelectedTagId] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleClose = () => {
    setBatchSelectedTagId(null);
    onClose();
  };

  const handleApply = async () => {
    if (!batchSelectedTagId) return;
    setIsApplying(true);
    try {
      await onApplyTag(batchSelectedTagId);
      handleClose();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="sm" describedByBody>
      <ModalHeader
        tone="accent"
        icon={<TagIcon size={20} />}
        title={t('history.batch.tagModalTitle', { count: selectedCount })}
      />
      <ModalBody className="batch-tag-modal-body">
        <ModalDescription>{t('history.batch.tagSelectPlaceholder')}</ModalDescription>
        {availableTags.length === 0 ? (
          <EmptyState compact description={t('history.tags.noTagsAvailable')} />
        ) : (
          <div className="batch-tag-options">
            {availableTags.map((tag) => {
              const isSelected = batchSelectedTagId === tag.id;
              return (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  size="md"
                  selected={isSelected}
                  onClick={() => setBatchSelectedTagId(isSelected ? null : tag.id)}
                />
              );
            })}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={!batchSelectedTagId} loading={isApplying} onClick={handleApply}>
          {t('history.batch.applyTag')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
