import React, { useState, useEffect, useCallback, useRef } from 'react';
import { connectTelemetryWebSocket } from '../store/useTelemetryStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useRaceEngineerActions } from '../context/RaceEngineerContext';
import { LIVE_VIEW_MODES, STORAGE_KEY_LIVE_VIEW_MODE } from '../constants/f1';

import type { LiveViewMode } from '../constants/f1';
import { SessionHeader } from './SessionHeader';
import { LeaderboardTower } from './LeaderboardTower';
import { RaceControlFeed } from './RaceControlFeed';
import { LiveWeatherRadar } from './LiveWeatherRadar';
import { LivePitStrategy } from './LivePitStrategy';
import { LiveSectorTracker } from './LiveSectorTracker';
import { WaitingForData } from './WaitingForData';
import { LiveRadioHUD } from './LiveRadioHUD';
import { VoiceCockpitView } from './VoiceCockpitView';
import { LiveDocumentTitle } from './LiveDocumentTitle';
import { useRadioController } from '../hooks/useRadioController';
import { useProactiveTelemetryRadio } from '../hooks/useProactiveTelemetryRadio';
import { getProactiveRadioSpeech } from '../utils/radioPhrases';
import type { RadioAlertPayload } from '../types/telemetry';
import { storage } from '../utils/storage';
import styles from './Dashboard.module.css';

export const Dashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<LiveViewMode>(() => {
    const saved = storage.get<string>(STORAGE_KEY_LIVE_VIEW_MODE, LIVE_VIEW_MODES.DASHBOARD);
    return saved === LIVE_VIEW_MODES.COCKPIT ? LIVE_VIEW_MODES.COCKPIT : LIVE_VIEW_MODES.DASHBOARD;
  });

  const handleViewModeChange = useCallback((mode: LiveViewMode) => {
    setViewMode(mode);
    storage.set(STORAGE_KEY_LIVE_VIEW_MODE, mode);
  }, []);

  useEffect(() => {
    const disconnect = connectTelemetryWebSocket();
    return () => {
      disconnect();
    };
  }, []);

  const session = useSessionStatusStore((s) => s.session);
  const connected = useSessionStatusStore((s) => s.connected);
  const packetFormat = useSessionStatusStore((s) => s.packetFormat);

  const { setContextMode } = useRaceEngineerActions();

  // The live chat sends no telemetry: the server builds the race briefing from its own feed.
  useEffect(() => {
    setContextMode('live');
  }, [setContextMode]);

  const radio = useRadioController();

  const radioRef = useRef(radio);
  radioRef.current = radio;

  const handleProactiveAlert = useCallback((payload: RadioAlertPayload) => {
    const r = radioRef.current;
    // Instant pit wall radio call with persona-specific phrasing & randomized variety
    const speech = getProactiveRadioSpeech(payload.category, r.effectiveLanguage, r.persona, r.driverCallsign);
    if (speech) {
      r.speakMessage(speech, payload.isCritical, payload.emotion);
    }
  }, []);

  useProactiveTelemetryRadio({
    isRadioEnabled: radio.isRadioEnabled,
    onTriggerAlert: handleProactiveAlert,
  });

  if (!connected || !session) {
    return (
      <div className={styles.cockpit}>
        {/* Header with View Mode Switcher in Standby */}
        <LiveDocumentTitle />
        <SessionHeader
          session={session}
          connected={connected}
          packetFormat={packetFormat}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
        {viewMode === LIVE_VIEW_MODES.COCKPIT ? (
          <VoiceCockpitView radio={radio} />
        ) : (
          <>
            <WaitingForData connected={connected} />
            <LiveRadioHUD radio={radio} />
          </>
        )}
      </div>
    );
  }

  // Voice Cockpit View (0% unneeded widget DOM/Canvas overhead for sim racing)
  if (viewMode === LIVE_VIEW_MODES.COCKPIT) {
    return (
      <div className={styles.cockpit}>
        <LiveDocumentTitle />
        <SessionHeader
          session={session}
          connected={connected}
          packetFormat={packetFormat}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
        <VoiceCockpitView radio={radio} />
      </div>
    );
  }

  // Full Race Control Dashboard View
  return (
    <div className={styles.dashboard}>
      {/* Session Top Header */}
      <LiveDocumentTitle />
      <SessionHeader
        session={session}
        connected={connected}
        packetFormat={packetFormat}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Hero Upper Section: Full-Width Leaderboard Tower (Span 12) */}
      <LeaderboardTower className={styles.fullRow} />

      {/* Race control hub: feed and weather on top, pit strategy and sectors below */}
      <div className={`${styles.fullRow} ${styles.hub}`}>
        <RaceControlFeed className={styles.hubCard} />
        <LiveWeatherRadar className={styles.hubCard} />
        <LivePitStrategy className={styles.hubCard} />
        <LiveSectorTracker className={styles.hubCard} />
      </div>

      {/* Floating Interactive Voice Radio HUD */}
      <LiveRadioHUD radio={radio} />
    </div>
  );
};
