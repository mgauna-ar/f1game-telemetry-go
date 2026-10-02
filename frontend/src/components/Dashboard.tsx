import React, { useEffect, useCallback, useRef, useState } from 'react';
import { connectTelemetryWebSocket } from '../store/useTelemetryStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import {
  LIVE_VIEW_MODES,
  RACE_CONTROL_LAYOUTS,
  type LiveViewMode,
} from '../constants/f1';
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
import { DriverGlance } from './driver/DriverGlance';
import { YourCarPanel } from './race_control/YourCarPanel';
import { BattlePanel } from './race_control/BattlePanel';
import { TrackPositionStrip } from './race_control/TrackPositionStrip';
import { CarDetailDrawer } from './race_control/CarDetailDrawer';
import { SegmentedControl } from './ui/SegmentedControl';
import { useI18n } from '../context/I18nContext';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import { HUB_PANELS, type HubPanel } from '../utils/raceControl';
import { useDevicePreferencesStore } from '../store/useDevicePreferencesStore';
import { useRadioController } from '../hooks/useRadioController';
import { useProactiveTelemetryRadio } from '../hooks/useProactiveTelemetryRadio';
import { getProactiveRadioSpeech } from '../utils/radioPhrases';
import type { RadioAlertPayload } from '../types/telemetry';
import { navigate, useRoute } from '../router/router';
import { buildPath, storeLiveMode } from '../router/routes';
import styles from './Dashboard.module.css';

export const Dashboard: React.FC = () => {
  // The mode is in the URL (/live/dashboard, /live/cockpit); the last one is kept for /live.
  const route = useRoute();
  const viewMode: LiveViewMode = route.page === 'live' ? route.mode : LIVE_VIEW_MODES.DASHBOARD;

  useEffect(() => {
    storeLiveMode(viewMode);
  }, [viewMode]);

  const handleViewModeChange = useCallback((mode: LiveViewMode) => {
    navigate(buildPath({ page: 'live', mode }), { replace: true });
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

  const radio = useRadioController();
  const { t } = useI18n();

  // Race Control: a tower, strip or battle click picks the car and opens its drawer
  const setSelectedCarIndex = useTelemetryDataStore((s) => s.setSelectedCarIndex);
  const [drawerCar, setDrawerCar] = useState<number | null>(null);
  const openCar = useCallback(
    (carIndex: number) => {
      setSelectedCarIndex(carIndex);
      setDrawerCar(carIndex);
    },
    [setSelectedCarIndex]
  );
  const closeCar = useCallback(() => setDrawerCar(null), []);

  const layout = useDevicePreferencesStore((s) => s.raceControlLayout);
  const changeLayout = useDevicePreferencesStore((s) => s.setRaceControlLayout);

  const radioRef = useRef(radio);
  radioRef.current = radio;

  const handleProactiveAlert = useCallback((payload: RadioAlertPayload) => {
    const r = radioRef.current;
    // Instant pit wall radio call with persona-specific phrasing & randomized variety
    const speech = getProactiveRadioSpeech(payload.category, r.effectiveLanguage, r.persona, r.driverCallsign);
    if (speech) {
      r.speakMessage(speech, payload.isCritical, payload.emotion, payload.ttlMs);
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

  // Driver view: a phone on the rig, big numbers and nothing else
  if (viewMode === LIVE_VIEW_MODES.DRIVER) {
    return (
      <div className={styles.driverPage}>
        <LiveDocumentTitle />
        <DriverGlance viewMode={viewMode} onViewModeChange={handleViewModeChange} />
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

      <YourCarPanel className={styles.fullRow} />

      {/* The player's fight next to where everyone is round the lap */}
      <div className={`${styles.fullRow} ${styles.battleRow}`}>
        <BattlePanel onSelectCar={openCar} />
        <TrackPositionStrip onSelectCar={openCar} />
      </div>

      <LeaderboardTower className={styles.fullRow} onSelectCar={openCar} />

      {/* Race control hub: its panels as the chosen layout places them */}
      <div className={`${styles.fullRow} ${styles.hubToolbar}`}>
        <SegmentedControl
          aria-label={t('live.raceControlView.layout')}
          size="xs"
          value={layout}
          onChange={changeLayout}
          options={Object.values(RACE_CONTROL_LAYOUTS).map((value) => ({
            value,
            label: t(`live.raceControlView.layouts.${value}`),
            title: t(`live.raceControlView.layoutTitles.${value}`),
          }))}
        />
      </div>
      <div className={`${styles.fullRow} ${styles.hub}`} data-layout={layout} data-testid="race-control-hub">
        {HUB_PANELS[layout].map((panel) => (
          <HubPanelView key={panel} panel={panel} />
        ))}
      </div>

      <CarDetailDrawer carIndex={drawerCar} onClose={closeCar} />

      {/* Floating Interactive Voice Radio HUD */}
      <LiveRadioHUD radio={radio} />
    </div>
  );
};

const HubPanelView: React.FC<{ panel: HubPanel }> = ({ panel }) => {
  switch (panel) {
    case 'feed':
      return <RaceControlFeed className={styles.hubCard} />;
    case 'weather':
      return <LiveWeatherRadar className={styles.hubCard} />;
    case 'pit':
      return <LivePitStrategy className={styles.hubCard} />;
    case 'sectors':
      return <LiveSectorTracker className={styles.hubCard} />;
  }
};
