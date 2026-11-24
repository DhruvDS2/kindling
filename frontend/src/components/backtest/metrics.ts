// Helpers for reading the results files served by GET /backtest/results.
// Nothing here computes a metric: every number on screen is a `display` string
// that backtest.py wrote. These helpers only find rows, name columns, and decide
// which of the already-printed values to set in bold.
import type { ResultsRow, ResultsRun, ResultsTable } from '../../types';

export const cardStyle = {
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: 24,
} as const;

export const HEADLINE_RUNS = { pql: 'pql_backtest', health: 'health_backtest' } as const;

// District calendars first, then the admin rule, the threshold sweep, and LR vs rules
// (docs/UI-RUN.md, decision 4). Runs the API adds later go after these, in API order.
export const EXPERIMENT_ORDER = [
  'district_calendar_backtest',
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

export const ROLE_COLOR: Record<ColumnRole, string | null> = {
  naive: 'var(--naive)',
  kindling: 'var(--ember)',
  other: null,
};

/** The row with this label, compared without case. */
export function findRow(table: ResultsTable | undefined, label: string): ResultsRow | undefined {
  const want = label.toLowerCase();
  return table?.rows.find(r => r.label.toLowerCase() === want);
}

/** Index of the first column with this role, or -1. */
export function columnIndex(table: ResultsTable | undefined, role: ColumnRole): number {
  return table ? table.columns.findIndex(c => columnRole(c) === role) : -1;
}

/** Which way is better for a metric row, judged from its label. null = neither (counts like "schools flagged"). */
export function betterDirection(label: string): 'higher' | 'lower' | null {
  const l = label.toLowerCase();
  if (l.includes('false alarm') || l.startsWith('stalled schools flagged')) return 'lower';
  if (/precision|recall|lead time|\blead\b|caught|flagged ≥|later converted/.test(l)) return 'higher';
  return null;
}

/** "17 / 22" → 17/22, 0.77 → 0.77, anything else → null. */
function asNumber(v: number | string | null): number | null {
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

/** Rows backtest.py marks with an arrow ("60 ← config", "35 ← fall pick"). */
export const isMarkedRow = (row: ResultsRow) => row.label.includes('←');

/** generated_at is a real UTC timestamp, so show it in the viewer's time zone. */
export function fmtRunTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
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
