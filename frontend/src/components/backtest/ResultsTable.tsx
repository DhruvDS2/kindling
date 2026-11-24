import type { ResultsRun, ResultsTable as Table } from '../../types';
import { bestColumns, columnRole, isMarkedRow, ROLE_COLOR } from './metrics';
import { Note } from './Note';
import SourceStamp from './SourceStamp';

const mono = 'JetBrains Mono, monospace';

/**
 * One table from a results file, printed exactly as backtest.py formatted it
 * (`rows[].display`), every row included. Bold marks the better value on a metric
 * row, whichever column it is in. Always ends with the file, run time and commit.
 */
export default function ResultsTable({ run, table }: { run: ResultsRun; table: Table }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {table.title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{table.title}</div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <th scope="col" style={{
                padding: '6px 12px 8px 0', textAlign: 'left', fontSize: 12, fontWeight: 500,
                color: 'var(--muted)', verticalAlign: 'bottom',
              }}>
                {table.index_name ?? ''}
              </th>
              {table.columns.map((col, i) => {
                const swatch = ROLE_COLOR[columnRole(col)];
                return (
                  <th key={`${i}-${col}`} scope="col" style={{
                    padding: '6px 0 8px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500,
                    color: swatch ? 'var(--ink)' : 'var(--muted)', verticalAlign: 'bottom', minWidth: 92,
                    lineHeight: 1.35,
                  }}>
                    {swatch && (
                      <span aria-hidden style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: swatch,
                        marginRight: 6, verticalAlign: 'baseline',
                      }} />
                    )}
                    {col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => {
              const best = bestColumns(table, row);
              const marked = isMarkedRow(row);
              return (
                <tr key={`${r}-${row.label}`} style={{
                  borderBottom: r < table.rows.length - 1 ? '1px solid var(--row-divider)' : 'none',
                  background: marked ? 'var(--nav)' : 'transparent',
                }}>
                  <th scope="row" style={{
                    padding: '7px 12px 7px 0', textAlign: 'left', fontWeight: marked ? 600 : 400,
                    color: 'var(--body)', fontFamily: table.index_name ? mono : 'inherit',
                    fontSize: table.index_name ? 12.5 : 13,
                  }}>
                    {row.label}
                  </th>
                  {row.display.map((cell, c) => (
                    <td key={c} style={{
                      padding: '7px 0 7px 16px', textAlign: 'right', fontFamily: mono,
                      fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                      fontWeight: best.has(c) ? 700 : 400,
                      color: best.has(c) ? 'var(--ink)' : 'var(--body)',
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Note text={table.note} style={{ fontSize: 12.5, color: 'var(--muted)' }} />
      <div style={{ borderTop: '1px solid var(--row-divider)', paddingTop: 8 }}>
        <SourceStamp run={run} />
      </div>
    </div>
  );
}
