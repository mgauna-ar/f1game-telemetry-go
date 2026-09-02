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
import type { TelemetryContextPayload } from '../../utils/aiTelemetrySummary';

export interface PromptChipBarProps {
  effectiveMode: string;
  activeComparatorContext: TelemetryContextPayload | null;
  hasLapsSelected: boolean;
  isZoomActive: boolean;
  sessionDebriefContext: { trackName?: string } | null;
  liveContext: { trackName?: string; sessionType?: string; liveSummary?: string } | null;
  isGenerating: boolean;
  onSelectPrompt: (prompt: string) => void;
}

export const PromptChipBar: React.FC<PromptChipBarProps> = ({
  effectiveMode,
  activeComparatorContext,
  hasLapsSelected,
  isZoomActive,
  sessionDebriefContext,
  liveContext,
  isGenerating,
  onSelectPrompt,
}) => {
  const { t } = useI18n();

  const adaptivePromptChips = useMemo(() => {
    if (effectiveMode === 'comparator') {
      if (hasLapsSelected && activeComparatorContext) {
        const chips = [
          {
            id: 'delta-loss',
            icon: <Zap size={13} style={{ color: '#ffd200' }} />,
            label: t('ai_engineer.chips.deltaLossLabel'),
            prompt: t('ai_engineer.chips.deltaLossPrompt'),
          },
          {
            id: 'braking-traction',
            icon: <Gauge size={13} style={{ color: '#ff4b4b' }} />,
            label: t('ai_engineer.chips.brakingTractionLabel'),
            prompt: t('ai_engineer.chips.brakingTractionPrompt'),
          },
          {
            id: 'ers-drs',
            icon: <Cpu size={13} style={{ color: '#00f2fe' }} />,
            label: t('ai_engineer.chips.ersDrsLabel'),
            prompt: t('ai_engineer.chips.ersDrsPrompt'),
          },
        ];
        if (isZoomActive) {
          chips.unshift({
            id: 'zoomed-analysis',
            icon: <ZoomIn size={13} style={{ color: '#38ef7d' }} />,
            label: t('ai_engineer.chips.zoomedAnalysisLabel'),
            prompt: t('ai_engineer.chips.zoomedAnalysisPrompt'),
          });
        }
        return chips;
      }
      return [
        {
          id: 'gen-trail-braking',
          icon: <Gauge size={13} style={{ color: '#ff4b4b' }} />,
          label: t('ai_engineer.chips.genTrailBrakingLabel'),
          prompt: t('ai_engineer.chips.genTrailBrakingPrompt'),
        },
        {
          id: 'gen-tyre-management',
          icon: <Zap size={13} style={{ color: '#ffd200' }} />,
          label: t('ai_engineer.chips.genTyreManagementLabel'),
          prompt: t('ai_engineer.chips.genTyreManagementPrompt'),
        },
        {
          id: 'gen-ers',
          icon: <Cpu size={13} style={{ color: '#00f2fe' }} />,
          label: t('ai_engineer.chips.genErsLabel'),
          prompt: t('ai_engineer.chips.genErsPrompt'),
        },
      ];
    }

    if (effectiveMode === 'session_debrief' && sessionDebriefContext) {
      return [
        {
          id: 'debrief-overview',
          icon: <Sparkles size={13} style={{ color: '#ffd700' }} />,
          label: t('ai_engineer.chips.debriefOverviewLabel'),
          prompt: t('ai_engineer.chips.debriefOverviewPrompt'),
        },
        {
          id: 'debrief-tyres',
          icon: <Gauge size={13} style={{ color: '#ff8000' }} />,
          label: t('ai_engineer.chips.debriefTyresLabel'),
          prompt: t('ai_engineer.chips.debriefTyresPrompt'),
        },
        {
          id: 'debrief-sectors',
          icon: <Zap size={13} style={{ color: '#00f2fe' }} />,
          label: t('ai_engineer.chips.debriefSectorsLabel'),
          prompt: t('ai_engineer.chips.debriefSectorsPrompt'),
        },
      ];
    }

    if (effectiveMode === 'live') {
      const isStandby =
        !liveContext ||
        liveContext.sessionType === 'Standby' ||
        !liveContext.liveSummary ||
        liveContext.liveSummary.includes('STANDBY') ||
        liveContext.liveSummary.includes('Waiting for live');
      if (isStandby) {
        return [
          {
            id: 'live-radio-check',
            icon: <Radio size={13} style={{ color: '#00f2fe' }} />,
            label: t('ai_engineer.chips.liveRadioCheckLabel'),
            prompt: t('ai_engineer.chips.liveRadioCheckPrompt'),
          },
          {
            id: 'live-prep',
            icon: <Gauge size={13} style={{ color: '#ffd200' }} />,
            label: t('ai_engineer.chips.livePrepLabel'),
            prompt: t('ai_engineer.chips.livePrepPrompt'),
          },
          {
            id: 'live-strategy-plan',
            icon: <Flag size={13} style={{ color: '#38ef7d' }} />,
            label: t('ai_engineer.chips.liveTacticalPlanLabel'),
            prompt: t('ai_engineer.chips.liveTacticalPlanPrompt'),
          },
        ];
      }
      return [
        {
          id: 'live-weather',
          icon: <CloudRain size={13} style={{ color: '#00f2fe' }} />,
          label: t('ai_engineer.chips.liveWeatherLabel'),
          prompt: t('ai_engineer.chips.liveWeatherPrompt'),
        },
        {
          id: 'live-strategy',
          icon: <Flag size={13} style={{ color: '#ffd200' }} />,
          label: t('ai_engineer.chips.liveStrategyLabel'),
          prompt: t('ai_engineer.chips.liveStrategyPrompt'),
        },
        {
          id: 'live-pace',
          icon: <Zap size={13} style={{ color: '#38ef7d' }} />,
          label: t('ai_engineer.chips.livePaceLabel'),
          prompt: t('ai_engineer.chips.livePacePrompt'),
        },
      ];
    }

    // Default general chips
    return [
      {
        id: 'gen-trail-braking',
        icon: <Gauge size={13} style={{ color: '#ff4b4b' }} />,
        label: t('ai_engineer.chips.genTrailBrakingLabel'),
        prompt: t('ai_engineer.chips.genTrailBrakingPrompt'),
      },
      {
        id: 'gen-tyre-management',
        icon: <Zap size={13} style={{ color: '#ffd200' }} />,
        label: t('ai_engineer.chips.genTyreManagementLabel'),
        prompt: t('ai_engineer.chips.genTyreManagementPrompt'),
      },
      {
        id: 'gen-ers',
        icon: <Cpu size={13} style={{ color: '#00f2fe' }} />,
        label: t('ai_engineer.chips.genErsLabel'),
        prompt: t('ai_engineer.chips.genErsPrompt'),
      },
    ];
  }, [effectiveMode, activeComparatorContext, hasLapsSelected, isZoomActive, sessionDebriefContext, liveContext, t]);

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
