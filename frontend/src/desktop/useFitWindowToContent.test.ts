import { describe, it, expect, vi } from 'vitest';
import { fitWindowToContent } from './useFitWindowToContent';

const fakeWindow = (contentHeight: number, availHeight = 1040) => ({
  innerHeight: 640,
  outerHeight: 680,
  outerWidth: 440,
  resizeTo: vi.fn(),
  document: { documentElement: { scrollHeight: contentHeight } },
  screen: { availHeight },
});

describe('fitWindowToContent', () => {
  it('grows the window by what its content overflows', () => {
    const win = fakeWindow(730);
    fitWindowToContent(win);
    expect(win.resizeTo).toHaveBeenCalledWith(440, 770);
  });

  it('leaves a window whose content fits alone', () => {
    const win = fakeWindow(640);
    fitWindowToContent(win);
    expect(win.resizeTo).not.toHaveBeenCalled();
  });

  it('stops at the screen height', () => {
    const win = fakeWindow(2000, 900);
    fitWindowToContent(win);
    expect(win.resizeTo).toHaveBeenCalledWith(440, 900);
  });
});
