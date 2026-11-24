import type { CSSProperties } from 'react';

// The notes in results/*.json are the same markdown the .md files print:
// **bold**, *italic* and `code` only. Render those three, as text (never as HTML).
const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;

export function InlineMd({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`')) {
          return (
            <code key={i} style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.92em', background: 'var(--nav)',
              padding: '1px 4px', borderRadius: 4, color: 'var(--ink)',
            }}>{p.slice(1, -1)}</code>
          );
        }
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function Note({ text, style }: { text: string | null | undefined; style?: CSSProperties }) {
  if (!text) return null;
  return (
    <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--body)', margin: 0, ...style }}>
      <InlineMd text={text} />
    </p>
  );
}
