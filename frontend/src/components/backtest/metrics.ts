// Helpers for reading the results files served by GET /backtest/results.
// Nothing here computes a metric. Every number on screen is a `display` string that
// backtest.py wrote, found by row label and column name. `values` (the raw numbers next
// to each display string) are only used to size bars and to decide which value is better.
import type { ResultsRow, ResultsRun, ResultsTable } from '../../types';
import { fmtDay } from '../../nav';

export const HEADLINE_RUNS = { pql: 'pql_backtest', health: 'health_backtest' } as const;
export const DISTRICT_RUN = 'district_calendar_backtest';

// District calendars first, then the admin rule, the threshold sweep, and LR vs rules
// (docs/UI-RUN.md, decision 4). Runs the API adds later go after these, in API order.
export const EXPERIMENT_ORDER = [
  DISTRICT_RUN,
  'pql_admin_threshold',
  'threshold_sweep',
  'pql_lr_comparison',
  'health_lr_comparison',
];

/** The Makefile target that writes each results file. */
export function commandFor(runId: string): string {
  return ['pql_backtest', 'health_backtest', 'pql_lr_comparison', 'health_lr_comparison'].includes(runId)
    ? 'make backtest'
    : 'make experiments';
}

export type ColumnRole = 'naive' | 'kindling' | 'other';

/** Columns are named by backtest.py ("Naive: calendar windows", "Kindling PQL score"). */
export function columnRole(column: string): ColumnRole {
  if (/^naive\b/i.test(column)) return 'naive';
  if (/^kindling\b/i.test(column)) return 'kindling';
  return 'other';
}

/** "Naive: 5+ tutors built" → "5+ tutors built": the naive rule, in backtest.py's words. */
export function naiveRule(column: string | undefined): string | null {
  if (!column) return null;
  const rule = column.replace(/^naive\b:?\s*/i, '').trim();
  return rule || null;
}

/** The row with this label, compared without case. */
export function findRow(table: ResultsTable | undefined, label: string): ResultsRow | undefined {
  const want = label.toLowerCase();
  return table?.rows.find(r => r.label.toLowerCase() === want);
}

/** Index of the first column with this role, or matching this pattern; -1 when absent. */
export function columnIndex(table: ResultsTable | undefined, col: ColumnRole | RegExp): number {
  if (!table) return -1;
  return table.columns.findIndex(c => (col instanceof RegExp ? col.test(c) : columnRole(c) === col));
}

/** The first table of a run whose title matches, or the first table when no pattern is given. */
export function findTable(run: ResultsRun | undefined, title?: RegExp): ResultsTable | undefined {
  if (!run) return undefined;
  return title ? run.tables.find(t => t.title != null && title.test(t.title)) : run.tables[0];
}

/** The table whose rows are indexed by this name (e.g. "calendar", "threshold"). */
export function findIndexedTable(run: ResultsRun | undefined, indexName: string): ResultsTable | undefined {
  return run?.tables.find(t => t.index_name?.toLowerCase() === indexName.toLowerCase());
}

/** One cell as backtest.py printed it, found by row label and column; null when either is missing. */
export function display(table: ResultsTable | undefined, label: string, col: ColumnRole | RegExp | number): string | null {
  const row = findRow(table, label);
  const i = typeof col === 'number' ? col : columnIndex(table, col);
  if (!row || i < 0 || i >= row.display.length) return null;
  return row.display[i];
}

/** The raw number behind a cell ("17 / 22" → 17/22). Used to size bars, never printed. */
export function rawValue(row: ResultsRow | undefined, i: number): number | null {
  if (!row || i < 0) return null;
  return asNumber(row.values[i]);
}

/** Which way is better for a metric row, judged from its label. null = neither (counts like "schools flagged"). */
export function betterDirection(label: string): 'higher' | 'lower' | null {
  const l = label.toLowerCase();
  if (l.includes('false alarm') || l.startsWith('stalled schools flagged')) return 'lower';
  if (/precision|recall|lead time|\blead\b|caught|flagged ≥|later converted/.test(l)) return 'higher';
  return null;
}

/** "17 / 22" → 17/22, 0.77 → 0.77, anything else → null. */
function asNumber(v: number | string | null | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const m = v.match(/^\s*(-?[\d.]+)\s*\/\s*([\d.]+)\s*$/);
    if (m && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]);
  }
  return null;
}

/**
 * Column indexes holding the better value on a metric row (ties all count).
 * Empty when the row has no direction, when the values can't be compared,
 * or when every column is equal. Only metric tables (rows are metrics, columns
 * are the models being compared) get this; sweeps and breakdowns don't.
 */
export function bestColumns(table: ResultsTable, row: ResultsRow): Set<number> {
  if (table.index_name !== null) return new Set();
  const dir = betterDirection(row.label);
  if (!dir) return new Set();
  const nums = row.values.map(asNumber);
  const valid = nums.filter((n): n is number => n !== null);
  if (valid.length < 2) return new Set();
  const best = dir === 'higher' ? Math.max(...valid) : Math.min(...valid);
  if (valid.every(n => n === best)) return new Set();
  return new Set(nums.flatMap((n, i) => (n === best ? [i] : [])));
}

/** True when the naive column holds the better value on this row and Kindling doesn't. */
export function naiveAhead(table: ResultsTable | undefined, label: string): boolean {
  const row = findRow(table, label);
  if (!table || !row) return false;
  const best = bestColumns(table, row);
  return best.has(columnIndex(table, 'naive')) && !best.has(columnIndex(table, 'kindling'));
}

/** Rows backtest.py marks with an arrow ("60 ← config", "35 ← fall pick"). */
export const isMarkedRow = (row: ResultsRow) => row.label.includes('←');

/** "35 ← fall pick" → "35". */
export const rowKeyText = (row: ResultsRow) => row.label.split('←')[0].trim();

/** The first row whose label carries this marker ("fall pick", "config"). */
export function markedRow(table: ResultsTable | undefined, marker: string): ResultsRow | undefined {
  return table?.rows.find(r => r.label.split('←').slice(1).some(m => m.trim().toLowerCase() === marker));
}

/** "median lead time (days)" → "days". Only time units count ("recall (churners)" has none). */
export function unitOf(label: string): string | null {
  return label.match(/\((days|weeks)\)\s*$/i)?.[1] ?? null;
}

/** "churners flagged ≥45 days early" → "45". */
export function daysEarly(table: ResultsTable | undefined): string | null {
  for (const r of table?.rows ?? []) {
    const m = r.label.match(/≥\s*(\d+)\s*days/);
    if (m) return m[1];
  }
  return null;
}

/** A display string as a number for count-through: "77%" → 77 + "%". null when it isn't one number. */
export function parseDisplay(text: string | null | undefined): { n: number; suffix: string } | null {
  const m = text?.match(/^\s*(-?\d+(?:\.\d+)?)\s*(%?)\s*$/);
  return m ? { n: Number(m[1]), suffix: m[2] } : null;
}

export const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** generated_at is a real UTC timestamp, so show it in the viewer's time zone. */
export function fmtRunTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

/** "Sep 1, 2025 to Jul 27, 2026" from a run's replay range. */
export function fmtReplay(replay: { start: string; end: string } | undefined): string | null {
  return replay ? `${fmtDay(replay.start)} to ${fmtDay(replay.end)}` : null;
}

export function sortExperiments(runs: ResultsRun[]): ResultsRun[] {
  const headline = new Set<string>(Object.values(HEADLINE_RUNS));
  const rank = (id: string) => {
    const i = EXPERIMENT_ORDER.indexOf(id);
    return i === -1 ? EXPERIMENT_ORDER.length : i;
  };
  return runs
    .map((run, i) => ({ run, i }))
    .filter(({ run }) => !headline.has(run.id))
    .sort((a, b) => rank(a.run.id) - rank(b.run.id) || a.i - b.i)
    .map(({ run }) => run);
}
