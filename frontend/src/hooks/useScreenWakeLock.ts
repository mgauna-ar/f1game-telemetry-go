import { useCallback, useEffect, useRef, useState } from 'react';
import keepAwakeMp4 from '../assets/keep-awake.mp4';
import keepAwakeWebm from '../assets/keep-awake.webm';

/**
 * How the screen is being kept on:
 * - `wake-lock`: the Screen Wake Lock API (needs HTTPS or localhost)
 * - `video`: a muted looping video, for browsers without it (a phone on http://<lan-ip>)
 * - `blocked`: the browser refused both; the driver should turn off auto-lock, or tap to retry
 * - `off`: not asked for
 */
export type WakeLockMode = 'wake-lock' | 'video' | 'blocked' | 'off';

export interface ScreenWakeLock {
  mode: WakeLockMode;
  /** Tries again from a tap: browsers that block autoplay allow a video started by the user. */
  retry: () => void;
}

/** The hidden looping video that keeps a phone's screen on where there is no wake lock API. */
function createKeepAwakeVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.style.position = 'fixed';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  for (const [src, type] of [
    [keepAwakeWebm, 'video/webm'],
    [keepAwakeMp4, 'video/mp4'],
  ]) {
    const source = document.createElement('source');
    source.src = src;
    source.type = type;
    video.appendChild(source);
  }
  document.body.appendChild(video);
  return video;
}

/**
 * Keeps the screen on while `active`: the wake lock when the browser has it, else a muted looping
 * video, else reports `blocked`. The lock is taken again when the page shows after being hidden
 * (browsers drop it then).
 */
export function useScreenWakeLock(active: boolean): ScreenWakeLock {
  const [mode, setMode] = useState<WakeLockMode>('off');
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const playVideo = useCallback(async () => {
    videoRef.current ??= createKeepAwakeVideo();
    try {
      await videoRef.current.play();
      if (activeRef.current) setMode('video');
    } catch {
      if (activeRef.current) setMode('blocked');
    }
  }, []);

  const acquire = useCallback(async () => {
    if (!activeRef.current || document.hidden) return;
    if ('wakeLock' in navigator && navigator.wakeLock) {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (!activeRef.current) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        setMode('wake-lock');
        return;
      } catch {
        // Refused (not a secure context, battery saver, …): fall back to the video
      }
    }
    await playVideo();
  }, [playVideo]);

  useEffect(() => {
    if (!active) {
      setMode('off');
      return;
    }
    void acquire();
    const onVisibility = () => {
      if (document.hidden) return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, [active, acquire]);

  return { mode, retry: () => void playVideo() };
}
