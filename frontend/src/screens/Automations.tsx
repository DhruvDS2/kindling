import { useMemo, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AutomationRun } from '../types';
import { fetchAutomationsLog } from '../api';
import { fmtDay } from '../nav';
import { EmptyState, ErrorState, Skeleton, StatusPill, Table, type Column } from '../design';

// Automations: the n8n run log (GET /automations/log), newest first. n8n sometimes runs twice on
// one day; the repeat keeps its row (it's in the log) but is marked quietly.

const stack: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };
const DAY_OPTS: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };

/** run_at is either a day ("2026-11-16", a local calendar day: never parse it as UTC) or a full timestamp. */
function runDay(runAt: string) {
  const stamp = /T\d{2}:\d{2}/.test(runAt) ? new Date(runAt) : null;
  if (!stamp || Number.isNaN(stamp.getTime())) return { day: runAt.slice(0, 10), label: fmtDay(runAt, DAY_OPTS) };
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    day: `${stamp.getFullYear()}-${p(stamp.getMonth() + 1)}-${p(stamp.getDate())}`,
    label: `${stamp.toLocaleDateString('en-US', DAY_OPTS)} · ${stamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
  };
}

const csAlerts = (r: AutomationRun) => r.cs_alerts ?? r.health_alerts ?? null;
const sameCounts = (a: AutomationRun, b: AutomationRun) =>
  a.pql_alerts === b.pql_alerts && csAlerts(a) === csAlerts(b) && a.email_drafts === b.email_drafts && a.status === b.status;

interface Row {
  key: string;
  run: AutomationRun;
  label: string;
  /** The local calendar day, YYYY-MM-DD. */
  day: string;
  /** Set on the second and later runs of one day. */
  repeat: 'duplicate' | 'same-day' | null;
}

export default function Automations() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<AutomationRun[]>({ queryKey: ['automations'], queryFn: () => fetchAutomationsLog() });

  const rows = useMemo<Row[]>(() => {
    // Newest first. ISO strings sort by time; for one day the later log entry comes first.
    const sorted = (data ?? [])
      .map((run, i) => ({ run, i, ...runDay(run.run_at) }))
      .sort((a, b) => b.run.run_at.localeCompare(a.run.run_at) || b.i - a.i);
    return sorted.map((r, n) => {
      const above = sorted[n - 1];
      const repeat = above && above.day === r.day ? (sameCounts(above.run, r.run) ? 'duplicate' : 'same-day') : null;
      return { key: r.run.id ?? `${r.run.run_at}#${r.i}`, run: r.run, label: r.label, day: r.day, repeat };
    });
  }, [data]);

  const lastSent = rows.find(r => r.run.status === 'succeeded');

  const columns = useMemo<Column<Row>[]>(() => [
    {
      id: 'date', header: 'Run date', width: '34%', skeleton: '55%',
      cell: r => {
        const note = [
          r.repeat === 'duplicate' ? 'Repeat of the run above' : r.repeat === 'same-day' ? 'Same day as the run above' : null,
          r.run.trigger ?? null,
        ].filter(Boolean).join(' · ');
        return (
          <div style={stack}>
            <span className={r.repeat ? 'k-tertiary' : undefined} title={r.run.run_at}>{r.label}</span>
            {note && <span className="k-text-sm k-tertiary">{note}</span>}
          </div>
        );
      },
    },
    { id: 'sales', header: 'Sales alerts', numeric: true, width: '13%', skeleton: '30%', cell: r => <span className={r.repeat ? 'k-tertiary' : undefined}>{r.run.pql_alerts}</span> },
    {
      id: 'cs', header: 'CS alerts', numeric: true, width: '13%', skeleton: '30%',
      cell: r => <span className={r.repeat ? 'k-tertiary' : undefined}>{csAlerts(r.run) ?? '—'}</span>,
    },
    { id: 'emails', header: 'Emails', numeric: true, width: '13%', skeleton: '30%', cell: r => <span className={r.repeat ? 'k-tertiary' : undefined}>{r.run.email_drafts}</span> },
    { id: 'gap', header: '', width: '4%', skeleton: false, cell: () => null },
    {
      id: 'status', header: 'Status', skeleton: '25%',
      cell: r => (r.run.status === 'succeeded'
        ? <StatusPill tone="healthy">Succeeded</StatusPill>
        : <StatusPill tone="risk">Failed</StatusPill>),
    },
  ], []);

  return (
    <div data-testid="automations" style={{ ...stack, gap: 'var(--space-1-5)' }}>
      <p className="k-text-md k-secondary" style={{ margin: 0 }}>
        {isLoading ? <Skeleton width="30%" /> : (
          <>
            <span className="k-primary k-medium">Alert runs from n8n</span>
            {' · '}
            {lastSent ? `last sent ${fmtDay(lastSent.day)}` : rows.length ? 'none sent yet' : 'no runs yet'}
          </>
        )}
      </p>
      <Table
        aria-label="n8n alert runs, newest first"
        rows={rows}
        columns={columns}
        rowKey={r => r.key}
        rowLabel={r => r.label}
        loading={isLoading}
        skeletonRows={5}
        error={error ? (
          <ErrorState
            title="Couldn't load the n8n run log."
            detail={(error as Error).message}
            onRetry={() => { void refetch(); }}
            retrying={isFetching}
          />
        ) : undefined}
        empty={
          <EmptyState action={{ label: 'Check again', onClick: () => { void refetch(); } }}>
            No alert runs yet. Each weekly n8n run is logged here with the alerts it sent.
          </EmptyState>
        }
      />
    </div>
  );
}
