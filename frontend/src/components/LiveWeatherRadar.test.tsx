import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiveWeatherRadar } from './LiveWeatherRadar';
import type { SessionData } from '../hooks/useTelemetry';

describe('LiveWeatherRadar', () => {
  const mockSession: SessionData = {
    Weather: 0,
    TrackTemperature: 34,
    AirTemperature: 25,
    TotalLaps: 58,
    TrackLength: 5303,
    SessionType: 15,
    TrackId: 0,
    SessionTimeLeft: 3600,
    SessionDuration: 7200,
    SafetyCarStatus: 0,
    WeatherForecastSamples: [
      {
        SessionType: 15,
        TimeOffset: 0,
        Weather: 0,
        TrackTemperature: 34,
        TrackTemperatureChange: 2,
        AirTemperature: 25,
        AirTemperatureChange: 2,
        RainPercentage: 0,
      },
      {
        SessionType: 15,
        TimeOffset: 5,
        Weather: 1,
        TrackTemperature: 33,
        TrackTemperatureChange: 1,
        AirTemperature: 25,
        AirTemperatureChange: 2,
        RainPercentage: 10,
      },
      {
        SessionType: 15,
        TimeOffset: 15,
        Weather: 2,
        TrackTemperature: 31,
        TrackTemperatureChange: 1,
        AirTemperature: 24,
        AirTemperatureChange: 1,
        RainPercentage: 25,
      },
      {
        SessionType: 15,
        TimeOffset: 30,
        Weather: 3,
        TrackTemperature: 28,
        TrackTemperatureChange: 1,
        AirTemperature: 22,
        AirTemperatureChange: 1,
        RainPercentage: 65,
      },
    ],
  };

  it('renders weather radar title and strategy advice', () => {
    render(<LiveWeatherRadar session={mockSession} />);
    expect(screen.getByText(/Weather Radar & Track Evolution/i)).toBeInTheDocument();
    expect(screen.getByText(/STRATEGY:/i)).toBeInTheDocument();
  });

  it('displays current sky conditions and temperatures', () => {
    render(<LiveWeatherRadar session={mockSession} />);
    expect(screen.getAllByText(/Clear \/ Sunny/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/34/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/25/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders timeline forecast offsets', () => {
    render(<LiveWeatherRadar session={mockSession} />);
    expect(screen.getByText('NOW')).toBeInTheDocument();
    expect(screen.getByText('+5 MIN')).toBeInTheDocument();
    expect(screen.getByText('+15 MIN')).toBeInTheDocument();
    expect(screen.getByText('+30 MIN')).toBeInTheDocument();
  });
});
