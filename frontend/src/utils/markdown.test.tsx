import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatInlineMarkdown, renderSimpleMarkdown } from './markdown';

describe('markdown utils', () => {
  it('formats inline bold markdown correctly', () => {
    const { container } = render(<div>{formatInlineMarkdown('Hello **F1** World')}</div>);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('F1');
  });

  it('renders headings and list items in markdown', () => {
    const sample = `
# Title
## Section
- First bullet **important**
- Second bullet
1. Numbered item
Plain text
`;
    render(<div>{renderSimpleMarkdown(sample)}</div>);
    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.getByText('Section')).toBeDefined();
    expect(screen.getByText('Second bullet')).toBeDefined();
    expect(screen.getByText('Numbered item')).toBeDefined();
  });
});
