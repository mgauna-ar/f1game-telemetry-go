import React from 'react';
import { useI18n } from '../context/I18nContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../store/useTelemetryDataStore';
import { LIVE_STATUS, TRACK_NAMES, getTrackInfo } from '../constants/f1';

/**
 * Keeps the browser tab title on the race, e.g. "P4 · L12/29 · Melbourne", so a background tab
 * still tells the driver where they are. Renders nothing.
 */
export const LiveDocumentTitle: React.FC = () => {
  const { t } = useI18n();
  const status = useLiveStatus();
  const trackId = useSessionStatusStore((s) => s.session?.TrackId);
  const totalLaps = useSessionStatusStore((s) => s.session?.TotalLaps);
  const position = useTelemetryDataStore((s) => s.allLaps[s.playerCarIndex]?.CarPosition);
  const lapNum = useTelemetryDataStore((s) => s.allLaps[s.playerCarIndex]?.CurrentLapNum);

  let title = t('nav.tabs.live');
  if (trackId !== undefined && (status === LIVE_STATUS.LIVE || status === LIVE_STATUS.STALE)) {
    const trackName = getTrackInfo(trackId)?.name || TRACK_NAMES[trackId] || t('common.unknownTrack');
    const parts: string[] = [];
    if (status === LIVE_STATUS.STALE) {
      parts.push(t('live.statusStale'));
    } else {
      if (position) parts.push(`P${position}`);
      if (lapNum) parts.push(totalLaps ? `L${lapNum}/${totalLaps}` : `L${lapNum}`);
    }
    parts.push(trackName);
    title = parts.join(' · ');
  }

  useDocumentTitle(title);
  return null;
};
