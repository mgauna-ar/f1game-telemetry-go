import { SESSION_TYPE_KEYS, SESSION_TYPE_LABELS } from '../constants/f1';

type Translate = (key: string) => string;

/** The game's session codes by the English name the server stores (packets.SessionTypeName). */
const CODE_BY_STORED_NAME = new Map(
  Object.entries(SESSION_TYPE_LABELS).map(([code, name]) => [name.toLowerCase(), Number(code)])
);

/** A session type in the UI language, from the game's session code. */
export function sessionTypeLabelForCode(code: number | undefined, t: Translate): string {
  const key = code === undefined ? undefined : SESSION_TYPE_KEYS[code];
  return t(`common.sessionTypes.${key ?? 'unknown'}`);
}

/**
 * A stored session's type in the UI language. The server stores the game's English name; a name
 * it doesn't know (an imported file from another tool) is shown as it is.
 */
export function sessionTypeLabel(storedName: string | null | undefined, t: Translate): string {
  const name = storedName?.trim();
  if (!name) return t('common.sessionTypes.unknown');
  const code = CODE_BY_STORED_NAME.get(name.toLowerCase());
  return code === undefined ? name : sessionTypeLabelForCode(code, t);
}
