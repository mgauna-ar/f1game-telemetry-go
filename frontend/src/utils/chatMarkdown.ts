/**
 * Block structure of AI chat replies: headings, paragraphs, nested lists, tables, code, quotes and
 * rules. `components/ai_engineer/ChatMarkdown.tsx` renders them. Text that is still streaming in
 * parses as far as it goes, so an unfinished table or code block shows as text until it completes.
 */

export type ChatBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { type: 'table'; header: string[]; align: CellAlign[]; rows: string[][] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'quote'; blocks: ChatBlock[] }
  | { type: 'rule' };

export interface ListItem {
  lines: string[];
  children: ChatBlock[];
}

export type CellAlign = 'left' | 'center' | 'right' | null;

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const RULE = /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const FENCE = /^\s*(```|~~~)\s*([\w+-]*)\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

const indentOf = (line: string): number => {
  let width = 0;
  for (const ch of line) {
    if (ch === ' ') width += 1;
    else if (ch === '\t') width += 4;
    else break;
  }
  return width;
};

const isBlank = (line: string | undefined): boolean => line === undefined || line.trim() === '';

const splitRow = (line: string): string[] => {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
};

const parseAlign = (cell: string): CellAlign => {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
};

/** Whether a table header and its separator row start at line `i`. */
const isTableStart = (lines: string[], i: number): boolean =>
  lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && TABLE_SEPARATOR.test(lines[i + 1]);

/** Whether `line` starts a block other than a paragraph, so a paragraph must stop before it. */
const startsBlock = (lines: string[], i: number): boolean => {
  const line = lines[i];
  return (
    HEADING.test(line.trim()) ||
    RULE.test(line) ||
    FENCE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    isTableStart(lines, i)
  );
};

const isOrdered = (marker: string): boolean => /\d/.test(marker);

function parseList(lines: string[], start: number): { block: ChatBlock; next: number } {
  const first = LIST_ITEM.exec(lines[start])!;
  const baseIndent = indentOf(lines[start]);
  const ordered = isOrdered(first[2]);
  const items: ListItem[] = [];
  let afterBlank = false;
  let i = start;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      // A blank line ends the list unless another item, or more of the current one, follows it.
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j++;
      if (j >= lines.length) break;
      const nextIndent = indentOf(lines[j]);
      const after = LIST_ITEM.exec(lines[j]);
      const sibling =
        after !== null && nextIndent >= baseIndent && nextIndent <= baseIndent + 1 && isOrdered(after[2]) === ordered;
      const inner = items.length > 0 && nextIndent > baseIndent + 1;
      if (!sibling && !inner) break;
      afterBlank = true;
      i = j;
      continue;
    }

    const indent = indentOf(line);
    if (indent < baseIndent) break;

    const match = LIST_ITEM.exec(line);
    if (match && indent <= baseIndent + 1) {
      if (isOrdered(match[2]) !== ordered) break;
      items.push({ lines: [match[3]], children: [] });
      afterBlank = false;
      i++;
      continue;
    }

    const current = items[items.length - 1];
    if (!current || indent <= baseIndent + 1) break;

    if (match) {
      const nested = parseList(lines, i);
      current.children.push(nested.block);
      i = nested.next;
      continue;
    }

    // Deeper indented text is more of the current item.
    const text = collectIndented(lines, i, baseIndent + 1);
    const { blocks } = parseBlocks(text);
    if (!afterBlank && current.children.length === 0 && blocks.every((b) => b.type === 'paragraph')) {
      current.lines.push(...blocks.flatMap((b) => (b.type === 'paragraph' ? b.lines : [])));
    } else {
      current.children.push(...blocks);
    }
    afterBlank = false;
    i += text.length;
  }

  const startNumber = ordered ? parseInt(first[2], 10) : 1;
  return { block: { type: 'list', ordered, start: startNumber, items }, next: i };
}

/** The run of lines from `start` indented deeper than `minIndent`, without their indentation. */
function collectIndented(lines: string[], start: number, minIndent: number): string[] {
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || indentOf(line) <= minIndent || LIST_ITEM.test(line)) break;
    out.push(line.trim());
  }
  return out;
}

function parseBlocks(lines: string[]): { blocks: ChatBlock[]; lines: number } {
  const blocks: ChatBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence, when it has arrived
      blocks.push({ type: 'code', lang: fence[2], text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoted.push(QUOTE.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(quoted).blocks });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map(parseAlign);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', header, align, rows });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }

    const paragraph: string[] = [trimmed];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) {
      paragraph.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'paragraph', lines: paragraph });
  }

  return { blocks, lines: lines.length };
}

/** Parses markdown into blocks. Exported for tests. */
export function parseChatMarkdown(content: string): ChatBlock[] {
  return parseBlocks(content.replace(/\r\n?/g, '\n').split('\n')).blocks;
}
