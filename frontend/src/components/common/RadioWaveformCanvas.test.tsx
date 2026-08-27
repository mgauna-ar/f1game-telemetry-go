import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RadioWaveformCanvas } from './RadioWaveformCanvas';

describe('RadioWaveformCanvas', () => {
  it('renders canvas or fallback equalizer in jsdom environment', () => {
    const { container } = render(<RadioWaveformCanvas radioState="transmitting" />);
    expect(container).toBeTruthy();
  });

  it('renders correctly across various radio states', () => {
    const states = ['idle', 'listening', 'transmitting', 'processing', 'speaking'] as const;
    states.forEach((st) => {
      const { container } = render(<RadioWaveformCanvas radioState={st} width={100} height={20} barCount={8} />);
      expect(container).toBeTruthy();
    });
  });
});
