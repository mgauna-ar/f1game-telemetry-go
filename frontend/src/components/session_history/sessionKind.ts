export type SessionKind = 'race' | 'qualifying' | 'sprint' | 'practice';

/** The kind of session, for the coloured edge of its row or card. */
export const sessionKind = (typeStr?: string): SessionKind | undefined => {
  if (!typeStr) return undefined;
  const lower = typeStr.toLowerCase();
  if (lower.includes('race')) return 'race';
  if (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3'))
    return 'qualifying';
  if (lower.includes('sprint')) return 'sprint';
  if (lower.includes('practice') || lower.includes('fp')) return 'practice';
  return undefined;
};
