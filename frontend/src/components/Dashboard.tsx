import React, { useEffect, useCallback } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { useRaceEngineer } from '../context/RaceEngineerContext';
import {
  SAFETY_CAR_STATUS,
  DRIVER_STATUS,
  getTrackInfo,
  TRACK_NAMES,
  getSessionTypeName,
} from '../constants/f1';
import { SessionHeader } from './SessionHeader';
import { LeaderboardTower } from './LeaderboardTower';
import { RaceControlFeed } from './RaceControlFeed';
import { LiveWeatherRadar } from './LiveWeatherRadar';
import { LivePitStrategy } from './LivePitStrategy';
import { LiveSectorTracker } from './LiveSectorTracker';
import { WaitingForData } from './WaitingForData';
import { LiveRadioHUD } from './LiveRadioHUD';
import { useRadioController } from '../hooks/useRadioController';
import { useProactiveTelemetryRadio } from '../hooks/useProactiveTelemetryRadio';

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
  const {
    session = null,
    participants = [],
    allLaps = [],
    allCarStatus = [],
    allCarDamage = [],
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
        : 'Track Clear (Green)';

    const playerLap = allLaps[playerCarIndex] || lap;
    const playerStatus = allCarStatus[playerCarIndex] || carStatus;
    const playerDamage = allCarDamage[playerCarIndex] || carDamage;
    const playerRunStatus = getDriverStatusLabel(playerLap?.DriverStatus);
    const lapValidity = playerLap?.CurrentLapInvalid === 1 ? 'INVALIDATED (Track Limits Exceeded)' : 'Valid';

    let tyreWearSummary = 'Tyre wear normal';
    if (playerDamage && playerDamage.TyresWear) {
      const maxWear = Math.round(Math.max(...playerDamage.TyresWear));
      tyreWearSummary = `Max tyre wear: ${maxWear}%`;
    }

    return `LIVE PIT WALL TELEMETRY:
- Track: ${trackName}
- Session: ${sessionName}
- Session Time Remaining: ${sessionTimeLeftFormatted}
- Safety Car Status: ${scStatus}
- Track Temp: ${session.TrackTemperature || 0}°C | Air Temp: ${session.AirTemperature || 0}°C
- Player Position: P${playerLap?.CarPosition || 1}
- Current Lap: ${playerLap?.CurrentLapNum || 1} / ${session.TotalLaps || 'N/A'}
- Driver Run Status: ${playerRunStatus}
- Current Lap Validity: ${lapValidity}
- ${tyreWearSummary} (Tyre age: ${playerStatus?.TyresAgeLaps || 0} laps)
`;
  }, [session, allLaps, allCarStatus, allCarDamage, playerCarIndex, lap, carStatus, carDamage]);

  const radio = useRadioController({
    getLiveTelemetrySummary,
  });

  const handleProactiveAlert = useCallback(
    async (alertContext: string, _isCritical: boolean) => {
      // Trigger voice transmission with LLM generation
      const liveSummary = getLiveTelemetrySummary();

      let aiProvider = 'gemini';
      let aiApiKey = '';
      let aiModel = 'gemini-flash-lite-latest';
      let aiBaseUrl = '';

      try {
        const storedProvider = localStorage.getItem('f1_ai_provider');
        const storedKey = localStorage.getItem('f1_ai_api_key');
        const storedModel = localStorage.getItem('f1_ai_model');
        const storedBaseUrl = localStorage.getItem('f1_ai_base_url');

        if (storedProvider) aiProvider = storedProvider;
        if (storedKey) aiApiKey = storedKey;
        if (storedModel) aiModel = storedModel;
        if (storedBaseUrl) aiBaseUrl = storedBaseUrl;
      } catch {}

      const trackInfo = session?.TrackId !== undefined ? getTrackInfo(session.TrackId) : null;
      const trackName = trackInfo?.name || (session?.TrackId !== undefined ? (TRACK_NAMES[session.TrackId] || `Track #${session.TrackId}`) : 'F1 Circuit');
      const sessionName = getSessionTypeName(session?.SessionType);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: aiProvider,
            api_key: aiApiKey,
            model: aiModel,
            base_url: aiBaseUrl,
            persona: radio.persona,
            language: radio.effectiveLanguage,
            messages: [
              {
                role: 'user',
                content: alertContext,
              },
            ],
            context: {
              context_mode: 'live',
              track_name: trackName,
              session_type: sessionName,
              live_summary: liveSummary,
              custom_persona_prompt: radio.customPrompt || undefined,
              driver_callsign: radio.driverCallsign || undefined,
            },
          }),
        });

        if (!response.ok) return;

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.delta) {
                  fullText += parsed.delta;
                }
              } catch {}
            }
          }
        }

        if (fullText.trim()) {
          radio.speakMessage(fullText.trim());
        }
      } catch (err) {
        console.warn('Proactive radio call generation failed:', err);
      }
    },
    [getLiveTelemetrySummary, radio, session]
  );

  useProactiveTelemetryRadio({
    session,
    lap: allLaps[playerCarIndex] || lap,
    allLaps,
    carDamage: allCarDamage[playerCarIndex] || carDamage,
    allCarDamage,
    carStatus: allCarStatus[playerCarIndex] || carStatus,
    allCarStatus,
    telemetry,
    events,
    onTriggerAlert: handleProactiveAlert,
  });

  useEffect(() => {
    if (connected && session) {
      const trackInfo = session.TrackId !== undefined ? getTrackInfo(session.TrackId) : null;
      const trackName = trackInfo?.name || (session.TrackId !== undefined ? (TRACK_NAMES[session.TrackId] || `Track #${session.TrackId}`) : 'F1 Circuit');
      const sessionName = getSessionTypeName(session.SessionType);

      const weatherDesc =
        session.WeatherForecastSamples && session.WeatherForecastSamples.length > 0
          ? `Forecast: ${session.WeatherForecastSamples.length} forecast updates available`
          : `Weather code: ${session.Weather ?? 0}`;

      const scStatus =
        session.SafetyCarStatus === SAFETY_CAR_STATUS.FULL
          ? 'Full Safety Car'
          : session.SafetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL
          ? 'Virtual Safety Car'
          : 'Track Clear (Green)';

      const liveSummary = `LIVE PIT WALL TELEMETRY:
- Track: ${trackName}
- Session: ${sessionName}
- Safety Car Status: ${scStatus}
- Track Temp: ${session.TrackTemperature || 0}°C | Air Temp: ${session.AirTemperature || 0}°C
- ${weatherDesc}
- Active Cars: ${participants.length} drivers
- Player Car Index: #${playerCarIndex + 1}
- Selected Car Focus: #${selectedCarIndex + 1}
`;

      setLiveContext({
        trackName,
        sessionType: sessionName,
        safetyCarStatus: scStatus,
        weatherSummary: weatherDesc,
        liveSummary,
      });
      setContextMode('live');
    }
  }, [connected, session, participants, playerCarIndex, selectedCarIndex, setLiveContext, setContextMode]);

  if (!connected || !session) {
    return (
      <div className="telemetry-waiting-wrapper" style={{ position: 'relative', width: '100%' }}>
        <WaitingForData connected={connected} />
        <LiveRadioHUD radio={radio} />
      </div>
    );
  }

  return (
    <div className="dashboard-grid race-control-dashboard">
      {/* Session Top Header */}
      <SessionHeader session={session} connected={connected} packetFormat={packetFormat} />

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
