import { describe, it, expect, vi } from 'vitest';
import { APP_WINDOW_SIZE, fitWindowToContent, sizeAppWindow } from './useFitWindowToContent';

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

  it('keeps the width it is given while the window still reports another one', () => {
    const win = { ...fakeWindow(730), outerWidth: 1050 };
    fitWindowToContent(win, APP_WINDOW_SIZE.width);
    expect(win.resizeTo).toHaveBeenCalledWith(440, 770);
  });
});

describe('sizeAppWindow', () => {
  it('gives a window Chrome opened at another size the app window size', () => {
    const win = { outerWidth: 1050, resizeTo: vi.fn() };
    expect(sizeAppWindow(win)).toBe(true);
    expect(win.resizeTo).toHaveBeenCalledWith(APP_WINDOW_SIZE.width, APP_WINDOW_SIZE.height);
  });

  it('leaves a window that opened at the app window width alone', () => {
    const win = { outerWidth: APP_WINDOW_SIZE.width, resizeTo: vi.fn() };
    expect(sizeAppWindow(win)).toBe(false);
    expect(win.resizeTo).not.toHaveBeenCalled();
  });
});
