import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WeatherBadgeWithForecast } from './WeatherBadgeWithForecast';
import { I18nProvider } from '../../context/I18nProvider';
import type { Session } from '../../types/session';

describe('WeatherBadgeWithForecast', () => {
  const mockSession: Session = {
    id: 1,
    session_uid: '0x48D7F9B1E038C41A',
    track_name: 'Imola',
    session_type: 'Race',
    weather: 'Heavy Rain',
    created_at: '2026-08-17T23:31:00Z',
    weather_forecast: [
      { TimeOffset: 0, Weather: 4, RainPercentage: 90, TrackTemperature: 28, AirTemperature: 21 },
      { TimeOffset: 5, Weather: 4, RainPercentage: 75, TrackTemperature: 27, AirTemperature: 21 },
      { TimeOffset: 15, Weather: 3, RainPercentage: 35, TrackTemperature: 26, AirTemperature: 22 },
      { TimeOffset: 30, Weather: 1, RainPercentage: 5, TrackTemperature: 28, AirTemperature: 23 },
    ],
  };

  it('renders initial session weather correctly', () => {
    render(
      <I18nProvider>
        <WeatherBadgeWithForecast session={mockSession} />
      </I18nProvider>
    );

    expect(screen.getByText('Heavy Rain')).toBeInTheDocument();
  });

  it('shows weather forecast popover on hover', () => {
    render(
      <I18nProvider>
        <WeatherBadgeWithForecast session={mockSession} />
      </I18nProvider>
    );

    const trigger = screen.getByText('Heavy Rain').closest('.weather-badge-container');
    expect(trigger).toBeTruthy();

    if (trigger) {
      fireEvent.mouseEnter(trigger);
    }

    expect(screen.getByText(/Weather Evolution & Forecast/i)).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
  });

  it('handles session without forecast gracefully', () => {
    const staticSession: Session = {
      id: 2,
      session_uid: '0x1234567890ABCDEF',
      track_name: 'Monza',
      session_type: 'Race',
      weather: 'Clear',
      created_at: '2026-08-17T23:31:00Z',
    };

    render(
      <I18nProvider>
        <WeatherBadgeWithForecast session={staticSession} />
      </I18nProvider>
    );

    expect(screen.getByText('Clear')).toBeInTheDocument();

    const trigger = screen.getByText('Clear').closest('.weather-badge-container');
    if (trigger) {
      fireEvent.mouseEnter(trigger);
    }

    expect(screen.queryByText(/Weather Evolution & Forecast/i)).not.toBeInTheDocument();
  });

  it('handles JSON string weather forecast', () => {
    const jsonSession: Session = {
      id: 3,
      session_uid: '0x999',
      track_name: 'Spa',
      session_type: 'Qualifying',
      weather: 'Light Rain',
      created_at: '2026-08-17T23:31:00Z',
      weather_forecast: JSON.stringify([
        { TimeOffset: 0, Weather: 3, RainPercentage: 40 },
        { TimeOffset: 10, Weather: 0, RainPercentage: 0 },
      ]),
    };

    render(
      <I18nProvider>
        <WeatherBadgeWithForecast session={jsonSession} />
      </I18nProvider>
    );

    expect(screen.getByText('Light Rain')).toBeInTheDocument();
    const trigger = screen.getByText('Light Rain').closest('.weather-badge-container');
    if (trigger) {
      fireEvent.mouseEnter(trigger);
    }
    expect(screen.getByText(/Weather Evolution & Forecast/i)).toBeInTheDocument();
  });
});
