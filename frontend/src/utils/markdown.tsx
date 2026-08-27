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
  strongStyle?: React.CSSProperties;
}

/**
 * Formats inline markdown such as **bold** text.
 */
export function formatInlineMarkdown(text: string, strongStyle?: React.CSSProperties): React.ReactNode {
  if (!text) return text;
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.*?)\*\*/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }
    parts.push(
      <strong key={`b-${match.index}`} style={strongStyle || { color: '#fff', fontWeight: 600 }}>
        {match[1]}
      </strong>
    );
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Parses simple markdown headers, bullet lists, ordered lists, and paragraphs.
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
    strongStyle,
  } = options;

  const lines = content.split('\n');

  return (
    <div className={containerClassName}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className={spacerClassName} style={{ height: '0.35rem' }} />;
        }

        // Headings
        if (trimmed.startsWith('#### ')) {
          return (
            <h5 key={idx} className={heading4ClassName}>
              {trimmed.replace('#### ', '')}
            </h5>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className={heading3ClassName}>
              {trimmed.replace('### ', '')}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className={heading2ClassName}>
              {trimmed.replace('## ', '')}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className={heading1ClassName}>
              {trimmed.replace('# ', '')}
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
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <div key={idx} className={bulletItemClassName}>
                <span className={`${bulletDotClassName} mono`}>{match[1]}.</span>
                <span className={bulletTextClassName}>{formatInlineMarkdown(match[2], strongStyle)}</span>
              </div>
            );
          }
        }

        // Standard paragraph
        return (
          <p key={idx} className={paragraphClassName}>
            {formatInlineMarkdown(trimmed, strongStyle)}
          </p>
        );
      })}
    </div>
  );
}
