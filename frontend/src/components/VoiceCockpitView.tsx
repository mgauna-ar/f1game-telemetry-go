import React, { useState } from 'react';
import { ShieldAlert, Flag } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

import { SAFETY_CAR_STATUS, F1_FORMATS, getTrackInfo, TRACK_NAMES } from '../constants/f1';
import { RadioSettingsPanel } from './RadioSettingsPanel';
import type { RadioSettingsTab } from './RadioSettingsPanel';
import { getPttHint } from '../utils/pttHint';
import { getPersonaInfo, getRadioVisualState } from '../utils/radioVisuals';
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
import { Panel } from './ui/Panel';
import styles from './VoiceCockpitView.module.css';

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
  const [settingsTab, setSettingsTab] = useState<RadioSettingsTab | undefined>(undefined);

  const openSettings = (tab?: RadioSettingsTab) => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const effectiveFormat = packetFormat || session?.PacketFormat;
  const is2026 = effectiveFormat === F1_FORMATS.FORMAT_2026;

  const trackInfo = session?.TrackId !== undefined ? getTrackInfo(session.TrackId) : null;
  const trackName =
    trackInfo?.name ||
    (session?.TrackId !== undefined
      ? TRACK_NAMES[session.TrackId] || t('live.cockpit.trackFallback', { id: session.TrackId })
      : t('live.cockpit.circuitFallback'));

  const persona = getPersonaInfo(radio.persona, radio.effectiveLanguage, t);
  const personaInfo = { name: persona.fullName, flag: persona.flag, role: persona.role };

  // Safety car, virtual safety car or red flag banner
  const renderSafetyCarBanner = () => {
    if (!session) return null;
    const banner =
      session.SafetyCarStatus === SAFETY_CAR_STATUS.FULL
        ? { kind: 'sc', icon: ShieldAlert, text: t('live.cockpit.bannerSafetyCar') }
        : session.SafetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL
          ? { kind: 'vsc', icon: ShieldAlert, text: t('live.cockpit.bannerVsc') }
          : session.NumRedFlagPeriods && session.NumRedFlagPeriods > 0
            ? { kind: 'red', icon: Flag, text: t('live.cockpit.bannerRedFlag') }
            : null;
    if (!banner) return null;
    const Icon = banner.icon;
    return (
      <div className={styles.banner} data-kind={banner.kind} role="status">
        <Icon size={20} aria-hidden="true" />
        <span>{banner.text}</span>
      </div>
    );
  };

  const radioState = getRadioVisualState(radio);
  const statusHeroText =
    radioState === 'off'
      ? t('ai_engineer.radio.radioOff')
      : radioState === 'transmitting'
        ? t('live.cockpit.transmitting')
        : radioState === 'processing'
          ? t('live.cockpit.processing')
          : radioState === 'speaking'
            ? t('live.cockpit.speaking', { name: personaInfo.name.toUpperCase() })
            : t('live.cockpit.standby');

  return (
    <div className={styles.container} data-testid="voice-cockpit-container">
      {/* Safety Car / Flag Alert Banner */}
      {renderSafetyCarBanner()}

      {/* Hero Voice Engineer Card */}
      <div className={styles.hero} data-state={radioState}>
        <HeroPersonaBadge
          personaInfo={personaInfo}
          statusHeroText={statusHeroText}
          radio={radio}
          volume={volume}
          setVolume={setVolume}
          onOpenSettings={() => openSettings()}
        />

        <RadioDialogueTranscript
          radio={radio}
          connected={Boolean(connected)}
          session={session || null}
          onSetUpPtt={() => openSettings('audio')}
        />
      </div>

      {/* Standby Telemetry Panel when waiting for session data, or Minimalist Vitals Grid when active */}
      {!session || !connected ? (
        <StandbyStatusCards
          connected={Boolean(connected)}
          personaName={personaInfo.name}
          effectiveLanguage={radio.effectiveLanguage}
          pttHint={getPttHint(radio, t).text}
        />
      ) : (
        <Panel as="div" padding="compact">
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
        </Panel>
      )}

      {/* Settings Modal */}
      <RadioSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        radio={radio}
        initialTab={settingsTab}
      />
    </div>
  );
});

VoiceCockpitView.displayName = 'VoiceCockpitView';
