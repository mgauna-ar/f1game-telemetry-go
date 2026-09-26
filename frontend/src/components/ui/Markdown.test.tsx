import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from './Markdown';

const renderMd = (content: string) => render(<Markdown content={content} />).container;

describe('Markdown', () => {
  it('renders lists as real list elements', () => {
    const container = renderMd('- Tyres\n- Fuel');
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
  });

  it('formats bold, italic, strikethrough and inline code', () => {
    const container = renderMd('**Box** now, *push* hard, ~~stay out~~, deploy `38.5%`');
    expect(container.querySelector('strong')?.textContent).toBe('Box');
    expect(container.querySelector('em')?.textContent).toBe('push');
    expect(container.querySelector('del')?.textContent).toBe('stay out');
    expect(container.querySelector('code')?.textContent).toBe('38.5%');
  });

  it('leaves underscores inside words alone', () => {
    const container = renderMd('Set brake_bias_front to 56');
    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toContain('brake_bias_front');
  });

  it('opens web links in a new tab and drops unsafe ones', () => {
    const container = renderMd('[Docs](https://example.com) and [bad](javascript:alert(1))');
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://example.com');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(container.textContent).toContain('bad');
  });

  it('right-aligns number columns in tables', () => {
    const container = renderMd('| Sector | Delta |\n|---|---|\n| S1 | +0.006 |\n| S2 | **+0.439** |');
    const cells = container.querySelectorAll('tbody td');
    expect(cells[0]).not.toHaveClass('num');
    expect(cells[1]).toHaveClass('num');
    expect(cells[3].querySelector('strong')?.textContent).toBe('+0.439');
  });

  it('leaves spaced asterisks alone', () => {
    const container = renderMd('2 * 3 * 4');
    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toBe('2 * 3 * 4');
  });

  it('renders release notes headings under the dialog title', () => {
    const container = renderMd('## v1.4.0\n### Features\n- Tyre **wear** chart\n1. First\n2. Second');
    expect(container.querySelector('h1, h2')).toBeNull();
    expect(container.querySelector('h3')?.textContent).toBe('v1.4.0');
    expect(container.querySelector('h4')?.textContent).toBe('Features');
    expect(container.querySelector('ul > li strong')?.textContent).toBe('wear');
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('never turns reply text into HTML', () => {
    const container = renderMd('<img src=x onerror="alert(1)"> hello');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img');
  });
});
