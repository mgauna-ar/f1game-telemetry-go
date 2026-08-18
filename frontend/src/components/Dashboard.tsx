import React, { useEffect } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { useRaceEngineer } from '../context/RaceEngineerContext';
import { SessionHeader } from './SessionHeader';
import { LeaderboardTower } from './LeaderboardTower';
import { RaceControlFeed } from './RaceControlFeed';
import { LiveWeatherRadar } from './LiveWeatherRadar';
import { LivePitStrategy } from './LivePitStrategy';
import { LiveSectorTracker } from './LiveSectorTracker';
import { WaitingForData } from './WaitingForData';

export const Dashboard: React.FC = () => {
  const {
    session = null,
    participants = [],
    allLaps = [],
    allCarStatus = [],
    allTelemetry2 = [],
    events = [],
    clearEvents = () => {},
    connected = false,
    playerCarIndex = 0,
    selectedCarIndex = 0,
    setSelectedCarIndex = () => {},
    packetFormat,
  } = useTelemetry();

  const { setLiveContext, setContextMode } = useRaceEngineer();

  useEffect(() => {
    if (connected && session) {
      const weatherDesc =
        session.WeatherForecastSamples && session.WeatherForecastSamples.length > 0
          ? `Forecast: ${session.WeatherForecastSamples.length} forecast updates available`
          : `Weather code: ${session.Weather ?? 0}`;

      const scStatus =
        session.SafetyCarStatus === 1
          ? 'Full Safety Car'
          : session.SafetyCarStatus === 2
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
    </div>
  );
};
