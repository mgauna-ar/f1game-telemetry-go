import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useNavHeightVar } from './useNavHeightVar';

const Nav = () => {
  const ref = useRef<HTMLElement>(null);
  useNavHeightVar(ref);
  return <header ref={ref}>Nav</header>;
};

describe('useNavHeightVar', () => {
  it('publishes the top bar height on <html> and removes it on unmount', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 72.4 } as DOMRect);
    const { unmount } = render(<Nav />);
    expect(document.documentElement.style.getPropertyValue('--nav-height')).toBe('72px');
    unmount();
    expect(document.documentElement.style.getPropertyValue('--nav-height')).toBe('');
    rect.mockRestore();
  });
});
