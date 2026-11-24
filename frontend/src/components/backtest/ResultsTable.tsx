import { useMemo } from 'react';
import { Table, type Column } from '../../design';
import type { ResultsRow, ResultsRun, ResultsTable as ResultsTableData } from '../../types';
import { bestColumns, isMarkedRow, sentenceCase } from './metrics';
import { Note } from './Note';
import SourceStamp from './SourceStamp';

interface Row { row: ResultsRow; i: number }

/**
 * One table from a results file, printed exactly as backtest.py formatted it
 * (`rows[].display`), every row included, in the base Table (right-aligned tabular numbers).
 * The better value on a metric row is set darker, whichever column it is in.
 * Always ends with the file, run time and commit.
 */
export default function ResultsTable({ run, table, heading }: { run: ResultsRun; table: ResultsTableData; heading?: string | null }) {
  const rows = useMemo<Row[]>(() => table.rows.map((row, i) => ({ row, i })), [table]);
  const best = useMemo(() => table.rows.map(r => bestColumns(table, r)), [table]);
  const indexed = table.index_name !== null;
  const title = heading === undefined ? table.title : heading;

  const columns = useMemo<Column<Row>[]>(() => [
    {
      id: 'label',
      header: <span className="bt-th">{sentenceCase(table.index_name ?? 'Metric')}</span>,
      width: indexed ? (table.columns.length > 4 ? '18%' : '28%') : '40%',
      cell: ({ row }) => (
        <span className={isMarkedRow(row) ? 'bt-cell-label is-marked' : 'bt-cell-label'}>
          {indexed ? row.label : sentenceCase(row.label)}
        </span>
      ),
    },
    ...table.columns.map<Column<Row>>((col, c) => ({
      id: `c${c}`,
      numeric: true,
      header: <span className="bt-th">{col}</span>,
      cell: ({ row, i }) => (
        <span className={best[i].has(c) ? 'bt-cell is-best' : 'bt-cell'}>{row.display[c] ?? '—'}</span>
      ),
    })),
  ], [table, best, indexed]);

  const label = [run.title, title].filter(Boolean).join(': ');
  return (
    <div className="bt-result" data-testid="results-table" data-run={run.id}>
      {title && <h4 className="bt-result__title">{title}</h4>}
      <Table<Row> rows={rows} columns={columns} rowKey={r => `${r.i}`} aria-label={label} rowLabel={r => r.row.label} />
      <Note text={table.note} className="bt-result__note" />
      <SourceStamp run={run} />
    </div>
  );
}
