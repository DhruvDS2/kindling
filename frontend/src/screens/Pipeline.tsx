import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPipelineFunnel, fetchSnapshotSchools, postSnapshot } from '../api';
import { useAsOf } from '../asOf';
import type { PipelineFunnelData, FunnelSnapshot } from '../types';
import ScoreChip from '../components/ScoreChip';
import { SkeletonCard } from '../components/Skeleton';

function delta(latest: FunnelSnapshot | null, prev: FunnelSnapshot | null, key: 'not_yet' | 'ready') {
  if (!latest || !prev) return null;
  return latest[key] - prev[key];
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ fontSize: 13, color: 'var(--muted)' }}>—</span>;
  const color = value > 0 ? 'var(--steady)' : value < 0 ? 'var(--risk)' : 'var(--muted)';
  const sign = value > 0 ? '+' : '';
  return (
    <span style={{ fontSize: 13, color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
      {sign}{value} vs last snapshot
    </span>
  );
}

function FunnelTile({
  label, value, delta: d, valueColor, active, onClick,
}: {
  label: string;
  value: number;
  delta: number | null;
  valueColor?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card)',
        border: `1px solid ${active ? (valueColor ?? 'var(--ink)') : 'var(--line)'}`,
        borderRadius: 12,
        padding: 20,
        flex: 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
        {onClick && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{active ? '▲' : '▼'}</span>}
      </div>
      <div style={{
        fontSize: 40,
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        color: valueColor ?? 'var(--ink)',
        lineHeight: 1.1,
        marginBottom: 8,
      }}>
        {value}
      </div>
      <DeltaBadge value={d} />
    </div>
  );
}

export default function Pipeline() {
  const { asOf } = useAsOf();
  const queryClient = useQueryClient();
  const [snapping, setSnapping] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<'not_yet' | 'ready' | null>(null);

  const { data, isLoading, error } = useQuery<PipelineFunnelData>({
    queryKey: ['pipeline'],
    queryFn: fetchPipelineFunnel,
  });

  const expandedStatus = expanded === 'ready' ? 'Ready' : expanded === 'not_yet' ? 'Not yet' : undefined;
  const { data: schoolList, isLoading: schoolsLoading } = useQuery({
    queryKey: ['snapshot-schools', data?.latest?.as_of, expandedStatus],
    queryFn: () => fetchSnapshotSchools(data?.latest?.as_of ?? undefined, expandedStatus),
    enabled: expanded !== null && !!data?.latest,
  });

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

  if (error) {
    return <div style={{ color: 'var(--muted)', fontSize: 14 }}>Failed to load — is the API running?</div>;
  }

  if (isLoading) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[0, 1, 2].map(i => <SkeletonCard key={i} rows={3} />)}
        </div>
        <SkeletonCard rows={6} />
      </div>
    );
  }

  const { snapshots, latest, prev, moves } = data ?? { snapshots: [], latest: null, prev: null, moves: [] };
  const hasData = snapshots.length > 0;

  const notYetDelta = delta(latest, prev, 'not_yet');
  const readyDelta = delta(latest, prev, 'ready');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Funnel tiles */}
      <div style={{ display: 'flex', gap: 16 }}>
        <FunnelTile
          label="Not yet"
          value={latest?.not_yet ?? 0}
          delta={notYetDelta}
          active={expanded === 'not_yet'}
          onClick={hasData ? () => setExpanded(e => e === 'not_yet' ? null : 'not_yet') : undefined}
        />
        <FunnelTile
          label="Ready to buy"
          value={latest?.ready ?? 0}
          delta={readyDelta}
          valueColor="var(--ember)"
          active={expanded === 'ready'}
          onClick={hasData ? () => setExpanded(e => e === 'ready' ? null : 'ready') : undefined}
        />
        <FunnelTile
          label="Converted"
          value={0}
          delta={null}
          valueColor="var(--steady)"
        />
      </div>

      {/* Expanded school list */}
      {expanded !== null && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>
            {expanded === 'ready' ? 'Ready to buy' : 'Not yet'} · {data?.latest?.as_of}
          </div>

          {schoolsLoading ? (
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px',
                gap: 8,
                paddingBottom: 8,
                borderBottom: '1px solid var(--row-divider)',
                fontSize: 12,
                color: 'var(--muted)',
              }}>
                <span>School</span>
                <span>PQL score</span>
              </div>
              {(schoolList?.schools ?? []).map((school, i) => (
                <div
                  key={school.school_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px',
                    gap: 8,
                    padding: '9px 0',
                    borderBottom: i < (schoolList?.schools.length ?? 0) - 1 ? '1px solid var(--row-divider)' : 'none',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: expanded === 'ready' ? 600 : 400 }}>
                    {school.name}
                  </span>
                  <ScoreChip score={school.pql_score} type="pql" status={school.status} />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Snapshot history + take snapshot */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            Snapshot history · {snapshots.length} week{snapshots.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {snapError && (
              <span style={{ fontSize: 13, color: 'var(--risk)' }}>{snapError}</span>
            )}
            <button
              onClick={handleSnapshot}
              disabled={snapping}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                border: '1px solid var(--ember)',
                background: snapping ? 'var(--line)' : 'var(--ember)',
                color: snapping ? 'var(--muted)' : '#fff',
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: 600,
                cursor: snapping ? 'not-allowed' : 'pointer',
              }}
            >
              {snapping ? 'Taking snapshot…' : `Snapshot ${asOf}`}
            </button>
          </div>
        </div>

        {!hasData ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            No snapshots yet. Hit "Snapshot" to record the scores for the date at the top of the page.
          </div>
        ) : (
          <>
            {/* History table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr 1fr',
              gap: 8,
              paddingBottom: 8,
              borderBottom: '1px solid var(--row-divider)',
              fontSize: 12,
              color: 'var(--muted)',
            }}>
              <span>Date</span>
              <span>Not yet</span>
              <span>Ready</span>
            </div>

            {[...snapshots].reverse().map((snap, i) => (
              <div
                key={snap.as_of}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 1fr',
                  gap: 8,
                  padding: '10px 0',
                  borderBottom: i < snapshots.length - 1 ? '1px solid var(--row-divider)' : 'none',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>
                  {snap.as_of}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: 'var(--ink)' }}>
                  {snap.not_yet}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: 'var(--ember)', fontWeight: 600 }}>
                  {snap.ready}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Stage moves */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
          Stage moves · between last two snapshots
        </div>

        {moves.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            {snapshots.length < 2
              ? 'Take two or more snapshots to see which schools changed stage.'
              : 'No schools changed stage between the last two snapshots.'}
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 120px 120px',
              gap: 8,
              paddingBottom: 8,
              borderBottom: '1px solid var(--row-divider)',
              fontSize: 12,
              color: 'var(--muted)',
            }}>
              <span>School</span>
              <span>From</span>
              <span>To</span>
              <span>Date</span>
            </div>

            {moves.map((move, i) => (
              <div
                key={move.school_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px 120px',
                  gap: 8,
                  padding: '10px 0',
                  borderBottom: i < moves.length - 1 ? '1px solid var(--row-divider)' : 'none',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{move.name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{move.from_status}</span>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: move.to_status === 'Ready' ? 'var(--ember)' : 'var(--muted)',
                }}>
                  {move.to_status}
                </span>
                <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {move.as_of}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

    </div>
  );
}
