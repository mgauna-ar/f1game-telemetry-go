import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThresholdSlider } from './ThresholdSlider';

describe('ThresholdSlider Component', () => {
  it('renders label and formatted value with unit', () => {
    render(
      <ThresholdSlider
        label="Tyre Wear Warning"
        value={45}
        unit="%"
        min={20}
        max={80}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Tyre Wear Warning')).toBeDefined();
    expect(screen.getByText('45%')).toBeDefined();
  });

  it('supports custom formatValue and description', () => {
    render(
      <ThresholdSlider
        label="Fuel Delta"
        value={-1.5}
        min={-3}
        max={0}
        step={0.1}
        formatValue={(v) => `${v} laps`}
        description="Lift and coast reminder"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('-1.5 laps')).toBeDefined();
    expect(screen.getByText('Lift and coast reminder')).toBeDefined();
  });

  it('handles onChange with integer and float steps', () => {
    const onChangeInt = vi.fn();
    const { rerender } = render(
      <ThresholdSlider
        label="Int Slider"
        value={50}
        min={0}
        max={100}
        step={5}
        onChange={onChangeInt}
      />
    );

    const input = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '60' } });
    expect(onChangeInt).toHaveBeenCalledWith(60);

    const onChangeFloat = vi.fn();
    rerender(
      <ThresholdSlider
        label="Float Slider"
        value={2.5}
        min={1.0}
        max={5.0}
        step={0.5}
        onChange={onChangeFloat}
      />
    );
    fireEvent.change(input, { target: { value: '3.5' } });
    expect(onChangeFloat).toHaveBeenCalledWith(3.5);
  });
});
