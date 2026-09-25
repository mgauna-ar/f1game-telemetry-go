import React from 'react';
import { parseChatMarkdown, type ChatBlock } from '../../utils/chatMarkdown';

// Inline formatting: `code`, **bold**, __bold__, ~~strike~~, *italic*, _italic_ and [links](url).
const INLINE =
  /(`+)([\s\S]*?[^`])\1(?!`)|\*\*(?=\S)([\s\S]*?\S)\*\*|(?<!\w)__(?=\S)([\s\S]*?\S)__(?!\w)|~~(?=\S)([\s\S]*?\S)~~|(?<![\w*])\*(?=[^\s*])([\s\S]*?[^\s*])\*(?!\*)|(?<!\w)_(?=[^\s_])([\s\S]*?[^\s_])_(?!\w)|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

const SAFE_LINK = /^(https?:|mailto:)/i;

function renderInline(text: string, keyPrefix = 'i'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const index = m.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const key = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined) {
      out.push(
        <code key={key} className="chat-md-inline-code">
          {m[2].trim() === '' ? m[2] : m[2].replace(/^ (.*) $/, '$1')}
        </code>
      );
    } else if (m[3] !== undefined || m[4] !== undefined) {
      out.push(<strong key={key}>{renderInline(m[3] ?? m[4], key)}</strong>);
    } else if (m[5] !== undefined) {
      out.push(<del key={key}>{renderInline(m[5], key)}</del>);
    } else if (m[6] !== undefined || m[7] !== undefined) {
      out.push(<em key={key}>{renderInline(m[6] ?? m[7], key)}</em>);
    } else if (m[8] !== undefined) {
      const href = m[9];
      out.push(
        SAFE_LINK.test(href) ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {renderInline(m[8], key)}
          </a>
        ) : (
          <span key={key}>{renderInline(m[8], key)}</span>
        )
      );
    }
    last = index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const renderLines = (lines: string[], key: string): React.ReactNode[] =>
  lines.flatMap((line, idx) => {
    const parts = renderInline(line, `${key}-${idx}`);
    return idx === 0 ? parts : [<br key={`${key}-br-${idx}`} />, ...parts];
  });

/** A cell holding only a number, a time or a delta, which reads best right-aligned in monospace. */
const NUMERIC_CELL = /^[+\-−±~]?\d[\d.,:']*\s?(s|ms|%|km\/h|kph|mph|°c|°|l|kg|laps?|pts?)?$/i;

const isNumericCell = (cell: string): boolean => NUMERIC_CELL.test(cell.replace(/[*_`~]/g, '').trim());

function renderBlock(block: ChatBlock, key: string): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      // Replies are shown inside a small panel, so the biggest heading is h3.
      const level = Math.min(Math.max(block.level + 1, 3), 5);
      const Tag = `h${level}` as 'h3' | 'h4' | 'h5';
      return (
        <Tag key={key} className={`chat-md-h chat-md-h${level}`}>
          {renderInline(block.text, key)}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p key={key} className="chat-md-p">
          {renderLines(block.lines, key)}
        </p>
      );
    case 'list': {
      const items = block.items.map((item, idx) => (
        <li key={`${key}-${idx}`}>
          {renderLines(item.lines, `${key}-${idx}`)}
          {item.children.map((child, c) => renderBlock(child, `${key}-${idx}-${c}`))}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} className="chat-md-list" start={block.start !== 1 ? block.start : undefined}>
          {items}
        </ol>
      ) : (
        <ul key={key} className="chat-md-list">
          {items}
        </ul>
      );
    }
    case 'table': {
      const numericCols = block.header.map(
        (_, col) => block.rows.length > 0 && block.rows.every((row) => !row[col] || isNumericCell(row[col]))
      );
      const alignOf = (col: number): React.CSSProperties['textAlign'] =>
        block.align[col] ?? (numericCols[col] ? 'right' : undefined);
      return (
        <div key={key} className="chat-md-table-wrap">
          <table className="chat-md-table">
            <thead>
              <tr>
                {block.header.map((cell, col) => (
                  <th key={col} style={{ textAlign: alignOf(col) }}>
                    {renderInline(cell, `${key}-h${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {block.header.map((_, col) => (
                    <td
                      key={col}
                      className={numericCols[col] ? 'chat-md-num' : undefined}
                      style={{ textAlign: alignOf(col) }}
                    >
                      {renderInline(row[col] ?? '', `${key}-${r}-${col}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'code':
      return (
        <pre key={key} className="chat-md-pre">
          <code>{block.text}</code>
        </pre>
      );
    case 'quote':
      return (
        <blockquote key={key} className="chat-md-quote">
          {block.blocks.map((child, idx) => renderBlock(child, `${key}-${idx}`))}
        </blockquote>
      );
    case 'rule':
      return <hr key={key} className="chat-md-rule" />;
  }
}

/**
 * Renders an AI chat reply from markdown: the blocks from `parseChatMarkdown`, with bold, italic,
 * strikethrough, inline code and links inside them. It builds React elements, never raw HTML.
 */
export const ChatMarkdown: React.FC<{ content: string }> = React.memo(({ content }) => (
  <div className="chat-md">{parseChatMarkdown(content).map((block, idx) => renderBlock(block, `b${idx}`))}</div>
));
ChatMarkdown.displayName = 'ChatMarkdown';
