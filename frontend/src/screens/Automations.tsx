import { useQuery } from '@tanstack/react-query';
import type { AutomationRun } from '../types';
import { fetchAutomationsLog } from '../api';
import { fmtDay } from '../nav';
import { SkeletonCard } from '../components/Skeleton';

const mono = 'JetBrains Mono, monospace';

/**
 * n8n logs run_at either as a day ("2026-11-16") or as a full timestamp.
 * A day is a local calendar day: parse it with parseDay (via fmtDay), never as UTC
 * midnight, which shows the previous evening in US time zones.
 */
function RunTime({ runAt }: { runAt: string }) {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const stamp = /T\d{2}:\d{2}/.test(runAt) ? new Date(runAt) : null;
  if (!stamp || Number.isNaN(stamp.getTime())) return <span title={runAt}>{fmtDay(runAt, opts)}</span>;
  return (
    <span title={runAt}>
      {stamp.toLocaleDateString('en-US', opts)}
      <span style={{ color: 'var(--muted)' }}> · {stamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
    </span>
  );
}

export default function Automations() {
  const { data, isLoading, error } = useQuery<AutomationRun[]>({ queryKey: ['automations'], queryFn: () => fetchAutomationsLog() });

  if (error) return <div style={{ color: 'var(--muted)' }}>Failed to load — is the API running?</div>;
  if (isLoading) return <SkeletonCard rows={5} />;

  if (!data || data.length === 0) {
    return (
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 32,
        textAlign: 'center',
        color: 'var(--muted)',
        fontSize: 14,
      }}>
        No runs recorded yet. Re-import kindling_weekly.json into n8n and trigger a run.
      </div>
    );
  }

  // Newest first. ISO strings sort by time; the stable sort keeps same-day runs in log order, latest first.
  const runs = data
    .map((run, i) => ({ run, i }))
    .sort((a, b) => b.run.run_at.localeCompare(a.run.run_at) || b.i - a.i)
    .map(({ run }) => run);

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--row-divider)' }}>
            {['Run', 'PQL alerts', 'CS alerts', 'Email drafts', 'Status'].map(h => (
              <th key={h} style={{
                padding: '10px 16px',
                textAlign: 'left',
                fontSize: 12,
                color: 'var(--muted)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => (
            <tr
              key={`${run.run_at}-${i}`}
              style={{ borderBottom: i < runs.length - 1 ? '1px solid var(--row-divider)' : 'none' }}
            >
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 14, color: 'var(--ink)', fontFamily: mono }}>
                  <RunTime runAt={run.run_at} />
                </div>
                {run.trigger && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{run.trigger}</div>}
              </td>
              <td style={{ padding: '12px 16px', fontSize: 14, fontFamily: mono, color: 'var(--body)' }}>
                {run.pql_alerts}
              </td>
              <td style={{ padding: '12px 16px', fontSize: 14, fontFamily: mono, color: 'var(--body)' }}>
                {run.cs_alerts ?? run.health_alerts ?? '—'}
              </td>
              <td style={{ padding: '12px 16px', fontSize: 14, fontFamily: mono, color: 'var(--body)' }}>
                {run.email_drafts}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: run.status === 'succeeded' ? '#E6F4EE' : 'var(--risk-chip-bg)',
                  color: run.status === 'succeeded' ? 'var(--steady)' : 'var(--risk)',
                }}>
                  {run.status === 'succeeded' ? 'Succeeded' : 'Failed'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
