import React from 'react';
import { Zap, Gauge, Cpu, ZoomIn, Sparkles, Radio, Flag, CloudRain, type LucideIcon } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import styles from './PromptChipBar.module.css';

export interface PromptChipBarProps {
  effectiveMode: string;
  hasLapsSelected: boolean;
  isZoomActive: boolean;
  /** A recorded session is picked for the debrief. */
  hasDebriefSession: boolean;
  /** No live telemetry is coming in. */
  isLiveStandby: boolean;
  isGenerating: boolean;
  onSelectPrompt: (prompt: string) => void;
}

/** A quick prompt: `key` names its `…Label` and `…Prompt` strings under `ai_engineer.chips`. */
interface PromptChip {
  key: string;
  icon: LucideIcon;
  /** Icon colour. */
  tone: 'warning' | 'danger' | 'cyan' | 'green' | 'gold';
}

const COMPARE_CHIPS: PromptChip[] = [
  { key: 'deltaLoss', icon: Zap, tone: 'warning' },
  { key: 'brakingTraction', icon: Gauge, tone: 'danger' },
  { key: 'ersDrs', icon: Cpu, tone: 'cyan' },
];
const ZOOM_CHIP: PromptChip = { key: 'zoomedAnalysis', icon: ZoomIn, tone: 'green' };

const GENERAL_CHIPS: PromptChip[] = [
  { key: 'genTrailBraking', icon: Gauge, tone: 'danger' },
  { key: 'genTyreManagement', icon: Zap, tone: 'warning' },
  { key: 'genErs', icon: Cpu, tone: 'cyan' },
];

const DEBRIEF_CHIPS: PromptChip[] = [
  { key: 'debriefOverview', icon: Sparkles, tone: 'gold' },
  { key: 'debriefTyres', icon: Gauge, tone: 'warning' },
  { key: 'debriefSectors', icon: Zap, tone: 'cyan' },
];

const LIVE_STANDBY_CHIPS: PromptChip[] = [
  { key: 'liveRadioCheck', icon: Radio, tone: 'cyan' },
  { key: 'livePrep', icon: Gauge, tone: 'warning' },
  { key: 'liveTacticalPlan', icon: Flag, tone: 'green' },
];

const LIVE_CHIPS: PromptChip[] = [
  { key: 'liveWeather', icon: CloudRain, tone: 'cyan' },
  { key: 'liveStrategy', icon: Flag, tone: 'warning' },
  { key: 'livePace', icon: Zap, tone: 'green' },
];

const pickChips = ({
  effectiveMode,
  hasLapsSelected,
  isZoomActive,
  hasDebriefSession,
  isLiveStandby,
}: Omit<PromptChipBarProps, 'isGenerating' | 'onSelectPrompt'>): PromptChip[] => {
  if (effectiveMode === 'comparator' && hasLapsSelected) {
    return isZoomActive ? [ZOOM_CHIP, ...COMPARE_CHIPS] : COMPARE_CHIPS;
  }
  if (effectiveMode === 'session_debrief' && hasDebriefSession) return DEBRIEF_CHIPS;
  if (effectiveMode === 'live') return isLiveStandby ? LIVE_STANDBY_CHIPS : LIVE_CHIPS;
  return GENERAL_CHIPS;
};

/** Suggested questions for what the chat is looking at; one click sends one. */
export const PromptChipBar: React.FC<PromptChipBarProps> = ({ isGenerating, onSelectPrompt, ...context }) => {
  const { t } = useI18n();
  const chips = pickChips(context);

  return (
    <div className={styles.bar}>
      {chips.map(({ key, icon: Icon, tone }) => (
        <button
          key={key}
          type="button"
          className={styles.chip}
          data-tone={tone}
          onClick={() => onSelectPrompt(t(`ai_engineer.chips.${key}Prompt`))}
          disabled={isGenerating}
        >
          <Icon size={13} aria-hidden="true" />
          <span>{t(`ai_engineer.chips.${key}Label`)}</span>
        </button>
      ))}
    </div>
  );
};
