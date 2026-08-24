import React, { useState, useEffect, useCallback } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useRaceEngineer } from '../context/RaceEngineerContext';
import {
  SAFETY_CAR_STATUS,
  DRIVER_STATUS,
  getTrackInfo,
  TRACK_NAMES,
  getSessionTypeName,
  LIVE_VIEW_MODES,
  STORAGE_KEY_LIVE_VIEW_MODE,
} from '../constants/f1';
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
import { useRadioController } from '../hooks/useRadioController';
import { useProactiveTelemetryRadio } from '../hooks/useProactiveTelemetryRadio';
import { formatProactiveFallbackSpeech } from '../utils/radioAudio';

const getDriverStatusLabel = (status?: number): string => {
  switch (status) {
    case DRIVER_STATUS.FLYING_LAP:
      return 'Flying Lap (Hot Lap)';
    case DRIVER_STATUS.OUT_LAP:
      return 'Out-Lap (Warming tyres / Building gap)';
    case DRIVER_STATUS.IN_LAP:
      return 'In-Lap (Returning to box)';
    case DRIVER_STATUS.IN_GARAGE:
      return 'In Garage / Pit Lane';
    default:
      return 'On Track';
  }
};

const formatSessionClock = (seconds?: number): string => {
  if (seconds === undefined || seconds === null || seconds <= 0) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const Dashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<LiveViewMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LIVE_VIEW_MODE);
      if (saved === LIVE_VIEW_MODES.COCKPIT || saved === LIVE_VIEW_MODES.DASHBOARD) {
        return saved;
      }
    } catch {
      // Ignore localStorage access errors
    }
    return LIVE_VIEW_MODES.DASHBOARD;
  });

  const handleViewModeChange = useCallback((mode: LiveViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY_LIVE_VIEW_MODE, mode);
    } catch {
      // Ignore localStorage write errors
    }
  }, []);

  const {
    session = null,
    participants = [],
    allLaps = [],
    allCarStatus = [],
    allCarDamage = [],
    allTelemetry = [],
    allTelemetry2 = [],
    telemetry = null,
    lap = null,
    carStatus = null,
    carDamage = null,
    events = [],
    clearEvents = () => {},
    connected = false,
    playerCarIndex = 0,
    selectedCarIndex = 0,
    setSelectedCarIndex = () => {},
    packetFormat,
  } = useTelemetry();

  const { setLiveContext, setContextMode } = useRaceEngineer();

  const getLiveTelemetrySummary = useCallback(() => {
    if (!session) {
      return 'STATUS: Pit lane / Garage. Waiting for live telemetry packet stream from game.';
    }

    const trackInfo = session.TrackId !== undefined ? getTrackInfo(session.TrackId) : null;
    const trackName = trackInfo?.name || (session.TrackId !== undefined ? (TRACK_NAMES[session.TrackId] || `Track #${session.TrackId}`) : 'F1 Circuit');
    const sessionName = getSessionTypeName(session.SessionType);
    const sessionTimeLeftFormatted = formatSessionClock(session.SessionTimeLeft);

    const scStatus =
      session.SafetyCarStatus === SAFETY_CAR_STATUS.FULL
        ? 'Full Safety Car'
        : session.SafetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL
        ? 'Virtual Safety Car'
        : session.NumRedFlagPeriods && session.NumRedFlagPeriods > 0
        ? 'Red Flag (Suspended)'
        : 'Track Clear (Green)';

    const playerLap = allLaps[playerCarIndex] || lap;
    const playerStatus = allCarStatus[playerCarIndex] || carStatus;
    const playerDamage = allCarDamage[playerCarIndex] || carDamage;
    const playerTelemetry = allTelemetry[playerCarIndex] || telemetry;
    const playerRunStatus = getDriverStatusLabel(playerLap?.DriverStatus);
    const lapValidity = playerLap?.CurrentLapInvalid === 1 ? 'INVALIDATED (Track Limits Exceeded)' : 'Valid';

    let tyreWearSummary = 'Tyres: Normal wear';
    if (playerDamage && playerDamage.TyresWear) {
      const wears = playerDamage.TyresWear.map((w: number) => Math.round(w || 0));
      const maxWear = Math.max(...wears);
      tyreWearSummary = `Tyres Wear: FL ${wears[0]}% | FR ${wears[1]}% | RL ${wears[2]}% | RR ${wears[3]}% (Peak: ${maxWear}%)`;
    }

    let tyreTempsSummary = '';
    if (playerTelemetry?.TyresSurfaceTemperature) {
      const surf = playerTelemetry.TyresSurfaceTemperature;
      const inner = playerTelemetry.TyresInnerTemperature || [];
      tyreTempsSummary = `- Tyre Surface Temps: FL ${Math.round(surf[0] || 0)}°C, FR ${Math.round(surf[1] || 0)}°C, RL ${Math.round(surf[2] || 0)}°C, RR ${Math.round(surf[3] || 0)}°C`;
      if (inner.length >= 4) {
        tyreTempsSummary += ` (Inner: FL ${Math.round(inner[0] || 0)}°C, FR ${Math.round(inner[1] || 0)}°C, RL ${Math.round(inner[2] || 0)}°C, RR ${Math.round(inner[3] || 0)}°C)`;
      }
    }

    let brakesSummary = '';
    if (playerTelemetry?.BrakesTemperature) {
      const brk = playerTelemetry.BrakesTemperature;
      brakesSummary = `- Brake Temps: FL ${Math.round(brk[0] || 0)}°C, FR ${Math.round(brk[1] || 0)}°C, RL ${Math.round(brk[2] || 0)}°C, RR ${Math.round(brk[3] || 0)}°C`;
    }

    let engineSummary = '';
    if (playerTelemetry?.EngineTemperature) {
      engineSummary = `- Engine Core Temp: ${Math.round(playerTelemetry.EngineTemperature)}°C`;
    }

    let ersSummary = '';
    if (playerStatus) {
      const storeEnergy = playerStatus.ERSStoreEnergy !== undefined ? playerStatus.ERSStoreEnergy : (playerStatus as any).ErsStoreEnergy;
      if (storeEnergy !== undefined) {
        const ersPct = Math.round((storeEnergy / 4000000) * 100);
        ersSummary = `- ERS Battery: ${ersPct}% | Deploy Mode: ${playerStatus.ERSDeployMode ?? 0}`;
      }
    }

    let fuelSummary = '';
    if (playerStatus && typeof playerStatus.FuelRemainingLaps === 'number') {
      fuelSummary = `- Fuel Remaining Delta: ${playerStatus.FuelRemainingLaps.toFixed(1)} laps (${(playerStatus.FuelInTank || 0).toFixed(1)} kg)`;
    }

    let aeroDamageSummary = '';
    if (playerDamage) {
      const flWing = Math.round(playerDamage.FrontLeftWingDamage || 0);
      const frWing = Math.round(playerDamage.FrontRightWingDamage || 0);
      const floor = Math.round((playerDamage.FloorDamage || 0) + (playerDamage.DiffuserDamage || 0));
      if (flWing > 0 || frWing > 0 || floor > 0) {
        aeroDamageSummary = `- Aero Damage: Front Wing L:${flWing}% R:${frWing}% | Floor/Diffuser: ${floor}%`;
      }
    }

    let warningsSummary = '';
    if (playerLap) {
      warningsSummary = `- Track Limits / Warnings: ${playerLap.CornerCuttingWarnings ?? playerLap.TotalWarnings ?? 0} warnings | Penalties: ${playerLap.Penalties ?? 0}s`;
    }

    const lines = [
      'LIVE PIT WALL TELEMETRY:',
      `- Track: ${trackName}`,
      `- Session: ${sessionName}`,
      `- Session Time Remaining: ${sessionTimeLeftFormatted}`,
      `- Safety Car Status: ${scStatus}`,
      `- Track Temp: ${session.TrackTemperature || 0}°C | Air Temp: ${session.AirTemperature || 0}°C`,
      `- Player Position: P${playerLap?.CarPosition || 1}`,
      `- Current Lap: ${playerLap?.CurrentLapNum || 1} / ${session.TotalLaps || 'N/A'}`,
      `- Driver Run Status: ${playerRunStatus}`,
      `- Current Lap Validity: ${lapValidity}`,
      `- ${tyreWearSummary} (Tyre age: ${playerStatus?.TyresAgeLaps || 0} laps)`,
    ];

    if (tyreTempsSummary) lines.push(tyreTempsSummary);
    if (brakesSummary) lines.push(brakesSummary);
    if (engineSummary) lines.push(engineSummary);
    if (ersSummary) lines.push(ersSummary);
    if (fuelSummary) lines.push(fuelSummary);
    if (aeroDamageSummary) lines.push(aeroDamageSummary);
    if (warningsSummary) lines.push(warningsSummary);

    return lines.join('\n');
  }, [session, allLaps, allCarStatus, allCarDamage, allTelemetry, telemetry, playerCarIndex, lap, carStatus, carDamage]);

  const radio = useRadioController({
    getLiveTelemetrySummary,
  });

  const handleProactiveAlert = useCallback(
    async (alertContext: string, _isCritical: boolean, emotion?: { rateModifier?: number; pitchModifier?: number }) => {
      // Instant zero-latency pit wall radio call with persona-specific phrasing & randomized variety
      const speech = formatProactiveFallbackSpeech(
        alertContext,
        radio.effectiveLanguage,
        radio.persona,
        radio.driverCallsign
      );

      if (speech) {
        radio.speakMessage(speech, false, emotion);
      }
    },
    [radio]
  );

  useProactiveTelemetryRadio({
    isRadioEnabled: radio.isRadioEnabled,
    session,
    lap: allLaps[playerCarIndex] || lap,
    allLaps,
    carDamage: allCarDamage[playerCarIndex] || carDamage,
    allCarDamage,
    carStatus: allCarStatus[playerCarIndex] || carStatus,
    allCarStatus,
    telemetry,
    telemetry2: allTelemetry2[playerCarIndex] || null,
    allTelemetry2,
    packetFormat,
    events,
    onTriggerAlert: handleProactiveAlert,
  });

  useEffect(() => {
    setContextMode('live');

    const updateContext = () => {
      const state = useTelemetryStore.getState();
      const currentSession = state.session;
      if (!state.connected || !currentSession) {
        setLiveContext({
          trackName: 'F1 Pit Wall',
          sessionType: 'Standby',
          safetyCarStatus: 'Track Clear (Green)',
          weatherSummary: 'Standby',
          liveSummary: 'STATUS: IN GARAGE / STANDBY. No live telemetry packets received from track yet. Live weather, tyre data, and telemetry stream are currently unavailable.',
        });
        return;
      }

      const trackInfo = currentSession.TrackId !== undefined ? getTrackInfo(currentSession.TrackId) : null;
      const trackName = trackInfo?.name || (currentSession.TrackId !== undefined ? (TRACK_NAMES[currentSession.TrackId] || `Track #${currentSession.TrackId}`) : 'F1 Circuit');
      const sessionName = getSessionTypeName(currentSession.SessionType);

      const weatherDesc =
        currentSession.WeatherForecastSamples && currentSession.WeatherForecastSamples.length > 0
          ? `Forecast: ${currentSession.WeatherForecastSamples.length} forecast updates available`
          : `Weather code: ${currentSession.Weather ?? 0}`;

      const scStatus =
        currentSession.SafetyCarStatus === SAFETY_CAR_STATUS.FULL
          ? 'Full Safety Car'
          : currentSession.SafetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL
          ? 'Virtual Safety Car'
          : currentSession.NumRedFlagPeriods && currentSession.NumRedFlagPeriods > 0
          ? 'Red Flag (Suspended)'
          : 'Track Clear (Green)';

      const liveSummary = getLiveTelemetrySummary();

      setLiveContext({
        trackName,
        sessionType: sessionName,
        safetyCarStatus: scStatus,
        weatherSummary: weatherDesc,
        liveSummary,
      });
    };

    updateContext();
    const interval = setInterval(updateContext, 1000);
    return () => clearInterval(interval);
  }, [setLiveContext, setContextMode, getLiveTelemetrySummary]);

  const playerLap = allLaps[playerCarIndex] || lap;
  const playerCarStatus = allCarStatus[playerCarIndex] || carStatus;
  const playerCarDamage = allCarDamage[playerCarIndex] || carDamage;
  const playerTelemetry = allTelemetry[playerCarIndex] || telemetry;
  const playerTelemetry2 = allTelemetry2[playerCarIndex] || null;

  if (!connected || !session) {
    return (
      <div className="voice-cockpit-layout" style={{ position: 'relative', width: '100%' }}>
        {/* Header with View Mode Switcher in Standby */}
        <SessionHeader
          session={session}
          connected={connected}
          packetFormat={packetFormat}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
        {viewMode === LIVE_VIEW_MODES.COCKPIT ? (
          <VoiceCockpitView
            radio={radio}
            session={session}
            lap={playerLap}
            carStatus={playerCarStatus}
            carDamage={playerCarDamage}
            telemetry={playerTelemetry}
            telemetry2={playerTelemetry2}
            packetFormat={packetFormat}
            connected={connected}
          />
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
      <div className="voice-cockpit-layout" style={{ position: 'relative', width: '100%' }}>
        <SessionHeader
          session={session}
          connected={connected}
          packetFormat={packetFormat}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
        <VoiceCockpitView
          radio={radio}
          session={session}
          lap={playerLap}
          carStatus={playerCarStatus}
          carDamage={playerCarDamage}
          telemetry={playerTelemetry}
          telemetry2={playerTelemetry2}
          packetFormat={packetFormat}
          connected={connected}
        />
      </div>
    );
  }

  // Full Race Control Dashboard View
  return (
    <div className="dashboard-grid race-control-dashboard">
      {/* Session Top Header */}
      <SessionHeader
        session={session}
        connected={connected}
        packetFormat={packetFormat}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Hero Upper Section: Full-Width Leaderboard Tower (Span 12) */}
      <div className="dash-hero-row" style={{ gridColumn: 'span 12' }}>
        <LeaderboardTower
          session={session}
          participants={participants}
          laps={allLaps}
          carStatuses={allCarStatus}
          telemetry2List={allTelemetry2}
          playerCarIndex={playerCarIndex}
          selectedCarIndex={selectedCarIndex}
          onSelectCar={setSelectedCarIndex}
        />
      </div>

      {/* Main 2x2 Race Control Hub */}
      <div className="race-control-hub-grid" style={{ gridColumn: 'span 12' }}>
        {/* Top-Left: Real-time Race Control & Incidents Stream */}
        <div className="hub-grid-cell">
          <RaceControlFeed events={events} session={session} onClearEvents={clearEvents} />
        </div>

        {/* Top-Right: Weather Radar & Track Evolution */}
        <div className="hub-grid-cell">
          <LiveWeatherRadar session={session} />
        </div>

        {/* Bottom-Left: Field Tyre Matrix & Pit Strategy Windows */}
        <div className="hub-grid-cell">
          <LivePitStrategy
            session={session}
            participants={participants}
            laps={allLaps}
            carStatuses={allCarStatus}
            selectedCarIndex={selectedCarIndex}
            playerCarIndex={playerCarIndex}
            onSelectCar={setSelectedCarIndex}
          />
        </div>

        {/* Bottom-Right: Live Sector Performance & Speed Traps */}
        <div className="hub-grid-cell">
          <LiveSectorTracker
            participants={participants}
            laps={allLaps}
            selectedCarIndex={selectedCarIndex}
            playerCarIndex={playerCarIndex}
          />
        </div>
      </div>

      {/* Floating Interactive Voice Radio HUD */}
      <LiveRadioHUD radio={radio} />
    </div>
  );
};

