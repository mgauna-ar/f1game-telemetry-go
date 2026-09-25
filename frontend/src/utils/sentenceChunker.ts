/**
 * Sentence end: terminal punctuation (plus any closing quotes or brackets) followed by
 * whitespace, or a line break. A decimal point such as "1.2" is followed by a digit, not
 * whitespace, so it never splits.
 */
const SENTENCE_END = /[.!?…]+["'”’)\]]*\s+|\n+/g;

export interface SentenceChunker {
  /** Adds streamed text and emits every sentence it completes. */
  push: (text: string) => void;
  /** Emits whatever text is left once the stream ends. */
  flush: () => void;
}

/**
 * Splits streamed text into sentences as they complete, so each one can be spoken
 * while the rest of the reply is still arriving.
 */
export function createSentenceChunker(onSentence: (sentence: string) => void): SentenceChunker {
  let buffer = '';

  const emit = (text: string) => {
    const sentence = text.trim();
    if (sentence) onSentence(sentence);
  };

  return {
    push(text: string) {
      buffer += text;
      let start = 0;
      SENTENCE_END.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SENTENCE_END.exec(buffer)) !== null) {
        const end = match.index + match[0].length;
        emit(buffer.slice(start, end));
        start = end;
      }
      buffer = buffer.slice(start);
    },
    flush() {
      emit(buffer);
      buffer = '';
    },
  };
}
