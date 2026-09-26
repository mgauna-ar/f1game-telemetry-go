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

  it('formats italics with asterisks or underscores', () => {
    const { container } = render(<div>{formatInlineMarkdown('*Use the chips* or _ask me_ anything')}</div>);
    const italics = container.querySelectorAll('em');
    expect(italics).toHaveLength(2);
    expect(italics[0].textContent).toBe('Use the chips');
    expect(italics[1].textContent).toBe('ask me');
    expect(container.textContent).not.toContain('*');
  });

  it('leaves loose asterisks and underscores inside words alone', () => {
    const { container } = render(<div>{formatInlineMarkdown('2 * 3 * 4 and tyre_wear_pct')}</div>);
    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toBe('2 * 3 * 4 and tyre_wear_pct');
  });

  it('formats inline code, links and nested emphasis', () => {
    const { container } = render(
      <div>{formatInlineMarkdown('Run `make simulate`, read [the docs](https://example.com) and **be *fast* now**')}</div>
    );
    expect(container.querySelector('code')?.textContent).toBe('make simulate');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.querySelector('strong em')?.textContent).toBe('fast');
  });

  it('does not turn non-http links into anchors', () => {
    const { container } = render(<div>{formatInlineMarkdown('[click](javascript:alert(1))')}</div>);
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders pipe tables', () => {
    const sample = `Gaps:
| Driver | Gap |
|---|:---:|
| **Norris** | +1.2s |
| Piastri | +3.4s |
After the table`;
    const { container } = render(<div>{renderSimpleMarkdown(sample)}</div>);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(Array.from(table!.querySelectorAll('th')).map((th) => th.textContent)).toEqual(['Driver', 'Gap']);
    expect(table!.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table!.querySelector('tbody strong')?.textContent).toBe('Norris');
    expect(screen.getByText('After the table')).toBeDefined();
  });
});
