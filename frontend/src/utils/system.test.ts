import { describe, it, expect } from 'vitest';
import { detectUserOS } from './system';

describe('detectUserOS', () => {
  it('detects OS without throwing in jsdom environment', () => {
    const os = detectUserOS();
    expect(['macos', 'windows', 'linux', 'other']).toContain(os);
  });
});
