import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubsystemAccordion } from './SubsystemAccordion';

const renderAccordion = (isExpanded: boolean) => {
  const onToggleExpand = vi.fn();
  const onToggleMaster = vi.fn();
  const { container } = render(
    <SubsystemAccordion
      id="tyres"
      title="Tyres"
      subtitle="Wear and temperature calls"
      icon={<span />}
      masterEnabled={true}
      onToggleMaster={onToggleMaster}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      <p>Tyre thresholds</p>
    </SubsystemAccordion>
  );
  return { container, onToggleExpand, onToggleMaster };
};

describe('SubsystemAccordion', () => {
  it('expands from its title button, which reports the state', () => {
    const { onToggleExpand } = renderAccordion(false);
    const toggle = screen.getByRole('button', { name: /Tyres/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).not.toHaveAttribute('aria-controls');

    fireEvent.click(toggle);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it('points the title button at the open body', () => {
    renderAccordion(true);
    const toggle = screen.getByRole('button', { name: /Tyres/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toHaveTextContent('Tyre thresholds');
  });

  it('keeps the named switch from toggling the section, while the chevron still does', () => {
    const { container, onToggleExpand, onToggleMaster } = renderAccordion(false);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tyres' }));
    expect(onToggleMaster).toHaveBeenCalledWith(false);
    expect(onToggleExpand).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('.radio-accordion-chevron')!);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });
});
