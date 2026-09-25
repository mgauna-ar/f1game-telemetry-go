import { describe, it, expect } from 'vitest';
import { parseChatMarkdown } from './chatMarkdown';

describe('parseChatMarkdown', () => {
  it('joins the lines of a paragraph and splits paragraphs on blank lines', () => {
    expect(parseChatMarkdown('First line\nsecond line\n\nNext paragraph')).toEqual([
      { type: 'paragraph', lines: ['First line', 'second line'] },
      { type: 'paragraph', lines: ['Next paragraph'] },
    ]);
  });

  it('nests an indented bullet list under a numbered item', () => {
    const blocks = parseChatMarkdown('1. **Turn 4**: brake later\n   - Peak pressure fine\n   - Trail off\n2. Turn 6');
    expect(blocks).toHaveLength(1);
    const list = blocks[0];
    expect(list.type).toBe('list');
    if (list.type !== 'list') return;
    expect(list.ordered).toBe(true);
    expect(list.items).toHaveLength(2);
    expect(list.items[0].children).toHaveLength(1);
    const nested = list.items[0].children[0];
    expect(nested.type === 'list' && nested.items.map((item) => item.lines[0])).toEqual([
      'Peak pressure fine',
      'Trail off',
    ]);
  });

  it('keeps one numbered list across blank lines between items', () => {
    const blocks = parseChatMarkdown('1. One\n\n2. Two\n\n3. Three');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type === 'list' && blocks[0].items).toHaveLength(3);
  });

  it('keeps the number of a list that restarts after a paragraph', () => {
    const blocks = parseChatMarkdown('1. One\n\nSome text\n\n2. Two');
    expect(blocks.map((b) => b.type)).toEqual(['list', 'paragraph', 'list']);
    expect(blocks[2].type === 'list' && blocks[2].start).toBe(2);
  });

  it('reads a table with its alignment row', () => {
    const blocks = parseChatMarkdown('| Sector | Delta |\n|:---|---:|\n| S1 | +0.006 |\n| S2 | +0.439 |');
    expect(blocks).toEqual([
      {
        type: 'table',
        header: ['Sector', 'Delta'],
        align: ['left', 'right'],
        rows: [
          ['S1', '+0.006'],
          ['S2', '+0.439'],
        ],
      },
    ]);
  });

  it('shows a table header as text until its separator row arrives', () => {
    expect(parseChatMarkdown('| Sector | Delta |')[0].type).toBe('paragraph');
  });

  it('keeps an unfinished code block while it streams', () => {
    expect(parseChatMarkdown('```go\nfmt.Println("box")')).toEqual([
      { type: 'code', lang: 'go', text: 'fmt.Println("box")' },
    ]);
  });

  it('reads headings, rules and quotes', () => {
    expect(parseChatMarkdown('## Summary\n---\n> Tip: lift earlier').map((b) => b.type)).toEqual([
      'heading',
      'rule',
      'quote',
    ]);
  });
});
