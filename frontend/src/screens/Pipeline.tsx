import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPipelineFunnel, postSnapshot } from '../api';
import { useAsOf, usePql } from '../asOf';
import { fmtDay } from '../nav';
import type { PipelineFunnelData, FunnelSnapshot, PqlStatus } from '../types';
import ScoreChip from '../components/ScoreChip';
import { SkeletonCard } from '../components/Skeleton';

// The funnel tiles are live: free schools scored for the as-of date (GET /pql).
// The history below is saved snapshots (GET /pipeline/funnel), compared to the
// latest snapshot taken before the as-of date.

const card = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 20 } as const;
const mono = 'JetBrains Mono, monospace';

type Stage = 'not_yet' | 'ready';
const STAGE_STATUS: Record<Stage, PqlStatus> = { not_yet: 'Not yet', ready: 'Ready' };

function DeltaBadge({ value, base }: { value: number | null; base: FunnelSnapshot | null }) {
  if (value === null || !base) {
    return <span style={{ fontSize: 13, color: 'var(--muted)' }}>No earlier snapshot to compare</span>;
  }
  const color = value > 0 ? 'var(--steady)' : value < 0 ? 'var(--risk)' : 'var(--muted)';
  return (
    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
      <span style={{ color, fontFamily: mono, fontWeight: 600 }}>{value > 0 ? '+' : ''}{value}</span>
      {' '}vs snapshot of {fmtDay(base.as_of)}
    </span>
  );
}

function FunnelTile({ label, value, delta, base, valueColor, active, onClick }: {
  label: string;
  value: number;
  delta: number | null;
  base: FunnelSnapshot | null;
  valueColor?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      style={{
        ...card,
        flex: 1,
        textAlign: 'left',
        font: 'inherit',
        cursor: 'pointer',
        border: `1px solid ${active ? (valueColor ?? 'var(--ink)') : 'var(--line)'}`,
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{active ? 'Hide schools ▲' : 'Show schools ▼'}</span>
      </div>
      <div style={{ fontSize: 40, fontWeight: 700, fontFamily: mono, color: valueColor ?? 'var(--ink)', lineHeight: 1.1, marginBottom: 8 }}>
        {value}
      </div>
      <DeltaBadge value={delta} base={base} />
    </button>
  );
}

export default function Pipeline() {
  const { asOf, meta } = useAsOf();
  const queryClient = useQueryClient();
  const [snapping, setSnapping] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Stage | null>(null);

  const pql = usePql();
  const funnel = useQuery<PipelineFunnelData>({ queryKey: ['pipeline'], queryFn: fetchPipelineFunnel });

  async function handleSnapshot() {
    setSnapping(true);
    setSnapError(null);
    try {
      await postSnapshot(asOf);
      await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    } catch (e: unknown) {
      setSnapError(e instanceof Error ? e.message : 'Snapshot failed');
    } finally {
      setSnapping(false);
    }
  }

  if (pql.error || funnel.error) {
    const err = (pql.error ?? funnel.error) as Error;
    return <div style={{ color: 'var(--muted)', fontSize: 14 }}>Failed to load ({err.message}). Is the API running?</div>;
  }

  if (pql.isLoading || funnel.isLoading) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[0, 1].map(i => <SkeletonCard key={i} rows={3} />)}
        </div>
        <SkeletonCard rows={6} />
      </div>
    );
  }

  const scores = pql.data ?? [];
  const live = {
    not_yet: scores.filter(s => s.status === 'Not yet').length,
    ready: scores.filter(s => s.status === 'Ready').length,
  };
  const { snapshots, latest, prev, moves } = funnel.data ?? { snapshots: [], latest: null, prev: null, moves: [] };
  // The newest snapshot taken before the date on screen: what "this week" is compared to.
  const base = [...snapshots].filter(s => s.as_of < asOf).sort((a, b) => a.as_of.localeCompare(b.as_of)).at(-1) ?? null;
  const delta = (k: Stage) => (base ? live[k] - base[k] : null);
  const toggle = (k: Stage) => setExpanded(e => (e === k ? null : k));

  const list = expanded
    ? scores.filter(s => s.status === STAGE_STATUS[expanded]).sort((a, b) => b.pql_score - a.pql_score)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        Free schools scored on {fmtDay(asOf)}: Ready at a PQL score of {meta.thresholds.pql_ready} or more.
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <FunnelTile label="Not yet" value={live.not_yet} delta={delta('not_yet')} base={base}
          active={expanded === 'not_yet'} onClick={() => toggle('not_yet')} />
        <FunnelTile label="Ready to buy" value={live.ready} delta={delta('ready')} base={base} valueColor="var(--ember)"
          active={expanded === 'ready'} onClick={() => toggle('ready')} />
      </div>

      {expanded !== null && (
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>
            {expanded === 'ready' ? 'Ready to buy' : 'Not yet'} · {fmtDay(asOf)}
          </div>
          {list.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>No schools in this stage on {fmtDay(asOf)}.</div>
          ) : (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, paddingBottom: 8,
                borderBottom: '1px solid var(--row-divider)', fontSize: 12, color: 'var(--muted)',
              }}>
                <span>School</span>
                <span>PQL score</span>
              </div>
              {list.map((school, i) => (
                <div key={school.school_id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, padding: '9px 0', alignItems: 'center',
                  borderBottom: i < list.length - 1 ? '1px solid var(--row-divider)' : 'none',
                }}>
                  <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: expanded === 'ready' ? 600 : 400 }}>{school.name}</span>
                  <span><ScoreChip score={school.pql_score} type="pql" status={school.status} /></span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Snapshot history */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            Snapshot history{snapshots.length > 0 && ` · ${snapshots.length} week${snapshots.length !== 1 ? 's' : ''}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {snapError && <span style={{ fontSize: 13, color: 'var(--risk)' }}>{snapError}</span>}
            <button
              onClick={handleSnapshot}
              disabled={snapping}
              style={{
                padding: '7px 16px', borderRadius: 8, border: '1px solid var(--ember)',
                background: snapping ? 'var(--line)' : 'var(--ember)', color: snapping ? 'var(--muted)' : '#fff',
                fontFamily: 'Inter', fontSize: 13, fontWeight: 600, cursor: snapping ? 'not-allowed' : 'pointer',
              }}
            >
              {snapping ? 'Taking snapshot…' : `Snapshot ${fmtDay(asOf)}`}
            </button>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div data-testid="pipeline-empty" style={{ padding: '24px 0 8px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, maxWidth: 720 }}>
            <div style={{ color: 'var(--ink)', fontWeight: 600, marginBottom: 4 }}>No snapshots saved yet</div>
            A snapshot saves every free school's PQL status for one date, so this page can show week-over-week
            changes and which schools moved stage. The weekly n8n run saves one when it runs, or use the button above
            to save one for {fmtDay(asOf)}. The tiles above don't need snapshots: they are scored live.
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 8, paddingBottom: 8,
              borderBottom: '1px solid var(--row-divider)', fontSize: 12, color: 'var(--muted)',
            }}>
              <span>Date</span>
              <span>Not yet</span>
              <span>Ready</span>
            </div>
            {[...snapshots].reverse().map((snap, i) => {
              const isBase = base?.as_of === snap.as_of;
              const after = snap.as_of > asOf;
              return (
                <div key={snap.as_of} style={{
                  display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 8, padding: '10px 0', alignItems: 'center',
                  borderBottom: i < snapshots.length - 1 ? '1px solid var(--row-divider)' : 'none',
                  opacity: after ? 0.55 : 1,
                }}>
                  <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--muted)' }}>
                    {fmtDay(snap.as_of)}
                    {isBase && <span style={{ fontFamily: 'Inter', fontSize: 11, marginLeft: 6 }}>compared</span>}
                    {after && <span style={{ fontFamily: 'Inter', fontSize: 11, marginLeft: 6 }}>after as-of date</span>}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 14, color: 'var(--ink)' }}>{snap.not_yet}</span>
                  <span style={{ fontFamily: mono, fontSize: 14, color: 'var(--ember)', fontWeight: 600 }}>{snap.ready}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Stage moves */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
          Stage moves
          <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 13 }}>
            {latest && prev ? ` · ${fmtDay(prev.as_of)} to ${fmtDay(latest.as_of)}` : ' · between the last two snapshots'}
          </span>
        </div>

        {moves.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            {snapshots.length < 2
              ? 'Stage moves appear once two snapshots are saved.'
              : 'No schools changed stage between the last two snapshots.'}
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 120px 140px', gap: 8, paddingBottom: 8,
              borderBottom: '1px solid var(--row-divider)', fontSize: 12, color: 'var(--muted)',
            }}>
              <span>School</span>
              <span>From</span>
              <span>To</span>
              <span>Date</span>
            </div>
            {moves.map((move, i) => (
              <div key={`${move.school_id}-${move.as_of}`} style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 120px 140px', gap: 8, padding: '10px 0', alignItems: 'center',
                borderBottom: i < moves.length - 1 ? '1px solid var(--row-divider)' : 'none',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{move.name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{move.from_status}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: move.to_status === 'Ready' ? 'var(--ember)' : 'var(--muted)' }}>
                  {move.to_status}
                </span>
                <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: mono }}>{fmtDay(move.as_of)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
