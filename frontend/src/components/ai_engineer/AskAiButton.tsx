import React from 'react';
import { Sparkles } from 'lucide-react';
import { useRaceEngineerActions } from '../../context/RaceEngineerContext';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';

export interface AskAiButtonProps {
  /** The question sent when the chat opens. */
  prompt: string;
  /** What the question is about, for the button's accessible name ("Ask the AI engineer about …"). */
  about: string;
  className?: string;
}

/**
 * Opens the AI chat and asks `prompt` about the chart beside it. The chat reads what it is about
 * from the URL (the session and the tab open), so the button only supplies the question.
 */
export const AskAiButton: React.FC<AskAiButtonProps> = ({ prompt, about, className }) => {
  const { t } = useI18n();
  const { openChat } = useRaceEngineerActions();
  const label = t('ai_engineer.askAiAbout', { chart: about });
  return (
    <Button
      size="sm"
      variant="ghost"
      className={className}
      icon={<Sparkles size={13} aria-hidden="true" />}
      aria-label={label}
      title={label}
      onClick={() => openChat(prompt)}
    >
      {t('ai_engineer.askAi')}
    </Button>
  );
};
