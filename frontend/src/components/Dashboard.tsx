import React, { useEffect, useCallback } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { useRaceEngineer } from '../context/RaceEngineerContext';
import { SAFETY_CAR_STATUS } from '../constants/f1';
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
    if (!session) return '';
    const scStatus =
      session.SafetyCarStatus === SAFETY_CAR_STATUS.FULL
        ? 'Full Safety Car'
        : session.SafetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL
        ? 'Virtual Safety Car'
        : 'Track Clear (Green)';

    const playerLap = allLaps[playerCarIndex] || lap;
    const playerStatus = allCarStatus[playerCarIndex] || carStatus;
    const playerDamage = allCarDamage[playerCarIndex] || carDamage;

    let tyreWearSummary = 'Tyre wear normal';
    if (playerDamage && playerDamage.TyresWear) {
      const maxWear = Math.round(Math.max(...playerDamage.TyresWear));
      tyreWearSummary = `Max tyre wear: ${maxWear}%`;
    }

    return `LIVE PIT WALL TELEMETRY:
- Track ID: #${session.TrackId ?? 0}
- Safety Car Status: ${scStatus}
- Track Temp: ${session.TrackTemperature || 0}°C | Air Temp: ${session.AirTemperature || 0}°C
- Player Position: P${playerLap?.CarPosition || 1}
- Current Lap: ${playerLap?.CurrentLapNum || 1} / ${session.TotalLaps || 'N/A'}
- ${tyreWearSummary} (Tyre age: ${playerStatus?.TyresAgeLaps || 0} laps)
`;
  }, [session, allLaps, allCarStatus, allCarDamage, playerCarIndex, lap, carStatus, carDamage]);

  const radio = useRadioController({
    getLiveTelemetrySummary,
  });

  const handleProactiveAlert = useCallback(
    async (alertContext: string, isCritical: boolean) => {
      // Trigger voice transmission with LLM generation
      const liveSummary = getLiveTelemetrySummary();

      let aiProvider = 'gemini';
      let aiApiKey = '';
      let aiModel = 'gemini-flash-lite-latest';
      let aiBaseUrl = '';

      try {
        const savedConfig = localStorage.getItem('f1_ai_engineer_config');
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig);
          if (parsed.provider) aiProvider = parsed.provider;
          if (parsed.providerKeys?.[aiProvider]) {
            aiApiKey = parsed.providerKeys[aiProvider];
          } else if (parsed.apiKey) {
            aiApiKey = parsed.apiKey;
          }
          if (parsed.providerModels?.[aiProvider]) {
            aiModel = parsed.providerModels[aiProvider];
          } else if (parsed.model) {
            aiModel = parsed.model;
          }
          if (parsed.baseUrl) aiBaseUrl = parsed.baseUrl;
        }
      } catch {}

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            persona: radio.persona,
            language: radio.effectiveLanguage,
            provider: aiProvider,
            api_key: aiApiKey,
            model: aiModel,
            base_url: aiBaseUrl,
            messages: [{ role: 'user', content: alertContext }],
            context: {
              context_mode: 'live',
              live_summary: liveSummary,
              custom_persona_prompt: radio.customPrompt || undefined,
            },
          }),
        });

        if (!response.ok) return;

        let fullText = '';
        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let done = false;
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const parsed = JSON.parse(line.substring(6));
                    if (parsed.text) fullText += parsed.text;
                    else if (parsed.content) fullText += parsed.content;
                  } catch {}
                }
              }
            }
          }
        } else {
          const json = await response.json();
          fullText = json.content || json.text || '';
        }

        const cleaned = fullText.trim();
        if (cleaned) {
          await radio.speakMessage(cleaned, isCritical);
        }
      } catch {
        // Suppress proactive fetch error
      }
    },
    [radio, getLiveTelemetrySummary]
  );

  useProactiveTelemetryRadio({
    enabled: connected && !!session,
    isRadioEnabled: radio.isRadioEnabled,
    playerCarIndex,
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
- Track ID: #${session.TrackId ?? 0}
- Session Type: #${session.SessionType ?? 0}
- Safety Car Status: ${scStatus}
- Track Temp: ${session.TrackTemperature || 0}°C | Air Temp: ${session.AirTemperature || 0}°C
- ${weatherDesc}
- Active Cars: ${participants.length} drivers
- Player Car Index: #${playerCarIndex + 1}
- Selected Car Focus: #${selectedCarIndex + 1}
`;

      setLiveContext({
        trackName: `Track #${session.TrackId ?? 0}`,
        sessionType: 'Live Race',
        safetyCarStatus: scStatus,
        weatherSummary: weatherDesc,
        liveSummary,
      });
      setContextMode('live');
    }
  }, [connected, session, participants, playerCarIndex, selectedCarIndex, setLiveContext, setContextMode]);

  if (!connected || !session) {
    return <WaitingForData connected={connected} />;
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
