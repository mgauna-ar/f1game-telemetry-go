import { describe, it, expect } from 'vitest';
import { createSentenceChunker } from './sentenceChunker';

function chunk(parts: string[]): string[] {
  const sentences: string[] = [];
  const chunker = createSentenceChunker((s) => sentences.push(s));
  for (const part of parts) chunker.push(part);
  chunker.flush();
  return sentences;
}

describe('createSentenceChunker', () => {
  it('emits sentences as soon as they complete across stream chunks', () => {
    const sentences: string[] = [];
    const chunker = createSentenceChunker((s) => sentences.push(s));

    chunker.push('Copy. Gap to Lec');
    expect(sentences).toEqual(['Copy.']);

    chunker.push('lerc is 1.2 seconds');
    expect(sentences).toEqual(['Copy.']);

    chunker.push(' and closing! Keep ');
    expect(sentences).toEqual(['Copy.', 'Gap to Leclerc is 1.2 seconds and closing!']);

    chunker.flush();
    expect(sentences).toEqual(['Copy.', 'Gap to Leclerc is 1.2 seconds and closing!', 'Keep']);
  });

  it('does not split decimals, lap times or a sentence end still waiting for whitespace', () => {
    expect(chunk(['Last lap 1:31.4', '00, best 1:30.9', '. Fuel +0.4 laps.'])).toEqual([
      'Last lap 1:31.400, best 1:30.9.',
      'Fuel +0.4 laps.',
    ]);
  });

  it('splits on question marks, ellipses, closing quotes and line breaks', () => {
    expect(chunk(['¿Me copiás? Boxes, boxes… "Confirmá gomas." ', 'Hards\nlisto'])).toEqual([
      '¿Me copiás?',
      'Boxes, boxes…',
      '"Confirmá gomas."',
      'Hards',
      'listo',
    ]);
  });

  it('emits nothing for an empty or blank stream', () => {
    expect(chunk([])).toEqual([]);
    expect(chunk(['  ', '\n'])).toEqual([]);
  });
});
