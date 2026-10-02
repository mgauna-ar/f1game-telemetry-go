import React, { useEffect, useRef } from 'react';
import { useI18n } from '../../context/I18nContext';
import { useSessionStatusStore } from '../../store/useSessionStatusStore';
import { useSystemStatusStore } from '../../store/useSystemStatusStore';
import { useToastStore } from '../../store/useToastStore';
import { navigate, useRoute } from '../../router/router';
import { buildPath, storedLiveMode } from '../../router/routes';
import { LIVE_STATUS } from '../../constants/f1';
import { liveSessionLabel } from '../../utils/liveSessionLabel';

/** How long the "live session detected" toast stays up. */
const LIVE_SESSION_TOAST_MS = 10_000;

/**
 * Shows "Live session detected → Open" once per session when telemetry starts arriving while
 * another page is open. A session already seen on the Live tab isn't announced. Renders nothing.
 */
export const LiveSessionToast: React.FC = () => {
  const { t } = useI18n();
  const onLivePage = useRoute().page === 'live';
  const session = useSystemStatusStore((s) => (s.liveStatus === LIVE_STATUS.LIVE ? s.session : null));
  const liveTabSessionUid = useSessionStatusStore((s) => s.session?.SessionUID);
  const announced = useRef(new Set<string>());

  useEffect(() => {
    if (liveTabSessionUid) announced.current.add(liveTabSessionUid);
  }, [liveTabSessionUid]);

  useEffect(() => {
    if (!session || onLivePage || announced.current.has(session.session_uid)) return;
    announced.current.add(session.session_uid);
    const { kind, track } = liveSessionLabel(session, t);
    useToastStore.getState().showToast({
      type: 'info',
      message: t('live.sessionDetected', { session: kind, track }),
      duration: LIVE_SESSION_TOAST_MS,
      action: {
        label: t('live.sessionDetectedOpen'),
        onAction: () => navigate(buildPath({ page: 'live', mode: storedLiveMode() })),
      },
    });
  }, [session, onLivePage, t]);

  return null;
};
