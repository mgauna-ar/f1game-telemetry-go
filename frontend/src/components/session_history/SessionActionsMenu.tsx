import React from 'react';
import { Download, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { SessionListItem } from '../../types/session';
import { Menu, type MenuItem } from '../ui/Menu';

interface SessionActionsMenuProps {
  session: SessionListItem;
  onExport?: (session: SessionListItem) => void;
  onManageTags: (session: SessionListItem) => void;
  onDelete: (session: SessionListItem) => void;
}

/** The "⋯" menu of a session in the list: export, tags and, last and in red, delete. */
export const SessionActionsMenu: React.FC<SessionActionsMenuProps> = ({
  session,
  onExport,
  onManageTags,
  onDelete,
}) => {
  const { t } = useI18n();
  const items: MenuItem[] = [
    ...(onExport
      ? [
          {
            key: 'export',
            label: t('history.list.exportAction'),
            icon: <Download size={14} />,
            onSelect: () => onExport(session),
          },
        ]
      : []),
    {
      key: 'tags',
      label: t('history.list.tagsAction'),
      icon: <TagIcon size={14} />,
      onSelect: () => onManageTags(session),
    },
    {
      key: 'delete',
      label: t('history.list.deleteAction'),
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => onDelete(session),
    },
  ];
  return (
    <Menu
      label={t('history.list.moreActions', {
        track: session.track_name || t('common.unknownTrack'),
        id: session.id,
      })}
      items={items}
    />
  );
};
