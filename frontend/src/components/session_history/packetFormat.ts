/**
 * The packet format most of the listed sessions use. The list shows a session's format badge only
 * when it differs from this one, instead of the same "F1 2026" on every row.
 */
export const commonPacketFormat = (sessions: ReadonlyArray<{ packet_format: number }>): number | undefined => {
  const counts = new Map<number, number>();
  let common: number | undefined;
  for (const s of sessions) {
    const count = (counts.get(s.packet_format) ?? 0) + 1;
    counts.set(s.packet_format, count);
    if (common === undefined || count > (counts.get(common) ?? 0)) common = s.packet_format;
  }
  return common;
};
