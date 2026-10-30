import React from 'react';
import { AppWindow, Mic } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useShowWindow } from '../../hooks/useShowWindow';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

/**
 * In place of the voice cockpit on a PC whose engineer has its own window (Windows): the radio
 * speaks and listens there, so the page only leads to it.
 */
export const EngineerWindowNote: React.FC = () => {
  const { t } = useI18n();
  const showWindow = useShowWindow();
  return (
    <EmptyState
      icon={<Mic size={28} />}
      title={t('live.engineerWindow.title')}
      description={t('live.engineerWindow.body')}
      action={
        <Button
          icon={<AppWindow size={14} aria-hidden="true" />}
          onClick={() => showWindow('engineer')}
          data-testid="engineer-window-open"
        >
          {t('live.engineerWindow.open')}
        </Button>
      }
    />
  );
};
