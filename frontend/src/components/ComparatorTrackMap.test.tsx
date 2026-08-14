import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ComparatorTrackMap } from './ComparatorTrackMap';

describe('ComparatorTrackMap Component', () => {
  const mockData = [
    { lap_distance: 0, time_delta: 0, timeA: 0, timeB: 0, speedA: 200, speedB: 195, speed_delta: 5, throttleA: 1, throttleB: 1, brakeA: 0, brakeB: 0, steerA: 0, steerB: 0, gearA: 4, gearB: 4, ersBatteryA: 100, ersBatteryB: 100, ersDeployModeA: 1, ersDeployModeB: 1, worldX: 0, worldZ: 0 },
    { lap_distance: 500, time_delta: -0.1, timeA: 10, timeB: 10.1, speedA: 250, speedB: 245, speed_delta: 5, throttleA: 1, throttleB: 1, brakeA: 0, brakeB: 0, steerA: 0, steerB: 0, gearA: 5, gearB: 5, ersBatteryA: 95, ersBatteryB: 95, ersDeployModeA: 1, ersDeployModeB: 1, worldX: 100, worldZ: 200 },
    { lap_distance: 1000, time_delta: -0.2, timeA: 20, timeB: 20.2, speedA: 300, speedB: 290, speed_delta: 10, throttleA: 1, throttleB: 1, brakeA: 0, brakeB: 0, steerA: 0, steerB: 0, gearA: 7, gearB: 7, ersBatteryA: 90, ersBatteryB: 90, ersDeployModeA: 1, ersDeployModeB: 1, worldX: 300, worldZ: 400 },
    { lap_distance: 1500, time_delta: 0.05, timeA: 30, timeB: 29.95, speedA: 180, speedB: 185, speed_delta: -5, throttleA: 0.5, throttleB: 0.6, brakeA: 0, brakeB: 0, steerA: 0.2, steerB: 0.2, gearA: 3, gearB: 3, ersBatteryA: 85, ersBatteryB: 85, ersDeployModeA: 1, ersDeployModeB: 1, worldX: 400, worldZ: 100 },
  ];

  it('renders canvas element and English legends cleanly without extra tab clutter', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ComparatorTrackMap
        data={mockData}
        activeDistance={500}
        sector1Distance={500}
        sector2Distance={1000}
        height={200}
        onSelectDistance={onSelect}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    expect(screen.getByText(/Lap A Faster/i)).toBeInTheDocument();
    expect(screen.getByText(/Lap B Faster/i)).toBeInTheDocument();
    expect(screen.getByText(/Apex/i)).toBeInTheDocument();
    expect(screen.getByText(/SF/i)).toBeInTheDocument();
  });
});
