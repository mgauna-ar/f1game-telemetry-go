/// <reference types="node" />
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_TOKENS, alpha, cssVar, getCssVar, getCssVars } from './theme';

// Vitest doesn't load stylesheets, so read the token file itself.
const variablesCss = readFileSync(path.join(__dirname, 'base', 'variables.css'), 'utf8');
const definedTokens = new Set(Array.from(variablesCss.matchAll(/^\s*(--[\w-]+)\s*:/gm), (match) => match[1]));

describe('theme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('only lists tokens that variables.css defines', () => {
    expect(THEME_TOKENS.filter((token) => !definedTokens.has(token))).toEqual([]);
  });

  it('builds var() references and color-mix() tints', () => {
    expect(cssVar('--f1-slot-a')).toBe('var(--f1-slot-a)');
    expect(alpha(cssVar('--f1-slot-b'), 0.15)).toBe('color-mix(in srgb, var(--f1-slot-b) 15%, transparent)');
    expect(alpha('#ff3366', 0.333)).toBe('color-mix(in srgb, #ff3366 33%, transparent)');
  });

  it('reads computed token values for canvas drawing', () => {
    document.documentElement.style.setProperty('--f1-slot-a', '#00d2d3');
    document.documentElement.style.setProperty('--chart-cursor', ' #ffd200 ');

    expect(getCssVar('--f1-slot-a')).toBe('#00d2d3');
    expect(getCssVars({ slot: '--f1-slot-a', cursor: '--chart-cursor', unset: '--f1-slot-b' })).toEqual({
      slot: '#00d2d3',
      cursor: '#ffd200',
      unset: '',
    });
  });
});
