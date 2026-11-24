// The notes in results/*.json are the same markdown the .md files print:
// **bold**, *italic* and `code` only. Render those three, as text (never as HTML).
const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;

export function InlineMd({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="bt-strong">{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="bt-code">{p.slice(1, -1)}</code>;
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/** A note from a results file, in quiet body text. */
export function Note({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  return (
    <p className={['bt-note', className ?? ''].join(' ').trim()}>
      <InlineMd text={text} />
    </p>
  );
}
