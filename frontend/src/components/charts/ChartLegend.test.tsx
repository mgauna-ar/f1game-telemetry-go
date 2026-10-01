import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartLegend } from './ChartLegend';

describe('ChartLegend', () => {
  it('lists each series by name with its colour', () => {
    render(
      <ChartLegend
        items={[
          { label: 'You', color: 'var(--f1-you)', emphasis: true },
          { label: 'Field median', color: 'var(--text-muted)', shape: 'dashed' },
        ]}
      />
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['You', 'Field median']);
    expect(items[0].style.getPropertyValue('--legend-color')).toBe('var(--f1-you)');
  });
});
