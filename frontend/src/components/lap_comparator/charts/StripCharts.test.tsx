import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StripCharts } from './StripCharts';
import { dragZoomRange } from './stripTraces';
import type { MergedTelemetryPoint } from '../../../types/comparator';

// A chart that reports the pointer's clientX as the lap distance under it (none for 0)
vi.mock('recharts', () => {
  type Handler = ((state: { activeLabel?: number }) => void) | undefined;
  const at = (handler: Handler) => (e: { clientX: number }) => handler?.(e.clientX ? { activeLabel: e.clientX } : {});
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({
      children,
      onMouseDown,
      onMouseMove,
      onMouseUp,
    }: {
      children?: React.ReactNode;
      onMouseDown?: Handler;
      onMouseMove?: Handler;
      onMouseUp?: Handler;
    }) => (
      <div
        role="presentation"
        data-testid="strip-chart"
        onMouseDown={at(onMouseDown)}
        onMouseMove={at(onMouseMove)}
        onMouseUp={at(onMouseUp)}
      >
        {children}
      </div>
    ),
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
    ReferenceArea: () => <div data-testid="drag-area" />,
  };
});

const point = (lap_distance: number): MergedTelemetryPoint => ({
  lap_distance,
  time_delta: 0.123,
  timeA: null,
  timeB: null,
  speedA: 250,
  speedB: 245,
  speed_delta: null,
  throttleA: 1,
  throttleB: 0.5,
  brakeA: 0,
  brakeB: 0,
  steerA: 0,
  steerB: 0,
  gearA: 7,
  gearB: 6,
  ersBatteryA: 50,
  ersBatteryB: 40,
  ersDeployModeA: 1,
  ersDeployModeB: 2,
});

const renderStrips = (onZoom = vi.fn()) =>
  render(
    <StripCharts
      chartData={[point(0), point(100), point(200)]}
      nameA="A"
      nameB="B"
      available={['delta', 'speed', 'throttle', 'brake', 'gear', 'steering', 'ersBattery', 'ersMode']}
      sector1Distance={null}
      sector2Distance={null}
      hoverDistance={100}
      onMouseMove={vi.fn()}
      onHoverDistanceChange={vi.fn()}
      onZoomDomainChange={onZoom}
    />
  );

const stripNames = () =>
  within(screen.getByRole('list', { name: 'Telemetry strips' }))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('data-trace'));

describe('StripCharts', () => {
  beforeEach(() => localStorage.clear());

  it('shows each trace with the values under the cursor', () => {
    renderStrips();
    expect(stripNames()).toEqual(['delta', 'speed', 'throttle', 'brake', 'gear', 'steering', 'ersBattery', 'ersMode']);
    const speed = screen.getAllByRole('listitem')[1];
    expect(within(speed).getByText('250')).toBeInTheDocument();
    expect(within(speed).getByText('245')).toBeInTheDocument();
    expect(screen.getByText('+0.123s')).toBeInTheDocument();
  });

  it('moves and hides strips and remembers the layout', () => {
    const { unmount } = renderStrips();
    fireEvent.click(screen.getByRole('button', { name: 'Move Speed up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide Gear' }));
    expect(stripNames().slice(0, 2)).toEqual(['speed', 'delta']);
    expect(stripNames()).not.toContain('gear');
    unmount();

    renderStrips();
    expect(stripNames().slice(0, 2)).toEqual(['speed', 'delta']);
    fireEvent.click(screen.getByRole('button', { name: 'Gear' }));
    expect(stripNames()).toContain('gear');
    fireEvent.click(screen.getByRole('button', { name: 'Reset layout' }));
    expect(stripNames()[0]).toBe('delta');
  });

  it('zooms to a dragged stretch, and ignores a click', () => {
    const onZoom = vi.fn();
    renderStrips(onZoom);
    const [chart] = screen.getAllByTestId('strip-chart');
    fireEvent.mouseDown(chart, { clientX: 300 });
    fireEvent.mouseMove(chart, { clientX: 120 });
    expect(screen.getAllByTestId('drag-area').length).toBeGreaterThan(0);
    fireEvent.mouseUp(chart, { clientX: 120 });
    expect(onZoom).toHaveBeenCalledWith([120, 300]);
    expect(screen.queryByTestId('drag-area')).not.toBeInTheDocument();

    fireEvent.mouseDown(chart, { clientX: 300 });
    fireEvent.mouseUp(chart, { clientX: 305 });
    expect(onZoom).toHaveBeenCalledTimes(1);

    // Pressed before the chart knew where the pointer was: the drag starts at the first move
    fireEvent.mouseDown(chart, { clientX: 0 });
    fireEvent.mouseMove(chart, { clientX: 400 });
    fireEvent.mouseMove(chart, { clientX: 480 });
    fireEvent.mouseUp(chart, { clientX: 480 });
    expect(onZoom).toHaveBeenLastCalledWith([400, 480]);
  });

  it('only zooms on drags of at least 20 m', () => {
    expect(dragZoomRange(500, 490)).toBeNull();
    expect(dragZoomRange(500.4, 470.2)).toEqual([470, 500]);
  });
});
