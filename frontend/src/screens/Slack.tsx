import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPql, fetchHealth, notifySlack, DEFAULT_AS_OF } from '../api';
import type { PqlScore, HealthScore } from '../types';
import ScoreChip from '../components/ScoreChip';
import { SkeletonCard } from '../components/Skeleton';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

function NotifyButton({
  schoolId,
  channel,
}: {
  schoolId: string;
  channel: 'sales' | 'cs';
}) {
  const [state, setState] = useState<SendState>('idle');

  async function handleClick() {
    setState('sending');
    try {
      const res = await notifySlack(channel, schoolId, DEFAULT_AS_OF);
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  const label = { idle: 'Notify', sending: 'Sending…', sent: 'Sent ✓', error: 'Failed' }[state];
  const bg = { idle: 'var(--ember)', sending: 'var(--line)', sent: 'var(--steady)', error: 'var(--risk)' }[state];
  const color = state === 'sending' ? 'var(--muted)' : '#fff';

  return (
    <button
      onClick={handleClick}
      disabled={state === 'sending' || state === 'sent'}
      style={{
        padding: '5px 14px',
        borderRadius: 6,
        border: 'none',
        background: bg,
        color,
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: 600,
        cursor: state === 'sending' || state === 'sent' ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function SectionHeader({ title, channel, count }: { title: string; channel: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
      <span style={{
        fontSize: 12,
        color: 'var(--muted)',
        background: 'var(--nav)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        padding: '2px 10px',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        #{channel}
      </span>
      <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 'auto' }}>
        {count} school{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

export default function Slack() {
  const { data: pqlData, isLoading: pqlLoading, error: pqlError } = useQuery<PqlScore[]>({
    queryKey: ['pql'],
    queryFn: () => fetchPql(),
  });
  const { data: healthData, isLoading: healthLoading, error: healthError } = useQuery<HealthScore[]>({
    queryKey: ['health'],
    queryFn: () => fetchHealth(),
  });

  if (pqlError || healthError) {
    return <div style={{ color: 'var(--muted)', fontSize: 14 }}>Failed to load — is the API running?</div>;
  }

  if (pqlLoading || healthLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SkeletonCard rows={5} />
        <SkeletonCard rows={5} />
      </div>
    );
  }

  const readySchools = (pqlData ?? []).filter(s => s.status === 'Ready');
  const atRiskSchools = (healthData ?? []).filter(s => s.status === 'At risk');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Ready to buy → #sales */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 20,
        overflow: 'hidden',
      }}>
        <SectionHeader title="Ready to buy" channel="sales" count={readySchools.length} />

        {readySchools.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, padding: '12px 0' }}>
            No schools in Ready status right now.
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 130px 1fr 90px',
              gap: 8,
              paddingBottom: 8,
              borderBottom: '1px solid var(--row-divider)',
              fontSize: 12,
              color: 'var(--muted)',
            }}>
              <span>School</span>
              <span>PQL</span>
              <span>Contact</span>
              <span></span>
            </div>

            {readySchools.map((school, i) => (
              <div
                key={school.school_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 1fr 90px',
                  gap: 8,
                  padding: '10px 0',
                  borderBottom: i < readySchools.length - 1 ? '1px solid var(--row-divider)' : 'none',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                    {school.city}, {school.state}
                  </div>
                </div>
                <ScoreChip score={school.pql_score} type="pql" status={school.status} />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{school.contact_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{school.contact_title}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <NotifyButton schoolId={school.school_id} channel="sales" />
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* At risk → #cs */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 20,
        overflow: 'hidden',
      }}>
        <SectionHeader title="At risk" channel="customer-success" count={atRiskSchools.length} />

        {atRiskSchools.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, padding: '12px 0' }}>
            No schools at risk right now.
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 130px 80px 80px 90px',
              gap: 8,
              paddingBottom: 8,
              borderBottom: '1px solid var(--row-divider)',
              fontSize: 12,
              color: 'var(--muted)',
            }}>
              <span>School</span>
              <span>Health</span>
              <span>Renews</span>
              <span>ARR</span>
              <span></span>
            </div>

            {atRiskSchools.map((school, i) => {
              const renewDate = new Date(Date.now() + school.days_to_renewal * 86400000);
              const renewLabel = renewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div
                  key={school.school_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 130px 80px 80px 90px',
                    gap: 8,
                    padding: '10px 0',
                    borderBottom: i < atRiskSchools.length - 1 ? '1px solid var(--row-divider)' : 'none',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                      {school.city}, {school.state}
                    </div>
                  </div>
                  <ScoreChip score={school.health_score} type="health" status={school.status} />
                  <div style={{ fontSize: 13, color: 'var(--body)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {renewLabel}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--body)', fontFamily: 'JetBrains Mono, monospace' }}>
                    ${(school.arr / 1000).toFixed(0)}K
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <NotifyButton schoolId={school.school_id} channel="cs" />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

    </div>
  );
}
