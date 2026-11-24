import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPipelineFunnel, fetchPql, postSnapshot } from '../api';
import { useAsOf } from '../asOf';
import { fmtDay } from '../nav';
import type { FunnelSnapshot, PipelineFunnelData, StageMove } from '../types';
import {
  Button, EmptyState, ErrorState, StatRow, StatusPill, Table, TruncatedText,
  fmtShort, statusTone, type Column,
} from '../design';

// Pipeline: the stat row is live (free schools scored for as_of, GET /pql). The history below is
// saved snapshots (GET /pipeline/funnel); the stats compare against the newest snapshot taken
// before the date on screen.

const stack: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };

/** "+2", "−3" (true minus sign), "0". */
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function SectionHead({ title, context, aside }: { title: ReactNode; context?: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-1-5)' }}>
      <div style={{ ...stack, flex: 1, gap: 'var(--space-0-5)' }}>
        <h2 className="k-text-lg k-medium k-primary">{title}</h2>
        {context && <p className="k-text-sm k-tertiary" style={{ margin: 0 }}>{context}</p>}
      </div>
      {aside}
    </div>
  );
}

type SnapshotRow = FunnelSnapshot & { change: number | null; compared: boolean; after: boolean; current: boolean };

export default function Pipeline() {
  const { asOf, meta } = useAsOf();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pql = useQuery({ queryKey: ['pql', asOf], queryFn: () => fetchPql(asOf), placeholderData: keepPreviousData });
  const funnel = useQuery<PipelineFunnelData>({ queryKey: ['pipeline'], queryFn: fetchPipelineFunnel });

  // Saves every free school's status for as_of (POST /snapshot/pql). Only ever on a click.
  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await postSnapshot(asOf);
      await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  const day = fmtDay(asOf);
  const scores = pql.data;
  const live = scores && {
    total: scores.length,
    ready: scores.filter(s => s.status === 'Ready').length,
    notYet: scores.filter(s => s.status === 'Not yet').length,
  };
  const snapshots = useMemo(() => funnel.data?.snapshots ?? [], [funnel.data]);
  // The newest snapshot taken before the date on screen: what "this week" is compared to.
  const base = useMemo(
    () => [...snapshots].filter(s => s.as_of < asOf).sort((a, b) => a.as_of.localeCompare(b.as_of)).at(-1) ?? null,
    [snapshots, asOf],
  );
  const savedForDay = snapshots.some(s => s.as_of === asOf);

  const historyRows = useMemo<SnapshotRow[]>(() => {
    const asc = [...snapshots].sort((a, b) => a.as_of.localeCompare(b.as_of));
    return asc.map((s, i) => ({
      ...s,
      change: i > 0 ? s.ready - asc[i - 1].ready : null,
      compared: s.as_of === base?.as_of,
      after: s.as_of > asOf,
      current: s.as_of === asOf,
    })).reverse();
  }, [snapshots, base, asOf]);

  const context = (n: number | undefined, then: number | undefined, outOf: string) => {
    if (n == null) return undefined;
    if (base && then != null) return `${n === then ? 'No change' : signed(n - then)} since the ${fmtShort(base.as_of)} snapshot`;
    return outOf;
  };

  const historyColumns = useMemo<Column<SnapshotRow>[]>(() => [
    {
      id: 'date', header: 'Snapshot', width: '34%', skeleton: '50%',
      cell: r => {
        const note = r.current ? 'The date on screen' : r.compared ? 'Compared above' : r.after ? `After ${fmtShort(asOf)}` : null;
        return (
          <div style={stack}>
            <span className={r.after ? 'k-tertiary' : undefined}>{fmtDay(r.as_of)}</span>
            {note && <span className="k-text-sm k-tertiary">{note}</span>}
          </div>
        );
      },
    },
    { id: 'ready', header: 'Ready', numeric: true, width: '14%', cell: r => <span className={r.after ? 'k-tertiary' : undefined}>{r.ready}</span> },
    { id: 'notYet', header: 'Not yet', numeric: true, width: '14%', cell: r => <span className={r.after ? 'k-tertiary' : undefined}>{r.not_yet}</span> },
    {
      id: 'change', header: 'Change in Ready', numeric: true, width: '16%',
      cell: r => (r.change == null ? <span className="k-tertiary">—</span> : <span className={r.after ? 'k-tertiary' : 'k-secondary'}>{signed(r.change)}</span>),
    },
    { id: 'spacer', header: '', skeleton: false, cell: () => null },
  ], [asOf]);

  const moveColumns = useMemo<Column<StageMove>[]>(() => [
    { id: 'school', header: 'School', width: '34%', cell: m => <TruncatedText className="k-medium">{m.name}</TruncatedText> },
    { id: 'from', header: 'From', width: '14%', cell: m => <StatusPill tone={statusTone(m.from_status)}>{m.from_status}</StatusPill> },
    { id: 'to', header: 'To', width: '14%', cell: m => <StatusPill tone={statusTone(m.to_status)}>{m.to_status}</StatusPill> },
    { id: 'date', header: 'Snapshot', cell: m => <span className="k-secondary">{fmtDay(m.as_of)}</span> },
  ], []);

  const saveFailed = saveError && (
    <ErrorState title={`Couldn't save the ${day} snapshot.`} detail={saveError} onRetry={() => { void save(); }} retrying={saving} />
  );
  const { latest, prev, moves } = funnel.data ?? { latest: null, prev: null, moves: [] };

  return (
    <div data-testid="pipeline" style={{ ...stack, gap: 'var(--space-6)' }}>
      <section aria-label="Free schools this week">
        <SectionHead
          title="Free schools by stage"
          context={`Scored live for ${day}. Ready means a readiness score of ${meta.thresholds.pql_ready} or more.`}
        />
        {pql.error && !pql.data ? (
          <ErrorState
            title={`Couldn't score free schools for ${day}.`}
            detail={(pql.error as Error).message}
            onRetry={() => { void pql.refetch(); }}
            retrying={pql.isFetching}
          />
        ) : (
          <StatRow items={[
            {
              label: 'Ready to buy', value: live?.ready, loading: !live, emphasis: true,
              context: live && context(live.ready, base?.ready, `Of ${live.total.toLocaleString('en-US')} free schools`),
            },
            {
              label: 'Not yet', value: live?.notYet, loading: !live,
              context: live && context(live.notYet, base?.not_yet, `Below ${meta.thresholds.pql_ready}, of ${live.total.toLocaleString('en-US')} free schools`),
            },
          ]} />
        )}
      </section>

      <section aria-label="Snapshot history">
        <SectionHead
          title="Snapshot history"
          context="Each snapshot keeps every free school's stage for one date. The weekly n8n run saves one."
          aside={snapshots.length > 0 && (savedForDay
            ? <span className="k-text-sm k-tertiary">{fmtShort(asOf)} is saved</span>
            : <Button variant="secondary" size="sm" loading={saving} onClick={() => { void save(); }}>Save {fmtShort(asOf)} snapshot</Button>)}
        />
        {snapshots.length > 0 && saveFailed}
        <Table
          aria-label="Saved snapshots, newest first"
          rows={historyRows}
          columns={historyColumns}
          rowKey={r => r.as_of}
          loading={funnel.isLoading}
          skeletonRows={3}
          error={funnel.error ? (
            <ErrorState
              title="Couldn't load the snapshot history."
              detail={(funnel.error as Error).message}
              onRetry={() => { void funnel.refetch(); }}
              retrying={funnel.isFetching}
            />
          ) : undefined}
          empty={saveFailed || (
            <EmptyState action={{ label: saving ? 'Saving snapshot…' : 'Save snapshot', onClick: () => { void save(); } }}>
              No snapshots yet. Save one for {day} to compare next week.
            </EmptyState>
          )}
        />
      </section>

      {snapshots.length > 0 && (
        <section aria-label="Stage moves">
          <SectionHead
            title="Stage moves"
            context={latest && prev ? `Schools that changed stage between the ${fmtDay(prev.as_of)} and ${fmtDay(latest.as_of)} snapshots.` : 'Schools that changed stage between the last two snapshots.'}
          />
          <Table
            aria-label="Stage moves between the last two snapshots"
            rows={moves}
            columns={moveColumns}
            rowKey={m => `${m.school_id}-${m.as_of}`}
            rowLabel={m => m.name}
            empty={
              <EmptyState>
                {snapshots.length < 2
                  ? 'Stage moves show up once a second snapshot is saved.'
                  : 'No school changed stage between the last two snapshots.'}
              </EmptyState>
            }
          />
        </section>
      )}
    </div>
  );
}
