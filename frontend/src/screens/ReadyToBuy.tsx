import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPql } from '../api';
import type { PqlScore } from '../types';
import ScoreChip from '../components/ScoreChip';
import { SkeletonCard } from '../components/Skeleton';
import AccountDetail from '../components/AccountDetail';

interface Props { focusSchoolId?: string | null; }

export default function ReadyToBuy({ focusSchoolId }: Props) {
  const { data, isLoading, error } = useQuery<PqlScore[]>({ queryKey: ['pql'], queryFn: () => fetchPql() });
  const [selected, setSelected] = useState<PqlScore | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (focusSchoolId && data) {
      const school = data.find(s => s.school_id === focusSchoolId) ?? null;
      setSelected(school);
    }
  }, [focusSchoolId, data]);

  if (error) return <div style={{ color: 'var(--muted)' }}>Failed to load — is the API running?</div>;
  if (isLoading) return <SkeletonCard rows={8} />;

  const rows = [...(data ?? [])].sort((a, b) =>
    sortAsc ? a.pql_score - b.pql_score : b.pql_score - a.pql_score
  );

  const cols: { label: string; key: string }[] = [
    { label: 'School', key: 'name' },
    { label: 'PQL', key: 'pql_score' },
    { label: 'Status', key: 'status' },
    { label: 'Active teachers', key: 'active_teachers' },
    { label: 'Sessions', key: 'student_sessions' },
    { label: 'Contact', key: 'contact_name' },
  ];

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
              {cols.map(col => (
                <th
                  key={col.key}
                  onClick={col.key === 'pql_score' ? () => setSortAsc(v => !v) : undefined}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    color: 'var(--muted)',
                    fontWeight: 500,
                    cursor: col.key === 'pql_score' ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.label} {col.key === 'pql_score' && (sortAsc ? '↑' : '↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((school, i) => (
              <tr
                key={school.school_id}
                onClick={() => setSelected(school)}
                style={{
                  borderBottom: i < rows.length - 1 ? '1px solid var(--row-divider)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
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
                  <ScoreChip score={school.pql_score} type="pql" status={school.status} />
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--body)' }}>
                  {school.status}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>
                  {school.active_teachers}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>
                  {school.student_sessions.toLocaleString()}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{school.contact_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{school.contact_title}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <AccountDetail
          type="pql"
          school={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
