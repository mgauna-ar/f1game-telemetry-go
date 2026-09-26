import React from 'react';

export interface MarkdownRenderOptions {
  containerClassName?: string;
  heading1ClassName?: string;
  heading2ClassName?: string;
  heading3ClassName?: string;
  heading4ClassName?: string;
  bulletItemClassName?: string;
  bulletDotClassName?: string;
  bulletTextClassName?: string;
  paragraphClassName?: string;
  spacerClassName?: string;
  tableClassName?: string;
  strongStyle?: React.CSSProperties;
}

const DEFAULT_STRONG_STYLE: React.CSSProperties = { color: '#fff', fontWeight: 600 };

// One alternative per inline token, in order: **bold**, `code`, [text](https://url), *italic*, _italic_.
// Emphasis markers must hug the text (so "2 * 3 * 4" stays as is) and underscores inside words
// (tyre_wear_pct) are not emphasis. Links only accept http(s) URLs.
const INLINE_TOKEN =
  /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(?<![*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?![*\w])|(?<!\w)_(?![\s_])(.+?)(?<![\s_])_(?!\w)/g;

const TABLE_SEPARATOR_ROW = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

const isTableRow = (line: string): boolean => line.startsWith('|');

const splitTableRow = (line: string): string[] =>
  line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

/**
 * Formats inline markdown: **bold**, *italic* or _italic_, `code` and [links](https://…).
 */
export function formatInlineMarkdown(
  text: string,
  strongStyle?: React.CSSProperties,
  keyPrefix = 'md'
): React.ReactNode {
  if (!text) return text;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;

  for (const match of text.matchAll(INLINE_TOKEN)) {
    const idx = match.index ?? 0;
    if (idx > lastIdx) {
      parts.push(text.substring(lastIdx, idx));
    }

    const key = `${keyPrefix}-${idx}`;
    const [, bold, code, linkText, linkUrl, starItalic, underscoreItalic] = match;
    if (bold !== undefined) {
      parts.push(
        <strong key={key} style={strongStyle || DEFAULT_STRONG_STYLE}>
          {formatInlineMarkdown(bold, strongStyle, key)}
        </strong>
      );
    } else if (code !== undefined) {
      parts.push(
        <code key={key} className="md-inline-code">
          {code}
        </code>
      );
    } else if (linkText !== undefined) {
      parts.push(
        <a key={key} href={linkUrl} target="_blank" rel="noopener noreferrer" className="md-link">
          {formatInlineMarkdown(linkText, strongStyle, key)}
        </a>
      );
    } else {
      parts.push(<em key={key}>{formatInlineMarkdown(starItalic ?? underscoreItalic, strongStyle, key)}</em>);
    }
    lastIdx = idx + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Parses simple markdown: headers, bullet lists, ordered lists, pipe tables, and paragraphs.
 */
export function renderSimpleMarkdown(
  content?: string,
  options: MarkdownRenderOptions = {}
): React.ReactNode {
  if (!content) return null;

  const {
    containerClassName = 'markdown-content',
    heading1ClassName = 'rn-heading-1',
    heading2ClassName = 'rn-heading-2',
    heading3ClassName = 'rn-heading-3',
    heading4ClassName = 'rn-heading-4',
    bulletItemClassName = 'rn-bullet-item',
    bulletDotClassName = 'rn-bullet-dot',
    bulletTextClassName = 'rn-bullet-text',
    paragraphClassName = 'rn-paragraph',
    spacerClassName = 'rn-spacer',
    tableClassName = 'md-table',
    strongStyle,
  } = options;

  const renderLine = (trimmed: string, idx: number): React.ReactNode => {
    if (!trimmed) {
      return <div key={idx} className={spacerClassName} style={{ height: '0.35rem' }} />;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      return (
        <h5 key={idx} className={heading4ClassName}>
          {formatInlineMarkdown(trimmed.substring(5), strongStyle)}
        </h5>
      );
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={idx} className={heading3ClassName}>
          {formatInlineMarkdown(trimmed.substring(4), strongStyle)}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={idx} className={heading2ClassName}>
          {formatInlineMarkdown(trimmed.substring(3), strongStyle)}
        </h3>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h2 key={idx} className={heading1ClassName}>
          {formatInlineMarkdown(trimmed.substring(2), strongStyle)}
        </h2>
      );
    }

    // Bullet points
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const bulletText = trimmed.substring(2);
      return (
        <div key={idx} className={bulletItemClassName}>
          <span className={bulletDotClassName}>•</span>
          <span className={bulletTextClassName}>{formatInlineMarkdown(bulletText, strongStyle)}</span>
        </div>
      );
    }

    // Numbered list
    const numbered = trimmed.match(/^(\d+)\.\s(.*)$/);
    if (numbered) {
      return (
        <div key={idx} className={bulletItemClassName}>
          <span className={`${bulletDotClassName} mono`}>{numbered[1]}.</span>
          <span className={bulletTextClassName}>{formatInlineMarkdown(numbered[2], strongStyle)}</span>
        </div>
      );
    }

    // Standard paragraph
    return (
      <p key={idx} className={paragraphClassName}>
        {formatInlineMarkdown(trimmed, strongStyle)}
      </p>
    );
  };

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Pipe table: a header row, a |---|---| separator row, then body rows
    if (isTableRow(trimmed) && i + 1 < lines.length && TABLE_SEPARATOR_ROW.test(lines[i + 1].trim())) {
      const tableStart = i;
      const header = splitTableRow(trimmed);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i].trim())) {
        rows.push(splitTableRow(lines[i].trim()));
        i++;
      }

      blocks.push(
        <div key={`table-${tableStart}`} className="md-table-wrap">
          <table className={tableClassName}>
            <thead>
              <tr>
                {header.map((cell, c) => (
                  <th key={c}>{formatInlineMarkdown(cell, strongStyle)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {header.map((_, c) => (
                    <td key={c}>{formatInlineMarkdown(row[c] ?? '', strongStyle)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    blocks.push(renderLine(trimmed, i));
    i++;
  }

  return <div className={containerClassName}>{blocks}</div>;
}
