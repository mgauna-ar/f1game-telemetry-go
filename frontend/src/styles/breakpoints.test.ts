import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expandMediaParams, maxWidth } from './breakpoints';

const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });

describe('breakpoints', () => {
  it('expands named breakpoints in media queries', () => {
    expect(expandMediaParams('(--tablet)')).toBe('(max-width: 900px)');
    expect(expandMediaParams('print and (--phone)')).toBe('print and (max-width: 600px)');
    expect(expandMediaParams('(prefers-reduced-motion: reduce)')).toBe('(prefers-reduced-motion: reduce)');
    expect(maxWidth('laptop')).toBe('(max-width: 1100px)');
  });

  it('rejects an unknown breakpoint', () => {
    expect(() => expandMediaParams('(--desktop)', 'x.css')).toThrow(/x\.css: unknown breakpoint \(--desktop\)/);
  });

  it('is the only way stylesheets set a width breakpoint', () => {
    const offenders = cssFiles(join(__dirname, '..')).filter((file) =>
      /@media[^{]*\((max|min)-width:\s*\d/.test(readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
