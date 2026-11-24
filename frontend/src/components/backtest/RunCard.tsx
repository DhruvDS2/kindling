import type { ReactNode } from 'react';
import type { ResultsRun } from '../../types';
import { Note } from './Note';
import ResultsTable from './ResultsTable';
import { bestColumns, cardStyle, columnIndex, findRow, ROLE_COLOR } from './metrics';

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A results file: its title, its note (what a hit and a false alarm mean), then every table in it. */
export default function RunCard({ run, eyebrow, tag, summary }: {
  run: ResultsRun;
  eyebrow?: string;
  tag?: string;
  summary?: ReactNode;
}) {
  return (
    <section data-run={run.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {eyebrow && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{eyebrow}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{run.title}</h3>
          {tag && (
            <span style={{
              fontSize: 11.5, fontWeight: 500, color: 'var(--muted)', border: '1px solid var(--line)',
              borderRadius: 20, padding: '2px 8px', background: 'var(--nav)',
            }}>{tag}</span>
          )}
        </div>
        <Note text={run.note} />
      </header>
      {summary}
      {run.tables.map((t, i) => <ResultsTable key={`${run.id}-${i}`} run={run} table={t} />)}
    </section>
  );
}

/**
 * A compact read of a few rows of a run's first table, naive next to Kindling.
 * Rows are found by label in the same JSON the full table prints; a row that
 * isn't there shows a dash instead of a number.
 */
export function HeadlineStats({ run, labels }: { run: ResultsRun; labels: string[] }) {
  const table = run.tables[0];
  const ni = columnIndex(table, 'naive');
  const ki = columnIndex(table, 'kindling');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))`, gap: 12 }}>
      {labels.map(label => {
        const row = findRow(table, label);
        const best = table && row ? bestColumns(table, row) : new Set<number>();
        const cell = (idx: number, role: 'naive' | 'kindling') => {
          const value = row && idx >= 0 ? row.display[idx] : '—';
          const strong = best.has(idx);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 24, lineHeight: 1.1,
                fontWeight: strong ? 700 : 400, color: strong ? 'var(--ink)' : 'var(--body)',
              }}>{value}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)' }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: ROLE_COLOR[role] ?? undefined, flexShrink: 0 }} />
                {role === 'naive' ? 'Naive' : 'Kindling'}
              </span>
            </div>
          );
        };
        return (
          <div key={label} data-headline={label} style={{
            background: 'var(--paper)', border: '1px solid var(--row-divider)', borderRadius: 10, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{sentence(row?.label ?? label)}</div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
              {cell(ni, 'naive')}
              {cell(ki, 'kindling')}
            </div>
          </div>
        );
      })}
    </div>
  );
}
