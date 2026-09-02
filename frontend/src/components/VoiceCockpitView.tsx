import React, { useState } from 'react';
import { ShieldAlert, Flag } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

import {
  RADIO_PERSONAS,
  SAFETY_CAR_STATUS,
  F1_FORMATS,
  getTrackInfo,
  TRACK_NAMES,
} from '../constants/f1';
import { RadioSettingsPanel } from './RadioSettingsPanel';
import { HeroPersonaBadge } from './cockpit/HeroPersonaBadge';
import { RadioDialogueTranscript } from './cockpit/RadioDialogueTranscript';
import { VitalTelemetryStrip } from './cockpit/VitalTelemetryStrip';
import { StandbyStatusCards } from './cockpit/StandbyStatusCards';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';
import type {
  SessionData,
  LapData,
  CarStatusData,
  CarDamageData,
  CarTelemetryData,
  CarTelemetry2Data,
} from '../types/telemetry';

import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';

export interface VoiceCockpitViewProps {
  radio: UseRadioControllerReturn;
  session?: SessionData | null;
  lap?: LapData | null;
  carStatus?: CarStatusData | null;
  carDamage?: CarDamageData | null;
  telemetry?: CarTelemetryData | null;
  telemetry2?: CarTelemetry2Data | null;
  packetFormat?: number | null;
  connected?: boolean;
}

export const VoiceCockpitView: React.FC<VoiceCockpitViewProps> = React.memo((props) => {
  const storeSession = useSessionStatusStore((s) => s.session);
  const storePacketFormat = useSessionStatusStore((s) => s.packetFormat);
  const storeConnected = useSessionStatusStore((s) => s.connected);

  const storePlayerIndex = useTelemetryDataStore((s) => s.playerCarIndex);
  const storeLap = useTelemetryDataStore((s) => s.allLaps[storePlayerIndex] || null);
  const storeCarStatus = useTelemetryDataStore((s) => s.allCarStatus[storePlayerIndex] || null);
  const storeCarDamage = useTelemetryDataStore((s) => s.allCarDamage[storePlayerIndex] || null);
  const storeTelemetry = useTelemetryDataStore((s) => s.allTelemetry[storePlayerIndex] || null);
  const storeTelemetry2 = useTelemetryDataStore((s) => s.allTelemetry2[storePlayerIndex] || null);

  const volume = useRadioSettingsStore((s) => s.volume);
  const setVolume = useRadioSettingsStore((s) => s.setVolume);

  const radio = props.radio;
  const session = props.session !== undefined ? props.session : storeSession;
  const lap = props.lap !== undefined ? props.lap : storeLap;
  const carStatus = props.carStatus !== undefined ? props.carStatus : storeCarStatus;
  const carDamage = props.carDamage !== undefined ? props.carDamage : storeCarDamage;
  const telemetry = props.telemetry !== undefined ? props.telemetry : storeTelemetry;
  const telemetry2 = props.telemetry2 !== undefined ? props.telemetry2 : storeTelemetry2;
  const packetFormat = props.packetFormat !== undefined ? props.packetFormat : storePacketFormat;
  const connected = props.connected !== undefined ? props.connected : storeConnected;

  const { t } = useI18n();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const effectiveFormat = packetFormat || session?.PacketFormat;
  const is2026 = effectiveFormat === F1_FORMATS.FORMAT_2026;

  const trackInfo = session?.TrackId !== undefined ? getTrackInfo(session.TrackId) : null;
  const trackName =
    trackInfo?.name ||
    (session?.TrackId !== undefined ? TRACK_NAMES[session.TrackId] || `Track #${session.TrackId}` : 'F1 Circuit');

  const getPersonaLabel = () => {
    const langFlag = radio.effectiveLanguage === 'es' ? '🇦🇷' : '🇬🇧';
    switch (radio.persona) {
      case RADIO_PERSONAS.COLAPINTO:
        return { name: 'Franco Colapinto', flag: langFlag, role: 'Race Engineer' };
      case RADIO_PERSONAS.CUSTOM:
        return { name: t('ai_engineer.personas.custom.name'), flag: '⚙️', role: 'Custom Pit Wall' };
      case RADIO_PERSONAS.BONO:
      default:
        return { name: 'Peter "Bono" Bonnington', flag: langFlag, role: 'Senior Race Engineer' };
    }
  };

  const personaInfo = getPersonaLabel();

  // Safety Car / Flag banner determination
  const renderSafetyCarBanner = () => {
    if (!session) return null;

    if (session.SafetyCarStatus === SAFETY_CAR_STATUS.FULL) {
      return (
        <div className="voice-cockpit-flag-banner sc-full">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
          <span className="banner-text">SAFETY CAR DEPLOYED — DELTA POSITIVE</span>
        </div>
      );
    }
    if (session.SafetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL) {
      return (
        <div className="voice-cockpit-flag-banner sc-vsc">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
          <span className="banner-text">VIRTUAL SAFETY CAR — MAINTAIN DELTA</span>
        </div>
      );
    }
    if (session.NumRedFlagPeriods && session.NumRedFlagPeriods > 0) {
      return (
        <div className="voice-cockpit-flag-banner sc-red">
          <Flag className="w-5 h-5 animate-pulse" />
          <span className="banner-text">RED FLAG — RETURN TO PIT LANE</span>
        </div>
      );
    }
    return null;
  };

  // Radio active status pill
  let stateClass = 'state-idle';
  let statusHeroText = t('live.cockpit.standby');

  if (!radio.isRadioEnabled) {
    stateClass = 'state-off';
    statusHeroText = 'RADIO POWER OFF';
  } else if (radio.radioState === 'transmitting') {
    stateClass = 'state-transmitting';
    statusHeroText = t('live.cockpit.transmitting');
  } else if (radio.radioState === 'processing') {
    stateClass = 'state-processing';
    statusHeroText = t('live.cockpit.processing');
  } else if (radio.radioState === 'speaking') {
    stateClass = 'state-speaking';
    statusHeroText = t('live.cockpit.speaking', { name: personaInfo.name.toUpperCase() });
  }

  return (
    <div className="voice-cockpit-container" data-testid="voice-cockpit-container">
      {/* Safety Car / Flag Alert Banner */}
      {renderSafetyCarBanner()}

      {/* Hero Voice Engineer Card */}
      <div className={`voice-cockpit-hero-card ${stateClass}`}>
        <HeroPersonaBadge
          personaInfo={personaInfo}
          statusHeroText={statusHeroText}
          radio={radio}
          volume={volume}
          setVolume={setVolume}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <RadioDialogueTranscript
          radio={radio}
          connected={Boolean(connected)}
          session={session || null}
        />
      </div>

      {/* Standby Telemetry Panel when waiting for session data, or Minimalist Vitals Grid when active */}
      {!session || !connected ? (
        <StandbyStatusCards
          connected={Boolean(connected)}
          personaName={personaInfo.name}
          effectiveLanguage={radio.effectiveLanguage}
          mappedKey={radio.mappedKey}
        />
      ) : (
        <VitalTelemetryStrip
          session={session}
          lap={lap}
          carStatus={carStatus}
          carDamage={carDamage}
          telemetry={telemetry}
          telemetry2={telemetry2}
          trackName={trackName}
          is2026={is2026}
        />
      )}

      {/* Settings Modal */}
      <RadioSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        radio={radio}
      />
    </div>
  );
});

VoiceCockpitView.displayName = 'VoiceCockpitView';
