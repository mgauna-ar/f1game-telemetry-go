import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { F1TelemetryLogo } from './F1TelemetryLogo';

describe('F1TelemetryLogo Component', () => {
  it('renders correctly with default props', () => {
    const { container } = render(<F1TelemetryLogo />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'F1 Telemetry');
    expect(svg).toHaveAttribute('width', '28');
    expect(svg).toHaveAttribute('height', '28');
  });

  it('renders custom size and custom class names', () => {
    const { container } = render(
      <F1TelemetryLogo size={36} className="custom-test-logo" />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '36');
    expect(svg).toHaveAttribute('height', '36');
    expect(svg?.classList.contains('custom-test-logo')).toBe(true);
  });

  it('applies f1-tacho-animated class when animated is true', () => {
    const { container } = render(<F1TelemetryLogo animated={true} />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('f1-tacho-animated')).toBe(true);
  });

  it('renders monochrome variant using currentColor', () => {
    const { container } = render(<F1TelemetryLogo variant="monochrome" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // Monochrome mode should not contain glow filters
    expect(container.querySelector('#tachoCrimsonGlow')).toBeNull();
  });

  it('renders badge backdrop when variant is badge', () => {
    const { container } = render(<F1TelemetryLogo variant="badge" />);
    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
  });
});
