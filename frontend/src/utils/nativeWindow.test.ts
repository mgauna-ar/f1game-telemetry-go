import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './apiClient';
import { isEngineerPath, isEngineerWindow, isNativeWindow, markNativeWindow, openLinksOutside } from './nativeWindow';

type HostWindow = Window & { chrome?: { webview?: unknown } };

/** Makes this page one of the app's own windows, as WebView2 does with `chrome.webview`. */
const inAppWindow = () => {
  (window as HostWindow).chrome = { webview: {} };
};

const link = (href: string, target?: string): HTMLAnchorElement => {
  const a = document.createElement('a');
  a.href = href;
  if (target) a.target = target;
  a.textContent = 'link';
  document.body.appendChild(a);
  return a;
};

/** Clicks the element and reports whether the page's default action (following the link) was stopped. */
const click = (el: Element, init: MouseEventInit = {}, type = 'click'): boolean =>
  !el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }));

describe('nativeWindow', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/live');
  });

  afterEach(() => {
    delete (window as HostWindow).chrome;
    window.name = '';
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('tells the app window from a browser', () => {
    expect(isNativeWindow()).toBe(false);
    inAppWindow();
    expect(isNativeWindow()).toBe(true);
  });

  it('marks the engineer window by its page, and keeps it marked', () => {
    inAppWindow();
    markNativeWindow();
    expect(isEngineerWindow()).toBe(false);

    window.history.replaceState(null, '', '/engineer');
    markNativeWindow();
    expect(isEngineerWindow()).toBe(true);

    // Whatever its URL shows later, the window is still the engineer's
    window.history.replaceState(null, '', '/live/cockpit');
    markNativeWindow();
    expect(isEngineerWindow()).toBe(true);
  });

  it('never marks a browser tab as the engineer window', () => {
    window.history.replaceState(null, '', '/engineer');
    markNativeWindow();
    expect(isEngineerPath(window.location.pathname)).toBe(true);
    expect(isEngineerWindow()).toBe(false);
  });

  describe('openLinksOutside', () => {
    it('opens another site in the default browser', () => {
      const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
      const undo = openLinksOutside(vi.fn());
      const notes = link('https://github.com/mgauna-ar/f1game-telemetry-go/releases', '_blank');

      expect(click(notes)).toBe(true);
      expect(post).toHaveBeenCalledWith('/api/desktop/open', {
        url: 'https://github.com/mgauna-ar/f1game-telemetry-go/releases',
      });

      // A middle click too, which would open a window of its own
      expect(click(notes, { button: 1 }, 'auxclick')).toBe(true);
      expect(post).toHaveBeenCalledTimes(2);
      undo();
      expect(click(notes)).toBe(false);
      expect(post).toHaveBeenCalledTimes(2);
    });

    it('opens a dashboard page meant for a new tab in the window itself', () => {
      const post = vi.spyOn(api, 'post');
      const undo = openLinksOutside(vi.fn());

      expect(click(link('/history/12/stints', '_blank'))).toBe(true);
      expect(window.location.pathname).toBe('/history/12/stints');

      // A plain link of the dashboard isn't touched (this listener, after it, sees what it did)
      let prevented: boolean | undefined;
      document.addEventListener(
        'click',
        (e) => {
          prevented = e.defaultPrevented;
          e.preventDefault();
        },
        { once: true }
      );
      click(link('/progress'));
      expect(prevented).toBe(false);
      expect(post).not.toHaveBeenCalled();
      undo();
    });

    it('leaves links another handler already took', () => {
      const post = vi.spyOn(api, 'post');
      const undo = openLinksOutside(vi.fn());
      const a = link('https://example.com/');
      a.addEventListener('click', (e) => e.preventDefault());

      click(a);
      expect(post).not.toHaveBeenCalled();
      undo();
    });

    describe('in the engineer window', () => {
      beforeEach(() => {
        inAppWindow();
        window.history.replaceState(null, '', '/engineer');
        markNativeWindow();
      });

      it('opens a dashboard page in the main window, before a dashboard link moves this one', () => {
        const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
        const undo = openLinksOutside(vi.fn());
        // As a dashboard Link does: it moves the window to the page unless the click was taken
        const a = link('/settings/ptt');
        a.addEventListener('click', (e) => {
          if (e.defaultPrevented) return;
          e.preventDefault();
          window.history.pushState(null, '', '/settings/ptt');
        });

        expect(click(a)).toBe(true);
        expect(window.location.pathname).toBe('/engineer');
        expect(post).toHaveBeenCalledWith('/api/desktop/window', { window: 'main', path: '/settings/ptt' });
        undo();
      });

      it('leaves links within its own page, and still opens other sites in the browser', () => {
        const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 'success' });
        const undo = openLinksOutside(vi.fn());

        // A link within its own page isn't touched (this listener, after it, sees what it did)
        let prevented: boolean | undefined;
        document.addEventListener(
          'click',
          (e) => {
            prevented = e.defaultPrevented;
            e.preventDefault();
          },
          { once: true }
        );
        click(link('/engineer#transcript'));
        expect(prevented).toBe(false);
        expect(post).not.toHaveBeenCalled();

        expect(click(link('https://console.anthropic.com/settings/keys', '_blank'))).toBe(true);
        expect(post).toHaveBeenCalledWith('/api/desktop/open', { url: 'https://console.anthropic.com/settings/keys' });
        undo();
      });
    });

    it('says when the browser could not be opened', async () => {
      const failure = new Error('could not open the browser');
      vi.spyOn(api, 'post').mockRejectedValue(failure);
      const onError = vi.fn();
      const undo = openLinksOutside(onError);

      click(link('https://console.anthropic.com/settings/keys', '_blank'));
      await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
      undo();
    });
  });
});
