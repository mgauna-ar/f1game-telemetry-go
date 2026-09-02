import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ComparatorChart } from './ComparatorChart';
import type { MergedTelemetryPoint } from '../../../types/comparator';

describe('ComparatorChart Component', () => {
  const mockData = [
    { lap_distance: 10, speedA: 150, speedB: 155 },
    { lap_distance: 20, speedA: 180, speedB: 182 },
  ] as unknown as MergedTelemetryPoint[];

  it('renders title and custom header right content', () => {
    render(
      <ComparatorChart
        chartData={mockData}
        nameA="VER"
        nameB="NOR"
        sector1Distance={null}
        sector2Distance={null}
        hoverDistance={null}
        onMouseMove={vi.fn()}
        onHoverDistanceChange={vi.fn()}
        title={<h3>Speed Chart</h3>}
        headerRight={<span data-testid="test-badge">Loss Detected</span>}
        dataKeyA="speedA"
        dataKeyB="speedB"
      />
    );

    expect(screen.getByText('Speed Chart')).toBeDefined();
    expect(screen.getByTestId('test-badge')).toBeDefined();
    expect(screen.getByText('Loss Detected')).toBeDefined();
  });

  it('renders custom body when provided', () => {
    render(
      <ComparatorChart
        chartData={[]}
        nameA="VER"
        nameB="NOR"
        sector1Distance={null}
        sector2Distance={null}
        hoverDistance={null}
        onMouseMove={vi.fn()}
        onHoverDistanceChange={vi.fn()}
        title="Custom Chart"
        customBody={<div data-testid="custom-empty-state">No Telemetry Available</div>}
      />
    );

    expect(screen.getByTestId('custom-empty-state')).toBeDefined();
    expect(screen.getByText('No Telemetry Available')).toBeDefined();
  });
});
