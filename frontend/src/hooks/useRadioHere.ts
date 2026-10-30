import { useEffect } from 'react';
import { useDesktopStore } from '../store/useDesktopStore';
import { isEngineerWindow, isNativeWindow } from '../utils/nativeWindow';

/**
 * Whether the radio may speak and listen in this page. On a PC whose app has its own windows
 * (Windows), only its engineer window does: the main window and a browser tab on that PC stay
 * silent, so nothing talks over the engineer or answers a push-to-talk press twice. Phones, tablets
 * and the app on macOS or Linux keep the radio switch of their own.
 */
export function useRadioHere(): boolean {
  const native = isNativeWindow();
  const appWindowOnThisPC = useDesktopStore((s) => s.state?.native_window === true);
  const load = useDesktopStore((s) => s.load);

  useEffect(() => {
    if (!native) void load();
  }, [native, load]);

  return native ? isEngineerWindow() : !appWindowOnThisPC;
}
