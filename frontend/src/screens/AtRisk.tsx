import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../api';
import type { HealthScore } from '../types';
import ScoreChip from '../components/ScoreChip';
import { SkeletonCard } from '../components/Skeleton';
import AccountDetail from '../components/AccountDetail';

interface Props { focusSchoolId?: string | null; }

export default function AtRisk({ focusSchoolId }: Props) {
  const { data, isLoading, error } = useQuery<HealthScore[]>({ queryKey: ['health'], queryFn: () => fetchHealth() });
  const [selected, setSelected] = useState<HealthScore | null>(null);

  useEffect(() => {
    if (focusSchoolId && data) {
      const school = data.find(s => s.school_id === focusSchoolId) ?? null;
      setSelected(school);
    }
  }, [focusSchoolId, data]);

  if (error) return <div style={{ color: 'var(--muted)' }}>Failed to load — is the API running?</div>;
  if (isLoading) return <SkeletonCard rows={6} />;

  const rows = (data ?? []).filter(s => s.status === 'At risk');

  return (
    <>
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--row-divider)' }}>
              {['School', 'Health', 'Status', 'Renews', 'ARR', 'Contact'].map(h => (
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
            {rows.map((school, i) => {
              const renewDate = new Date(Date.now() + school.days_to_renewal * 86400000);
              const renewLabel = renewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <tr
                  key={school.school_id}
                  onClick={() => setSelected(school)}
                  style={{
                    borderBottom: i < rows.length - 1 ? '1px solid var(--row-divider)' : 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                      {school.district ? 'District' : 'Independent'} · {school.city}, {school.state}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <ScoreChip score={school.health_score} type="health" status={school.status} />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--body)' }}>{school.status}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>
                    {renewLabel}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>
                    ${school.arr.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{school.contact_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{school.contact_title}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <AccountDetail
          type="health"
          school={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
