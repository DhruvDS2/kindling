import { commandFor } from './metrics';

const code = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, background: 'var(--nav)',
  padding: '1px 6px', borderRadius: 4, color: 'var(--ink)',
} as const;

/** Results files the API looked for and didn't find, with the command that writes each one. */
export default function MissingRuns({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  const commands = [...new Set(missing.map(commandFor))];
  return (
    <div data-testid="missing-runs" role="status" style={{
      background: 'var(--card)', border: '1px solid var(--line)', borderLeft: '3px solid var(--risk)',
      borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
        Missing results: {missing.length === 1 ? 'one file was' : `${missing.length} files were`} not found
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--body)', lineHeight: 1.7 }}>
        {missing.map(id => (
          <li key={id}>
            <span style={code}>results/{id}.json</span>
            <span style={{ color: 'var(--muted)' }}> · written by </span>
            <span style={code}>{commandFor(id)}</span>
          </li>
        ))}
      </ul>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        Run {commands.map((c, i) => <span key={c}>{i > 0 && ' and '}<span style={code}>{c}</span></span>)} from the repo root, then reload.
        Until then those tables are left out rather than filled with old numbers.
      </div>
    </div>
  );
}
