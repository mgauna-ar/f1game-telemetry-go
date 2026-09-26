import React, { useMemo } from 'react';
import {
  Zap,
  Gauge,
  Cpu,
  ZoomIn,
  Sparkles,
  Radio,
  Flag,
  CloudRain,
} from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { cssVar } from '../../styles/theme';

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

export const PromptChipBar: React.FC<PromptChipBarProps> = ({
  effectiveMode,
  hasLapsSelected,
  isZoomActive,
  hasDebriefSession,
  isLiveStandby,
  isGenerating,
  onSelectPrompt,
}) => {
  const { t } = useI18n();

  const adaptivePromptChips = useMemo(() => {
    if (effectiveMode === 'comparator') {
      if (hasLapsSelected) {
        const chips = [
          {
            id: 'delta-loss',
            icon: <Zap size={13} style={{ color: cssVar('--status-warning') }} />,
            label: t('ai_engineer.chips.deltaLossLabel'),
            prompt: t('ai_engineer.chips.deltaLossPrompt'),
          },
          {
            id: 'braking-traction',
            icon: <Gauge size={13} style={{ color: cssVar('--status-danger') }} />,
            label: t('ai_engineer.chips.brakingTractionLabel'),
            prompt: t('ai_engineer.chips.brakingTractionPrompt'),
          },
          {
            id: 'ers-drs',
            icon: <Cpu size={13} style={{ color: cssVar('--accent-cyan') }} />,
            label: t('ai_engineer.chips.ersDrsLabel'),
            prompt: t('ai_engineer.chips.ersDrsPrompt'),
          },
        ];
        if (isZoomActive) {
          chips.unshift({
            id: 'zoomed-analysis',
            icon: <ZoomIn size={13} style={{ color: cssVar('--accent-tertiary') }} />,
            label: t('ai_engineer.chips.zoomedAnalysisLabel'),
            prompt: t('ai_engineer.chips.zoomedAnalysisPrompt'),
          });
        }
        return chips;
      }
      return [
        {
          id: 'gen-trail-braking',
          icon: <Gauge size={13} style={{ color: cssVar('--status-danger') }} />,
          label: t('ai_engineer.chips.genTrailBrakingLabel'),
          prompt: t('ai_engineer.chips.genTrailBrakingPrompt'),
        },
        {
          id: 'gen-tyre-management',
          icon: <Zap size={13} style={{ color: cssVar('--status-warning') }} />,
          label: t('ai_engineer.chips.genTyreManagementLabel'),
          prompt: t('ai_engineer.chips.genTyreManagementPrompt'),
        },
        {
          id: 'gen-ers',
          icon: <Cpu size={13} style={{ color: cssVar('--accent-cyan') }} />,
          label: t('ai_engineer.chips.genErsLabel'),
          prompt: t('ai_engineer.chips.genErsPrompt'),
        },
      ];
    }

    if (effectiveMode === 'session_debrief' && hasDebriefSession) {
      return [
        {
          id: 'debrief-overview',
          icon: <Sparkles size={13} style={{ color: cssVar('--f1-gold') }} />,
          label: t('ai_engineer.chips.debriefOverviewLabel'),
          prompt: t('ai_engineer.chips.debriefOverviewPrompt'),
        },
        {
          id: 'debrief-tyres',
          icon: <Gauge size={13} style={{ color: cssVar('--status-warning') }} />,
          label: t('ai_engineer.chips.debriefTyresLabel'),
          prompt: t('ai_engineer.chips.debriefTyresPrompt'),
        },
        {
          id: 'debrief-sectors',
          icon: <Zap size={13} style={{ color: cssVar('--accent-cyan') }} />,
          label: t('ai_engineer.chips.debriefSectorsLabel'),
          prompt: t('ai_engineer.chips.debriefSectorsPrompt'),
        },
      ];
    }

    if (effectiveMode === 'live') {
      if (isLiveStandby) {
        return [
          {
            id: 'live-radio-check',
            icon: <Radio size={13} style={{ color: cssVar('--accent-cyan') }} />,
            label: t('ai_engineer.chips.liveRadioCheckLabel'),
            prompt: t('ai_engineer.chips.liveRadioCheckPrompt'),
          },
          {
            id: 'live-prep',
            icon: <Gauge size={13} style={{ color: cssVar('--status-warning') }} />,
            label: t('ai_engineer.chips.livePrepLabel'),
            prompt: t('ai_engineer.chips.livePrepPrompt'),
          },
          {
            id: 'live-strategy-plan',
            icon: <Flag size={13} style={{ color: cssVar('--accent-tertiary') }} />,
            label: t('ai_engineer.chips.liveTacticalPlanLabel'),
            prompt: t('ai_engineer.chips.liveTacticalPlanPrompt'),
          },
        ];
      }
      return [
        {
          id: 'live-weather',
          icon: <CloudRain size={13} style={{ color: cssVar('--accent-cyan') }} />,
          label: t('ai_engineer.chips.liveWeatherLabel'),
          prompt: t('ai_engineer.chips.liveWeatherPrompt'),
        },
        {
          id: 'live-strategy',
          icon: <Flag size={13} style={{ color: cssVar('--status-warning') }} />,
          label: t('ai_engineer.chips.liveStrategyLabel'),
          prompt: t('ai_engineer.chips.liveStrategyPrompt'),
        },
        {
          id: 'live-pace',
          icon: <Zap size={13} style={{ color: cssVar('--accent-tertiary') }} />,
          label: t('ai_engineer.chips.livePaceLabel'),
          prompt: t('ai_engineer.chips.livePacePrompt'),
        },
      ];
    }

    // Default general chips
    return [
      {
        id: 'gen-trail-braking',
        icon: <Gauge size={13} style={{ color: cssVar('--status-danger') }} />,
        label: t('ai_engineer.chips.genTrailBrakingLabel'),
        prompt: t('ai_engineer.chips.genTrailBrakingPrompt'),
      },
      {
        id: 'gen-tyre-management',
        icon: <Zap size={13} style={{ color: cssVar('--status-warning') }} />,
        label: t('ai_engineer.chips.genTyreManagementLabel'),
        prompt: t('ai_engineer.chips.genTyreManagementPrompt'),
      },
      {
        id: 'gen-ers',
        icon: <Cpu size={13} style={{ color: cssVar('--accent-cyan') }} />,
        label: t('ai_engineer.chips.genErsLabel'),
        prompt: t('ai_engineer.chips.genErsPrompt'),
      },
    ];
  }, [effectiveMode, hasLapsSelected, isZoomActive, hasDebriefSession, isLiveStandby, t]);

  return (
    <div className="ai-widget-chips-row">
      {adaptivePromptChips.map((chip) => (
        <button
          key={chip.id}
          className="ai-prompt-chip"
          onClick={() => onSelectPrompt(chip.prompt)}
          disabled={isGenerating}
        >
          {chip.icon}
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
};
