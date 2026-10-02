import { SESSION_TYPE_LABELS, TRACK_NAMES, getTrackInfo } from '../constants/f1';
import type { ActiveSession } from '../types/system';
import { sessionTypeLabelForCode } from './sessionTypeLabel';

type Translate = (key: string) => string;

/** The session the game is sending, in the UI language: its type and track ("Race", "Monza"). */
export function liveSessionLabel(session: ActiveSession, t: Translate): { kind: string; track: string } {
  const track = getTrackInfo(session.track_id)?.name || TRACK_NAMES[session.track_id] || t('common.unknownTrack');
  const kind = SESSION_TYPE_LABELS[session.session_type]
    ? sessionTypeLabelForCode(session.session_type, t)
    : t('nav.tabs.live');
  return { kind, track };
}
