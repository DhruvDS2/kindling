import { useQuery } from '@tanstack/react-query';
import type { AutomationRun } from '../types';
import { fetchAutomationsLog } from '../api';
import { SkeletonCard } from '../components/Skeleton';

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
            {['Time', 'PQL alerts', 'CS alerts', 'Email drafts', 'Status'].map(h => (
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
          {data.map((run, i) => (
            <tr
              key={run.id}
              style={{ borderBottom: i < data.length - 1 ? '1px solid var(--row-divider)' : 'none' }}
            >
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 14, color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {new Date(run.run_at).toLocaleString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{run.trigger}</div>
              </td>
              <td style={{ padding: '12px 16px', fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>
                {run.pql_alerts}
              </td>
              <td style={{ padding: '12px 16px', fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>
                {run.cs_alerts ?? run.health_alerts ?? 0}
              </td>
              <td style={{ padding: '12px 16px', fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>
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
